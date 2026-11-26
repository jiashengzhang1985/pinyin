// 统一的朗读入口：
// - 英文优先用有道美式真人发音（提前加载 / App 里提前下载），不行再用系统语音
// - 安卓 App 里用系统原生 TTS（WebView 的 speechSynthesis 在很多手机上没声音）
// - 网页里用浏览器的 speechSynthesis
// 所有朗读都返回 Promise，读完（或失败、超时）后 resolve。
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { cacheAudio, cachedAudioUrl } from './audioCache';
import { loadClip, playClipBuffer } from './clipPlayer';

export const isNativeApp = Capacitor.isNativePlatform();

export type TtsLang = 'zh-CN' | 'en-US';

let speakingCount = 0;
/** 是否正在朗读（代替 window.speechSynthesis.speaking） */
export const isSpeaking = () =>
  speakingCount > 0 || (!isNativeApp && !!window.speechSynthesis?.speaking);

// macOS 上这批中文语音机械感很重，浏览器语音回退时避开
const ROBOTIC_VOICES = /Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley/i;

const pickVoice = (lang: TtsLang): SpeechSynthesisVoice | undefined => {
  const voices = window.speechSynthesis.getVoices();
  if (lang === 'zh-CN') {
    const zh = voices.filter(v => /^zh[-_]CN/i.test(v.lang) && !ROBOTIC_VOICES.test(v.name));
    return (
      zh.find(v => /Natural|Online/i.test(v.name)) || // Edge 的神经网络语音，最自然
      zh.find(v => /Google/i.test(v.name)) ||
      zh.find(v => /Tingting|婷婷/i.test(v.name)) ||
      zh[0]
    );
  }
  return (
    voices.find(v => v.name.includes('Google US English')) ||
    voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
    voices.find(v => v.lang === 'en-US' && v.localService) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en'))
  );
};

