// 击中词组/单词后读一句带这个词的例句。
// 例句由 Google Gemini 免费 API 生成，结果保存在浏览器里，同一个词只请求一次；
// 在配置面板里可以查看、手工修改或重新生成。
// Key 在 https://aistudio.google.com/apikey 免费申请；没有 Key 时不读例句。
import { useEffect, useState } from 'react';

// Key 不进 Git（仓库公开会被 Google 自动停用）：本地放在 .env.local，Netlify 在环境变量里配置 GEMINI_API_KEY
const GEMINI_API_KEY: string = process.env.GEMINI_API_KEY || '';
// 轻量模型够用且快；第一个失败（繁忙/下线）时依次换下一个
const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export type SentenceLang = 'en' | 'zh';

export interface Sentence {
  text: string;         // 例句
  translation?: string; // 英文例句的中文翻译
}

export type SentenceStatus = 'ready' | 'loading' | 'failed' | 'none';

const CACHE_PREFIX = 'sentence.v2.'; // 改提示词后升版本，旧缓存作废
const cacheKey = (lang: SentenceLang, word: string) => `${CACHE_PREFIX}${lang}.${word.trim().toLowerCase()}`;

// 保存的列表可以为空数组：表示家长把例句全删了，这个词不读例句，也不再自动生成
const memory = new Map<string, Sentence[]>();
const inflight = new Map<string, Promise<Sentence[] | null>>();
const failed = new Set<string>();
const turn = new Map<string, number>();
let coolDownUntil = 0; // 被限流后暂停一会儿再请求

// 例句变化时通知配置面板刷新
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

const readCache = (key: string): Sentence[] | undefined => {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const list = JSON.parse(raw) as Sentence[];
      if (Array.isArray(list)) {
        memory.set(key, list);
        return list;
      }
    }
  } catch {}
  return undefined;
};

const writeCache = (key: string, list: Sentence[]) => {
  memory.set(key, list);
  failed.delete(key);
  try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
  notify();
};

const buildPrompt = (lang: SentenceLang, word: string, hint?: string) =>
  lang === 'en'
    ? `Write 3 different, simple English sentences for a 7-year-old child who grew up in China and is learning English as a foreign language (beginner level, like a primary-school English textbook in China).
Each sentence must contain the word "${word}"${hint ? ` (meaning: ${hint})` : ''}.
Rules: at most 10 words per sentence. Use common, easy words a young beginner knows (family, colors, animals, food, school, play).
Simple grammar, mostly present tense, no idioms or slang. Natural, happy, kid-friendly content about a child's daily life.
Output exactly 3 lines. Each line: the English sentence, then " | ", then its simple Chinese translation.
No numbering, no quotes, no extra text.`
    : `给7岁、刚上一年级的小朋友写3个不同的句子，每句都必须包含词语“${word}”。
要求：每句不超过10个字；只用一年级小朋友认识的最常见的字；句子要短、要简单，像“我爱吃苹果。”这样；
不用成语，不用难词，不用复杂句子；内容开心、贴近孩子的生活。
只输出3行，每行一句，句末带句号或感叹号，不要编号，不要引号，不要其他内容。`;

// 一行一句；英文行用 “句子 | 中文翻译”
const parseLines = (lang: SentenceLang, raw: string): Sentence[] =>
  raw
    .split('\n')
    .map(line => line.replace(/^\s*(\d+[.)、]|[-*•])\s*/, '').trim())
    .filter(Boolean)
    .map(line => {
      if (lang === 'en') {
        const [text, translation] = line.split(/[|｜]/).map(s => s.trim().replace(/^["“]|["”]$/g, ''));
        return translation ? { text, translation } : { text };
      }
      return { text: line.replace(/^["“]|["”]$/g, '') };
    })
    .filter(s => s.text);

export const sentencesToText = (list: Sentence[]) =>
  list.map(s => (s.translation ? `${s.text} | ${s.translation}` : s.text)).join('\n');

