// 后台提前准备好所有声音，不等到落字、也不等到开始玩：
// - App / 网页一打开，就按保存的配置准备
// - 在配置里改了汉字、词组、单词，停手 1 秒后马上准备新的
// - 之后每分钟、以及网络恢复时再检查一遍，补上之前失败的（已准备好的直接跳过）
// 准备的内容：
//   汉字：声母、韵母、整个字的录音（解码到内存）
//   词组：每个字的录音 + AI 生成例句
//   英文单词：字母录音 + 单词发音 + AI 生成例句 + 例句发音（App 里下载到手机）
import { pinyin } from 'pinyin-pro';
import { prefetchSentence } from './exampleSentence';
import { preloadClip, syllableFiles } from './clipPlayer';
import { prepareEnglishAudio } from './tts';
import { spellHanzi } from './pinyinSpell';
import { DEFAULT_PHRASES, DEFAULT_WORDS, parseWord, splitPhrases } from './wordList';

/** 一个英文单词：字母录音 + 单词发音（例句由 prefetchSentence 准备） */
export const preloadWordSpelling = (word: string) => {
  for (const ch of new Set(word.toLowerCase())) if (/[a-z]/.test(ch)) preloadClip(`voice/en/letters/${ch}.m4a`);
  prepareEnglishAudio(word);
};

/** 一个汉字的拼读：声母、韵母、整个字 */
export const preloadHanziSpelling = (hz: string) => {
  const parts = spellHanzi(hz);
  if (parts) parts.forEach(p => preloadClip(`mp3/${syllableFiles(p.syllable, p.tone)[0]}.mp3`));
  else preloadPhrase(hz);
};

/** 一个词组每个字的录音 */
export const preloadPhrase = (hz: string) => {
  (pinyin(hz, { toneType: 'num', type: 'array' }) as string[]).forEach(py => {
    const m = (py || '').toLowerCase().match(/^([a-zü]+)(\d)$/);
    if (m) preloadClip(`mp3/${syllableFiles(m[1], Number(m[2]))[0]}.mp3`);
  });
};

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`typing-game:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

const prepareAll = () => {
  // 第四关（英语单词）
  const words = read<{ en: string; zh?: string }[]>('level5.words', DEFAULT_WORDS);
  if (Array.isArray(words)) {
    words.forEach(w => {
      const word = parseWord(w?.en || '').toLowerCase();
      if (!word) return;
      preloadWordSpelling(word);
      prefetchSentence('en', word, w.zh?.trim() || undefined);
    });
  }
  // 第三关：汉字
  const chars = read<string>('level3.list', '我是中国人');
  if (typeof chars === 'string') {
    for (const hz of new Set(chars.match(/[一-鿿]/g) || [])) preloadHanziSpelling(hz);
  }
  // 第三关：词组
  const phrases = read<string>('level3.phraseList', DEFAULT_PHRASES);
  if (typeof phrases === 'string') {
    splitPhrases(phrases).forEach(p => {
      preloadPhrase(p);
      prefetchSentence('zh', p);
    });
  }
};

/** 配置保存后调用（usePersistedState 里），停手 1 秒后准备新内容 */
let changeTimer: ReturnType<typeof setTimeout> | undefined;
export const configChanged = () => {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(prepareAll, 1000);
};

let started = false;
export const startBackgroundPrep = () => {
  if (started) return;
  started = true;
  setTimeout(prepareAll, 300);
  setInterval(prepareAll, 60_000);
  window.addEventListener('online', prepareAll);
};
