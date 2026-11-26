// 短录音（拼音音节、英文字母、App 里已下载的英文发音）的无缝播放：
// 提前下载并解码到内存（Web Audio），播放时不用再加载，一段接一段没有停顿。
// 某些环境不支持时返回 false，由调用方改用普通 <audio> 播放。

let ctx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    return ctx;
  } catch {
    return null;
  }
};

// 浏览器要求用户操作后才能出声：第一次按键或点屏幕时激活
if (typeof window !== 'undefined') {
  const unlock = () => { getCtx()?.resume().catch(() => {}); };
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('pointerdown', unlock, true);
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** 提前下载并解码一段录音（重复调用只下载一次） */
export const loadClip = (url: string): Promise<AudioBuffer | null> => {
  let p = buffers.get(url);
  if (!p) {
    const c = getCtx();
    p = !c
      ? Promise.resolve(null)
      : fetch(url)
          .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then(b => c.decodeAudioData(b))
          .catch(() => {
            buffers.delete(url);
            return null;
          });
    buffers.set(url, p);
  }
  return p;
};

/** 播放一段录音，播到 endAt 秒（去掉末尾静音）；播完返回 true，不能播放返回 false */
export const playClipBuffer = async (url: string, endAt?: number): Promise<boolean> => {
  const buf = await loadClip(url);
  const c = getCtx();
  if (!buf || !c) return false;
  if (c.state !== 'running') {
    try { await c.resume(); } catch {}
    if ((c.state as string) !== 'running') return false;
  }
  const dur = endAt ? Math.min(endAt, buf.duration) : buf.duration;
  return new Promise<boolean>(resolve => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    const timer = setTimeout(() => resolve(true), dur * 1000 + 300);
    src.onended = () => { clearTimeout(timer); resolve(true); };
    src.start(0, 0, dur);
  });
};

export const assetBase = () => (((window as any).routerBase as string) || '/').replace(/\/$/, '');

// 播放一个音频文件，播完（或失败）后返回是否成功；给了 endAt（秒）就播到那里停下
export const playUrl = (url: string, endAt?: number) =>
  new Promise<boolean>(resolve => {
    const audio = new Audio(url);
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(stopTimer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 5000);
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    if (endAt) {
      audio.onplaying = () => {
        clearTimeout(stopTimer);
        stopTimer = setTimeout(() => { audio.pause(); finish(true); }, Math.max(0, endAt - audio.currentTime) * 1000);
      };
    }
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
  });

// 每个录音里声音真正结束的时间（scripts/gen-audio-ends.py 生成）。
// 录音末尾的静音长短不一，播到声音结束就停，一段接一段才没有空隙
let audioEnds: Record<string, number> = {};
const endsReady = fetch(`${assetBase()}/audio-ends.json`)
  .then(r => (r.ok ? r.json() : {}))
  .then(d => { audioEnds = d || {}; })
  .catch(() => {});

/** 播放 public 下的录音（路径如 mp3/dui4.mp3），去掉末尾静音；优先用预先解码好的，不支持时用普通播放 */
export const playClip = async (path: string) => {
  await endsReady;
  return (
    (await playClipBuffer(`${assetBase()}/${path}`, audioEnds[path])) ||
    playUrl(`${assetBase()}/${path}`, audioEnds[path])
  );
};

/** 提前下载并解码 public 下的录音 */
export const preloadClip = (path: string) => { loadClip(`${assetBase()}/${path}`); };

// 拼音音节对应的录音文件名：ü 写作 uu，轻声优先用 5 声录音，没有就用 1 声
export const syllableFiles = (syllable: string, tone: number) => {
  const base = syllable.replace(/ü/g, 'uu');
  return tone === 0 || tone === 5 ? [`${base}5`, `${base}1`] : [`${base}${tone}`];
};
