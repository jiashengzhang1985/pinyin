// App 里网络发音（有道美式英语）的本地缓存：
// 配置好单词、生成好例句后就在后台下载，保存在手机里（IndexedDB），玩的时候直接播放，离线也能用。
// 网页版不用（网页的英文用浏览器语音）。
import { CapacitorHttp } from '@capacitor/core';

const DB_NAME = 'audio-cache';
const STORE = 'clips';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const db = () =>
  (dbPromise ??= new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));

const tx = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  db().then(
    d =>
      new Promise<T | undefined>(resolve => {
        if (!d) return resolve(undefined);
        try {
          const req = fn(d.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );

// 已缓存的地址（启动时读一次全部键，之后不用每次查库）
let known: Promise<Set<string>> | null = null;
const knownKeys = () =>
  (known ??= tx('readonly', s => s.getAllKeys()).then(keys => new Set((keys || []).map(String))));

const objectUrls = new Map<string, string>();

/** 取已缓存音频的本地播放地址；没有缓存时返回 null */
export const cachedAudioUrl = async (url: string): Promise<string | null> => {
  if (objectUrls.has(url)) return objectUrls.get(url)!;
  if (!(await knownKeys()).has(url)) return null;
  const blob = await tx<Blob>('readonly', s => s.get(url));
  if (!blob) return null;
  const local = URL.createObjectURL(blob);
  objectUrls.set(url, local);
  return local;
};

const download = async (url: string) => {
  try {
    const res = await CapacitorHttp.get({ url, responseType: 'blob', connectTimeout: 10000, readTimeout: 20000 });
    if (res.status < 200 || res.status >= 300 || typeof res.data !== 'string' || res.data.length < 200) return;
    const blob = await (await fetch(`data:audio/mpeg;base64,${res.data}`)).blob();
    await tx('readwrite', s => s.put(blob, url));
    (await knownKeys()).add(url);
  } catch {}
};

// 同时最多下载 2 个；同一个地址只下载一次
const waiting: (() => void)[] = [];
const jobs = new Map<string, Promise<void>>();
let running = 0;
const pump = () => {
  while (running < 2 && waiting.length) {
    running++;
    waiting.shift()!();
  }
};

/** 在后台下载并缓存一个音频，下载完（或失败）后返回；已缓存时立即返回 */
export const cacheAudio = (url: string): Promise<void> => {
  let job = jobs.get(url);
  if (!job) {
    job = knownKeys().then(keys => {
      if (keys.has(url)) return;
      return new Promise<void>(resolve => {
        waiting.push(() =>
          download(url).finally(() => {
            running--;
            resolve();
            pump();
          }),
        );
        pump();
      });
    });
    // 失败的下次还能重试
    job.then(async () => { if (!(await knownKeys()).has(url)) jobs.delete(url); });
    jobs.set(url, job);
  }
  return job;
};
