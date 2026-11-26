// 击中词组/单词后读一句带这个词的例句。
// 例句由免费的大模型 API 生成，结果保存在本机，同一个词只请求一次；
// 在配置面板里可以查看、手工修改或重新生成。
// 两家服务：国外用 Google Gemini，国内用智谱 GLM（Gemini 在国内连不上）。
// 按设备时区判断先用哪家，失败了再换另一家；两个 Key 都没有时不读例句。
//   Gemini Key：https://aistudio.google.com/apikey
//   智谱 Key：  https://open.bigmodel.cn （注册后在“API Keys”里创建，GLM-4.5-Flash 等 Flash 模型免费）
import { useEffect, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Key 不进 Git（仓库公开会被自动停用）：本地放在 .env.local，Netlify 在环境变量里配置
const GEMINI_API_KEY: string = process.env.GEMINI_API_KEY || '';
const ZHIPU_API_KEY: string = process.env.ZHIPU_API_KEY || '';
// 轻量模型够用且快；第一个失败（繁忙/下线）时依次换下一个
const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const ZHIPU_MODELS = ['glm-4.5-flash', 'glm-4-flash-250414', 'glm-4-flash'];

export type SentenceLang = 'en' | 'zh';

export interface Sentence {
  text: string;         // 例句
  translation?: string; // 英文例句的中文翻译
}

export type SentenceStatus = 'ready' | 'loading' | 'failed' | 'none';

const CACHE_PREFIX = 'sentence.v2.'; // 改提示词后升版本，旧缓存作废
// 英文单词连同中文意思一起作为缓存键：改了中文意思（比如一行从“pencil 铅笔”改成“how 怎么”）就会重新生成
const cacheKey = (lang: SentenceLang, word: string, hint?: string) =>
  `${CACHE_PREFIX}${lang}.${word.trim().toLowerCase()}${hint?.trim() ? `|${hint.trim()}` : ''}`;

// 保存的列表可以为空数组：表示家长把例句全删了，这个词不读例句，也不再自动生成
const memory = new Map<string, Sentence[]>();
const inflight = new Map<string, Promise<Sentence[] | null>>();
const failed = new Set<string>();
const turn = new Map<string, number>();

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
Each sentence must contain the word "${word}", used with its real, common English meaning.${hint ? `
The Chinese meaning "${hint}" is only a hint; if it does not match "${word}", ignore it and follow the English word.` : ''}
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

// 设备时区在中国大陆时先用国内服务
const inChina = (() => {
  try {
    return /^Asia\/(Shanghai|Chongqing|Chungking|Harbin|Urumqi|Kashgar)$/.test(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return false;
  }
})();

type Provider = 'gemini' | 'zhipu';
const coolDown: Record<Provider, number> = { gemini: 0, zhipu: 0 }; // 被限流后暂停一会儿

// 发 POST 请求：App 里走原生网络（没有浏览器跨域限制），网页里用 fetch；超时算失败
const postJson = async (url: string, headers: Record<string, string>, body: unknown, timeoutMs = 10000) => {
  const allHeaders = { 'Content-Type': 'application/json', ...headers };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url,
      headers: allHeaders,
      data: body,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs * 2,
    });
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return { status: res.status, data };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs * 2);
  try {
    const res = await fetch(url, { method: 'POST', headers: allHeaders, body: JSON.stringify(body), signal: ctrl.signal });
    return { status: res.status, data: res.ok ? await res.json() : null };
  } finally {
    clearTimeout(timer);
  }
};

// 调一家服务，返回模型输出的文字；失败返回 null
const askGemini = async (prompt: string): Promise<string | null> => {
  for (const model of GEMINI_MODELS) {
    const { status, data } = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { 'x-goog-api-key': GEMINI_API_KEY },
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9 } },
    );
    if (status === 429) { coolDown.gemini = Date.now() + 30_000; return null; }
    if (status < 200 || status >= 300) continue;
    const text: string = (data?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => (p.thought ? '' : p.text || ''))
      .join('');
    if (text) return text;
  }
  return null;
};

const askZhipu = async (prompt: string): Promise<string | null> => {
  for (const model of ZHIPU_MODELS) {
    const { status, data } = await postJson(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      { Authorization: `Bearer ${ZHIPU_API_KEY}` },
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        thinking: { type: 'disabled' }, // 不需要深度思考，关掉更快
      },
    );
    if (status === 429) { coolDown.zhipu = Date.now() + 30_000; return null; }
    if (status < 200 || status >= 300) continue;
    const text: string = data?.choices?.[0]?.message?.content || '';
    if (text) return text;
  }
  return null;
};

const providers = (): Provider[] => {
  const order: Provider[] = inChina ? ['zhipu', 'gemini'] : ['gemini', 'zhipu'];
  return order.filter(p => (p === 'gemini' ? GEMINI_API_KEY : ZHIPU_API_KEY));
};

const request = (lang: SentenceLang, word: string, hint?: string) => serial(async (): Promise<Sentence[] | null> => {
  const lw = word.toLowerCase();
  const prompt = buildPrompt(lang, word, hint);
  for (const p of providers()) {
    if (Date.now() < coolDown[p]) continue;
    try {
      const text = p === 'gemini' ? await askGemini(prompt) : await askZhipu(prompt);
      if (!text) continue;
      const list = parseLines(lang, text).filter(s => s.text.toLowerCase().includes(lw)).slice(0, 3);
      if (list.length) return list;
    } catch {}
  }
  return null;
});

const load = (lang: SentenceLang, word: string, hint?: string): Promise<Sentence[] | null> => {
  const key = cacheKey(lang, word, hint);
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
  const key = cacheKey(lang, word, hint);
  const i = turn.get(key) ?? Math.floor(Math.random() * list.length);
  turn.set(key, (i + 1) % list.length);
  return list[i % list.length];
};

// 配置面板手工修改：一行一句，英文行用 “句子 | 中文翻译”；清空表示这个词不读例句
export const saveSentencesText = (lang: SentenceLang, word: string, hint: string | undefined, text: string) => {
  writeCache(cacheKey(lang, word, hint), parseLines(lang, text));
};

// 丢掉现有例句，让 AI 重新生成
export const regenerateSentences = (lang: SentenceLang, word: string, hint?: string) => {
  const key = cacheKey(lang, word, hint);
  if (inflight.has(key)) return;
  memory.delete(key);
  try { localStorage.removeItem(key); } catch {}
  load(lang, word, hint);
};

export const sentenceState = (lang: SentenceLang, word: string, hint?: string): { status: SentenceStatus; list: Sentence[] } => {
  const key = cacheKey(lang, word, hint);
  if (inflight.has(key)) return { status: 'loading', list: [] };
  const list = readCache(key);
  if (list) return { status: list.length ? 'ready' : 'none', list };
  return { status: failed.has(key) ? 'failed' : 'loading', list: [] };
};

// 配置面板用：词表变化后（停止输入 2 秒）自动给新词生成例句，并在例句变化时刷新
export const useSentences = (lang: SentenceLang, words: { word: string; hint?: string }[]) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  const key = JSON.stringify(words);
  useEffect(() => {
    const timer = setTimeout(() => words.forEach(w => prefetchSentence(lang, w.word, w.hint)), 2000);
    return () => clearTimeout(timer);
  }, [lang, key]);
};
