// 统一的朗读入口：
// - 英文优先用有道美式真人发音（提前加载 / App 里提前下载），不行再用系统语音
// - 安卓 App 里用系统原生 TTS（WebView 的 speechSynthesis 在很多手机上没声音）
// - 网页里用浏览器的 speechSynthesis
// 所有朗读都返回 Promise，读完（或失败、超时）后 resolve。
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { cacheAudio, cachedAudioUrl } from './audioCache';
import { assetBase, loadClip, playClipBuffer, playClipSlow } from './clipPlayer';

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

// 英文用有道词典的美式发音（单词是真人录音，国内外都能访问），网页和 App 都一样。
// 配置好单词、生成好例句后就在后台准备好，玩的时候直接播放（去掉前后静音）：
// - App：下载到手机里（离线可用），再解码到内存
// - 网页：经 Netlify 转发（/yd/，同域才能读取声音数据）下载并解码；转发不可用时退回普通预加载
// 有道读不了的句子（部分句子会报错），直接用系统语音，不再等。
const youdaoPath = (text: string) => {
  const t = text.trim().replace(/\s+/g, ' ');
  return `dictvoice?audio=${encodeURIComponent(t.includes(' ') ? t : t.toLowerCase())}&type=2`;
};
const youdaoUrl = (text: string) => `https://dict.youdao.com/${youdaoPath(text)}`;

const readyClip = new Map<string, string>();               // 已解码好的声音地址
const readyWeb = new Map<string, HTMLAudioElement>();      // 网页后备：预加载好的 <audio>
const badUntil = new Map<string, number>();                // 有道读不了，这段时间内直接用系统语音
const preparing = new Map<string, Promise<void>>();

const isBad = (key: string) => (badUntil.get(key) || 0) > Date.now();
const markBad = (key: string) => { if (navigator.onLine !== false) badUntil.set(key, Date.now() + 10 * 60_000); };

// 网页后备：普通 <audio> 预加载，等到能播放或出错
const preloadElement = (url: string) =>
  new Promise<HTMLAudioElement | null>(resolve => {
    const audio = new Audio();
    const timer = setTimeout(() => resolve(null), 8000);
    audio.preload = 'auto';
    audio.oncanplaythrough = () => { clearTimeout(timer); resolve(audio); };
    audio.onerror = () => { clearTimeout(timer); resolve(null); };
    audio.src = url;
    audio.load();
  });

/**
 * 提前准备好一段英文的发音。配置好单词、生成好例句后就在后台调用，
 * 玩的时候直接播放。重复调用只准备一次，失败的稍后重试。
 */
export const prepareEnglishAudio = (text: string): Promise<void> => {
  if (!text.trim()) return Promise.resolve();
  const key = youdaoUrl(text);
  if (readyClip.has(key) || readyWeb.has(key) || isBad(key)) return Promise.resolve();
  let p = preparing.get(key);
  if (!p) {
    p = (async () => {
      if (isNativeApp) {
        await cacheAudio(key);
        const local = await cachedAudioUrl(key);
        if (local && (await loadClip(local))) readyClip.set(key, local);
        else markBad(key);
        return;
      }
      const proxied = `${assetBase()}/yd/${youdaoPath(text)}`;
      if (await loadClip(proxied)) { readyClip.set(key, proxied); return; }
      const el = await preloadElement(key);
      if (el) readyWeb.set(key, el);
      else markBad(key);
    })().finally(() => preparing.delete(key));
    preparing.set(key, p);
  }
  return p;
};
export const preloadEnglish = prepareEnglishAudio;

const speakEnglishAudio = async (text: string, speed = 1): Promise<boolean> => {
  const key = youdaoUrl(text);
  if (isBad(key)) return false;
  // 还没准备好（刚录入）：最多等 1.5 秒，等不到就用系统语音
  if (!readyClip.has(key) && !readyWeb.has(key)) {
    await Promise.race([prepareEnglishAudio(text), new Promise(r => setTimeout(r, 1500))]);
  }
  const clip = readyClip.get(key);
  if (clip && (speed !== 1 ? await playClipSlow(clip, speed) : await playClipBuffer(clip))) return true;
  const el = readyWeb.get(key);
  if (el) {
    el.currentTime = 0;
    el.playbackRate = speed;
    (el as any).preservesPitch = true;
    if (await playElement(el, 3000)) return true;
    readyWeb.delete(key);
  }
  return false;
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

/**
 * 朗读一段文字，读完后返回。
 * rate：系统语音的语速；audioSpeed：英文录音（有道）的播放速度，小于 1 表示放慢（音调不变）
 */
export const speak = async (text: string, lang: TtsLang = 'zh-CN', rate = 0.9, audioSpeed = 1) => {
  if (!text.trim()) return;
  speakingCount++;
  try {
    if (lang === 'en-US' && (await speakEnglishAudio(text, audioSpeed))) return;
    if (isNativeApp) await speakNative(text, lang, rate);
    else await speakWeb(text, lang, rate);
  } finally {
    speakingCount--;
  }
};

/** 只用系统自带语音朗读（不联网、不下载有道录音），读完后返回。加减乘除这类固定内容用它 */
export const speakOffline = async (text: string, lang: TtsLang = 'zh-CN', rate = 0.9) => {
  if (!text.trim()) return;
  speakingCount++;
  try {
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