// 同一时间只发一个请求，一次录入很多词时不会被限流
let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(task: () => Promise<T>): Promise<T> => {
  const p = queue.then(task, task);
  queue = p.then(() => new Promise(r => setTimeout(r, 500)), () => {});
  return p;
};

const request = (lang: SentenceLang, word: string, hint?: string) => serial(async (): Promise<Sentence[] | null> => {
  if (!GEMINI_API_KEY) return null;
  if (Date.now() < coolDownUntil) await new Promise(r => setTimeout(r, coolDownUntil - Date.now()));
  const lw = word.toLowerCase();
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(lang, word, hint) }] }],
            generationConfig: { temperature: 0.9 },
          }),
        },
      );
      if (res.status === 429) {
        coolDownUntil = Date.now() + 30_000;
        return null;
      }
      if (!res.ok) continue;
      const data = await res.json();
      const text: string = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: any) => (p.thought ? '' : p.text || ''))
        .join('');
      const list = parseLines(lang, text).filter(s => s.text.toLowerCase().includes(lw)).slice(0, 3);
      if (list.length) return list;
    } catch {}
  }
  return null;
});

const load = (lang: SentenceLang, word: string, hint?: string): Promise<Sentence[] | null> => {
  const key = cacheKey(lang, word);
  const cached = readCache(key);
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(key);
  if (!p) {
    failed.delete(key);
    p = request(lang, word.trim(), hint).then(list => {
      inflight.delete(key);
      if (list) writeCache(key, list);
      else { failed.add(key); notify(); } // 失败不保存，下次出现时再试
      return list;
    });
    inflight.set(key, p);
    notify();
  }
  return p;
};

// 目标刚出现、或在配置里录入新词时调用，提前在后台准备例句
export const prefetchSentence = (lang: SentenceLang, word: string, hint?: string) => {
  if (word.trim()) load(lang, word, hint);
};

// 取一句例句（多句轮流使用）；最多等 timeoutMs，超时或没有例句时返回 null
export const getSentence = async (
  lang: SentenceLang,
  word: string,
  hint?: string,
  timeoutMs = 6000,
): Promise<Sentence | null> => {
  if (!word.trim()) return null;
  const list = await Promise.race([
    load(lang, word, hint),
    new Promise<null>(r => setTimeout(() => r(null), timeoutMs)),
  ]);
  if (!list?.length) return null;
  const key = cacheKey(lang, word);
  const i = turn.get(key) ?? Math.floor(Math.random() * list.length);
  turn.set(key, (i + 1) % list.length);
  return list[i % list.length];
};

// 配置面板手工修改：一行一句，英文行用 “句子 | 中文翻译”；清空表示这个词不读例句
export const saveSentencesText = (lang: SentenceLang, word: string, text: string) => {
  writeCache(cacheKey(lang, word), parseLines(lang, text));
};

// 丢掉现有例句，让 AI 重新生成
export const regenerateSentences = (lang: SentenceLang, word: string, hint?: string) => {
  const key = cacheKey(lang, word);
  if (inflight.has(key)) return;
  memory.delete(key);
  try { localStorage.removeItem(key); } catch {}
  load(lang, word, hint);
};

export const sentenceState = (lang: SentenceLang, word: string): { status: SentenceStatus; list: Sentence[] } => {
  const key = cacheKey(lang, word);
  if (inflight.has(key)) return { status: 'loading', list: [] };
  const list = readCache(key);
  if (list) return { status: list.length ? 'ready' : 'none', list };
  return { status: failed.has(key) ? 'failed' : 'loading', list: [] };
};

// 配置面板用：词表变化后（停止输入 1 秒）自动给新词生成例句，并在例句变化时刷新
export const useSentences = (lang: SentenceLang, words: { word: string; hint?: string }[]) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  const key = JSON.stringify(words);
  useEffect(() => {
    const timer = setTimeout(() => words.forEach(w => prefetchSentence(lang, w.word, w.hint)), 1000);
    return () => clearTimeout(timer);
  }, [lang, key]);
};
