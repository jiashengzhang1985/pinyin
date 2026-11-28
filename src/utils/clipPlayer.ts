// 短录音（拼音音节、英文字母、英文单词和例句发音）的无缝播放：
// - 提前下载并解码到内存（Web Audio），播放时不用再加载
// - 解码时自动找出声音真正开始和结束的位置，前后的静音都不播，一段接一段没有空隙
// 某些环境不支持 Web Audio 时返回 false，由调用方改用普通 <audio> 播放。

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

interface Clip {
  buffer: AudioBuffer;
  start: number; // 声音开始（秒）
  end: number;   // 声音结束（秒）
}

// 按 10ms 一帧算响度（先用一阶高通滤波，cutoff 赫兹以下的不算）
const frameEnergy = (x: Float32Array, sr: number, cutoff: number) => {
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = rc / (rc + 1 / sr);
  const frame = Math.max(1, Math.round(sr * 0.01));
  const energy: number[] = [];
  let prevX = 0, prevY = 0, sum = 0;
  for (let i = 0; i < x.length; i++) {
    const y = alpha * (prevY + x[i] - prevX);
    prevX = x[i];
    prevY = y;
    sum += Math.abs(y);
    if ((i + 1) % frame === 0) { energy.push(sum / frame); sum = 0; }
  }
  return energy;
};

// 找出声音的起止，去掉前后的静音：
// - 开头：整体响度或高频（s、x、f、h 等轻辅音主要在高频）明显高于背景噪声，就算开始，
//   宁可多留一点，也不能切掉轻辅音
// - 结尾：声音真正结束处（单词末尾短促的辅音、句子中间的停顿都保留，录音末尾孤立的杂音去掉）
const findSound = (buf: AudioBuffer): [number, number] => {
  const x = buf.getChannelData(0);
  const bb = frameEnergy(x, buf.sampleRate, 120);
  const hf = frameEnergy(x, buf.sampleRate, 2500);
  if (bb.length < 5) return [0, buf.duration];
  const floor = (e: number[]) => {
    const s = e.slice(1).sort((m, n) => m - n);
    return Math.max(s[Math.floor(s.length / 10)], 1e-9);
  };
  const fb = floor(bb), fh = floor(hf);
  let peak = 0;
  bb.forEach((e, i) => { if (e > bb[peak]) peak = i; });
  let first = 0;
  for (let i = 1; i < bb.length; i++) {
    if (bb[i] >= Math.max(2.5 * fb, bb[peak] * 0.02) || hf[i] >= 2.5 * fh) { first = i; break; }
  }
  // 结尾：把高于最响 8% 的帧连成段（相隔不到 0.3 秒的算同一段，
  // 这样单词末尾短促的 t、k 和句子里词与词之间的停顿都保留）；
  // 录音最末尾、和前面隔得很远的一小段（< 0.2 秒）当作杂音去掉
  const th = bb[peak] * 0.08;
  const segs: [number, number][] = [];
  bb.forEach((e, i) => {
    if (e < th) return;
    const lastSeg = segs[segs.length - 1];
    if (lastSeg && i - lastSeg[1] <= 30) lastSeg[1] = i;
    else segs.push([i, i]);
  });
  let lastSeg = segs[segs.length - 1] || [peak, peak];
  if (segs.length > 1 && lastSeg[1] - lastSeg[0] < 20 && lastSeg[1] >= bb.length - 20) lastSeg = segs[segs.length - 2];
  const last = Math.max(lastSeg[1], peak);
  const start = Math.max(0, (first - 2) * 0.01);
  const end = Math.min(buf.duration, (last + 1) * 0.01 + 0.06);
  return end > start ? [start, end] : [0, buf.duration];
};

const clips = new Map<string, Promise<Clip | null>>();
const blobUrls = new Map<string, string>(); // 同一份数据的本地地址，放慢播放时用