// 某些浏览器第一次取语音列表是空的，要等 voiceschanged
const voicesReady = () =>
  new Promise<void>(resolve => {
    const ss = window.speechSynthesis;
    if (ss.getVoices().length > 0) return resolve();
    const timer = setTimeout(resolve, 1000);
    ss.addEventListener?.('voiceschanged', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

const speakWeb = async (text: string, lang: TtsLang, rate: number) => {
  if (!window.speechSynthesis) return;
  await voicesReady();
  await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    const timer = setTimeout(resolve, 3000 + text.length * (lang === 'zh-CN' ? 500 : 250));
    u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
    window.speechSynthesis.speak(u);
  });
};

// 手机 TTS 的语音列表里挑一个对应语言的语音（不指定时，国产手机的引擎常用中文腔读英文）
let nativeVoices: Promise<SpeechSynthesisVoice[]> | null = null;
const pickNativeVoice = async (lang: TtsLang): Promise<number | undefined> => {
  nativeVoices ??= TextToSpeech.getSupportedVoices()
    .then(r => r.voices || [])
    .catch(() => []);
  const voices = await nativeVoices;
  const norm = (l: string) => (l || '').replace('_', '-').toLowerCase();
  const want = lang.toLowerCase();
  const idx = (pred: (v: SpeechSynthesisVoice) => boolean) => voices.findIndex(pred);
  // 优先本地语音（离线也能用），其次联网语音
  let i = idx(v => norm(v.lang) === want && v.localService !== false);
  if (i < 0) i = idx(v => norm(v.lang) === want);
  return i >= 0 ? i : undefined;
};

// 播放一个音频元素，播完返回 true；失败或超时没开始返回 false
const playElement = (audio: HTMLAudioElement, timeoutMs: number) =>
  new Promise<boolean>(resolve => {
    let started = false;
    const fail = setTimeout(() => { if (!started) { audio.src = ''; resolve(false); } }, timeoutMs);
    audio.onplaying = () => { started = true; clearTimeout(fail); };
    audio.onended = () => { clearTimeout(fail); resolve(true); };
    audio.onerror = () => { clearTimeout(fail); resolve(started); };
    audio.play().catch(() => { clearTimeout(fail); resolve(false); });
  });

// 英文用有道词典的美式发音（单词是真人录音，国内外都能访问），网页和 App 都一样：
// - App 里配置时已在后台下载到手机里的，直接播放本地文件
// - 目标出现时就预先加载好，击中后立即出声，不用等联网
// - 有道连不上时 5 分钟内不再尝试，直接用系统语音，免得每次都等
const youdaoUrl = (text: string) => {
  const t = text.trim().replace(/\s+/g, ' ');
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(t.includes(' ') ? t : t.toLowerCase())}&type=2`;
};
let youdaoDownUntil = 0;
const youdaoDown = () => Date.now() < youdaoDownUntil;

// 已准备好的英文发音：
// - App：下载到手机里并解码到内存的本地文件地址（播放无需联网、无需等待）
// - 网页：预先加载好的 <audio>（有道不允许网页直接读取数据，只能这样预加载）
const readyLocal = new Map<string, string>();
const readyWeb = new Map<string, HTMLAudioElement>();
const preparing = new Map<string, Promise<void>>();

/**
 * 提前准备好一段英文的发音。配置好单词、生成好例句后就在后台调用，
 * 玩的时候直接播放。重复调用只准备一次。
 */
export const prepareEnglishAudio = (text: string): Promise<void> => {
  if (!text.trim()) return Promise.resolve();
  const url = youdaoUrl(text);
  let p = preparing.get(url);
  if (!p) {
    p = (async () => {
      if (isNativeApp) {
        await cacheAudio(url);
        const local = await cachedAudioUrl(url);
        if (local) {
          await loadClip(local);
          readyLocal.set(url, local);
        }
      } else {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        audio.load();
        readyWeb.set(url, audio);
      }
    })();
    // 没准备成功的（断网等），下次再调用时重试
    p.then(() => { if (!readyLocal.has(url) && !readyWeb.has(url)) preparing.delete(url); });
    preparing.set(url, p);
  }
  return p;
};
export const preloadEnglish = prepareEnglishAudio;

const speakEnglishAudio = async (text: string) => {
  const url = youdaoUrl(text);
  // App：已下载的本地发音
  const local = readyLocal.get(url) || (isNativeApp ? await cachedAudioUrl(url) : null);
  if (local && (await playClipBuffer(local))) return true;
  // 网页：预先加载好的，可反复播放
  const web = readyWeb.get(url);
  if (web) {
    web.currentTime = 0;
    if (await playElement(web, 3000)) return true;
    readyWeb.delete(url);
    preparing.delete(url);
  }
  // 都没有（刚录入还没准备好）：临时联网播放，同时准备下次用
  if (youdaoDown()) return false;
  prepareEnglishAudio(text);
  const ok = await playElement(new Audio(url), 4000);
  if (!ok) youdaoDownUntil = Date.now() + 5 * 60_000;
  return ok;
};

const speakNative = async (text: string, lang: TtsLang, rate: number) => {
  const voice = await pickNativeVoice(lang);
  // 安卓 TTS 的 1.0 比浏览器略快，整体放慢一点更适合孩子
  const timeout = new Promise<void>(r => setTimeout(r, 5000 + text.length * 600));
  await Promise.race([
    TextToSpeech.speak({ text, lang, voice, rate: rate * 0.9, pitch: 1.0, volume: 1.0, queueStrategy: 1 }).catch(() => {}),
    timeout,
  ]);
};

/** 朗读一段文字，读完后返回 */
export const speak = async (text: string, lang: TtsLang = 'zh-CN', rate = 0.9) => {
  if (!text.trim()) return;
  speakingCount++;
  try {
    if (lang === 'en-US' && (await speakEnglishAudio(text))) return;
    if (isNativeApp) await speakNative(text, lang, rate);
    else await speakWeb(text, lang, rate);
  } finally {
    speakingCount--;
  }
};

/** 停止所有朗读 */
export const stopSpeaking = () => {
  if (isNativeApp) TextToSpeech.stop().catch(() => {});
  else window.speechSynthesis?.cancel();
};
