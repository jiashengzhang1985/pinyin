// 统一的朗读入口：
// - 安卓 App 里用系统原生 TTS（WebView 的 speechSynthesis 在很多手机上没声音）
// - 网页里照旧用浏览器的 speechSynthesis
// 所有朗读都返回 Promise，读完（或失败、超时）后 resolve。
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

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

// 播放一个网络音频，播完返回 true；失败或超时返回 false
const playRemote = (url: string, timeoutMs: number) =>
  new Promise<boolean>(resolve => {
    const audio = new Audio(url);
    let started = false;
    const fail = setTimeout(() => { if (!started) { audio.src = ''; resolve(false); } }, timeoutMs);
    audio.onplaying = () => { started = true; clearTimeout(fail); };
    audio.onended = () => { clearTimeout(fail); resolve(true); };
    audio.onerror = () => { clearTimeout(fail); resolve(started); };
    audio.play().catch(() => { clearTimeout(fail); resolve(false); });
  });

// 英文在 App 里先用有道词典的美式发音（单词是真人录音，国内也能访问），联网失败再用手机 TTS
const speakEnglishOnline = (text: string) =>
  playRemote(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`, 4000);

const speakNative = async (text: string, lang: TtsLang, rate: number) => {
  if (lang === 'en-US' && (await speakEnglishOnline(text))) return;
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