/** 提前下载并解码一段录音（重复调用只下载一次；失败的下次调用时重试） */
export const loadClip = (url: string): Promise<Clip | null> => {
  let p = clips.get(url);
  if (!p) {
    const c = getCtx();
    p = !c
      ? Promise.resolve(null)
      : fetch(url)
          .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then(b => {
            if (!blobUrls.has(url)) blobUrls.set(url, url.startsWith('blob:') ? url : URL.createObjectURL(new Blob([b.slice(0)])));
            return c.decodeAudioData(b);
          })
          .then(buffer => {
            const [start, end] = findSound(buffer);
            return { buffer, start, end };
          })
          .catch(() => {
            clips.delete(url);
            return null;
          });
    clips.set(url, p);
  }
  return p;
};

/** 播放一段录音（去掉前后静音）；播完返回 true，不能播放返回 false */
export const playClipBuffer = async (url: string): Promise<boolean> => {
  const clip = await loadClip(url);
  const c = getCtx();
  if (!clip || !c) return false;
  if (c.state !== 'running') {
    try { await c.resume(); } catch {}
    if ((c.state as string) !== 'running') return false;
  }
  const dur = clip.end - clip.start;
  return new Promise<boolean>(resolve => {
    const src = c.createBufferSource();
    src.buffer = clip.buffer;
    src.connect(c.destination);
    const timer = setTimeout(() => resolve(true), dur * 1000 + 300);
    src.onended = () => { clearTimeout(timer); resolve(true); };
    src.start(0, clip.start, dur);
  });
};

/**
 * 放慢播放一段录音（speed 如 0.8，音调不变），同样去掉前后静音。
 * Web Audio 放慢会变调，所以这里用 <audio> 播放同一份已下载的数据。
 */
export const playClipSlow = async (url: string, speed: number): Promise<boolean> => {
  const clip = await loadClip(url);
  const src = blobUrls.get(url);
  if (!clip || !src) return false;
  return new Promise<boolean>(resolve => {
    const audio = new Audio(src);
    (audio as any).preservesPitch = true;
    (audio as any).webkitPreservesPitch = true;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(fail);
      clearTimeout(stop);
      audio.pause();
      resolve(ok);
    };
    const fail = setTimeout(() => finish(false), 3000);
    let stop: ReturnType<typeof setTimeout> | undefined;
    audio.onloadedmetadata = () => {
      audio.currentTime = clip.start;
      audio.playbackRate = speed;
      audio.play().catch(() => finish(false));
    };
    audio.onplaying = () => {
      clearTimeout(fail);
      clearTimeout(stop);
      stop = setTimeout(() => finish(true), ((clip.end - audio.currentTime) / speed) * 1000);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
  });
};

export const assetBase = () => (((window as any).routerBase as string) || '/').replace(/\/$/, '');

// 播放一个音频文件，播完（或失败）后返回是否成功（不支持 Web Audio 时的后备）
export const playUrl = (url: string) =>
  new Promise<boolean>(resolve => {
    const audio = new Audio(url);
    const timer = setTimeout(() => resolve(false), 5000);
    audio.onended = () => { clearTimeout(timer); resolve(true); };
    audio.onerror = () => { clearTimeout(timer); resolve(false); };
    audio.play().catch(() => { clearTimeout(timer); resolve(false); });
  });

/** 播放 public 下的录音（路径如 mp3/dui4.mp3），去掉前后静音 */
export const playClip = async (path: string) =>
  (await playClipBuffer(`${assetBase()}/${path}`)) || playUrl(`${assetBase()}/${path}`);

/** 提前下载并解码 public 下的录音 */
export const preloadClip = (path: string) => { loadClip(`${assetBase()}/${path}`); };

// 拼音音节对应的录音文件名：ü 写作 uu，轻声优先用 5 声录音，没有就用 1 声
export const syllableFiles = (syllable: string, tone: number) => {
  const base = syllable.replace(/ü/g, 'uu');
  return tone === 0 || tone === 5 ? [`${base}5`, `${base}1`] : [`${base}${tone}`];
};
