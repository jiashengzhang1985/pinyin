import { useEffect, useRef, useState, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';
import usePersistedState from '@/utils/usePersistedState';
import './GameCanvas.less';

interface Target {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  currentInput: string;
  pinyin?: string;
  answer?: string;       // 第五关：需要输入的英文单词（小写）
  translation?: string;  // 第五关：中文翻译
  syllables?: string[];  // 第五关：音节拆分，如 ['let', 'tuce']
  round?: number;        // 第五关：重新掉落的次数（听写模式每次出现都要读）
  mode?: EnglishMode;    // 第三/五关：创建时所处的模式
  toned?: string;        // 第三关：带声调拼音（空格分隔），击中后弹出显示
}

export type HanziMode = 'see' | 'listen';
export type HanziUnit = 'char' | 'phrase';

export interface WordEntry {
  en: string;
  zh: string;
}

export type EnglishMode = 'en' | 'zh' | 'listen';

interface Popup {
  id: number;
  x: number;
  y: number;
  en: string;
  zh: string;
  life: number;
  decay: number;
  syllables?: string[];
  plain?: string; // 用于计算高亮的无声调文本（与 en 等长）
}

interface Banner {
  text: string;
  sub: string;
  life: number;
  decay: number;
}

// "let-tuce" → { word: 'lettuce', syllables: ['let', 'tuce'] }
const parseWord = (raw: string) => {
  const parts = raw.split('-').map(p => p.trim()).filter(Boolean);
  return { word: parts.join(''), syllables: parts.length > 1 ? parts : undefined };
};

// 标记单词中属于“本课发音”的字母位置，如 focus='c' 时 lettuce 的 c
const getFocusMask = (word: string, focus: string) => {
  const mask = new Array(word.length).fill(false);
  const lw = word.toLowerCase();
  focus.split(/[,，\s]+/).map(p => p.trim().toLowerCase()).filter(Boolean).forEach(p => {
    let i = lw.indexOf(p);
    while (i !== -1) {
      for (let k = i; k < i + p.length; k++) mask[k] = true;
      i = lw.indexOf(p, i + 1);
    }
  });
  return mask;
};

// 音节起始位置（第一个音节除外），用于在字母之间留空隙
const getSyllableBreaks = (syllables?: string[]) => {
  const breaks = new Set<number>();
  if (!syllables) return breaks;
  let pos = 0;
  syllables.forEach((sy, i) => {
    if (i > 0) breaks.add(pos);
    pos += sy.length;
  });
  return breaks;
};

// 逐个字母绘制：支持每个字母不同颜色、目标音蓝底高亮、音节间空隙
const drawLetters = (
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  opts: { size: number; color: (i: number) => string; mask?: boolean[]; breaks?: Set<number> },
) => {
  const { size, color, mask, breaks } = opts;
  const gap = Math.round(size * 0.35);
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const nBreaks = breaks ? chars.filter((_, i) => breaks.has(i)).length : 0;
  const total = widths.reduce((a, b) => a + b, 0) + nBreaks * gap;
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    if (breaks?.has(i)) x += gap;
    if (mask?.[i]) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.fillRect(x - 1, y - size * 0.62, widths[i] + 2, size * 1.24);
    }
    ctx.fillStyle = color(i);
    if (c === '_') {
      // 空格画成独立的短横线，方便数出有几个字母
      ctx.fillRect(x + widths[i] * 0.12, y + size * 0.4, widths[i] * 0.76, 3);
    } else {
      ctx.fillText(c, x, y);
    }
    x += widths[i];
  });
  ctx.textAlign = 'center';
};

interface Bullet {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetId: number;
  speed: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

// 中文鼓励语：音频由 macOS “婷婷”语音预先生成，放在 public/voice/zh/，文字同时显示在屏幕上
const ZH_CLIPS: Record<string, string> = {
  c3_1: '不错哦，继续。',
  c3_2: '对了，就这样。',
  c3_3: '嗯，打得挺准。',
  c5_1: '连着对了五个了。',
  c5_2: '五个全对，可以呀。',
  c8_1: '八个了，一个都没错。',
  c8_2: '已经连对八个了，很稳。',
  c10: '连对十个了！',
  c15: '十五个了，还没错过。',
  c20: '二十个全对，真厉害。',
  c25: '二十五个了，太稳了。',
  c30: '三十个了！休息一下也可以哦。',
  r3_1: '这一轮全对了，真不错。',
  r3_2: '这一轮一个没错，好样的。',
  r2_1: '这一轮还不错，再细心一点就更好了。',
  r2_2: '打得挺好，有几个再练练。',
  r1_1: '没关系，我们再来一轮。',
  r1_2: '慢慢来，下一轮会更好。',
};
const ZH_COMBO_CLIPS: Record<number, string[]> = {
  3: ['c3_1', 'c3_2', 'c3_3'],
  5: ['c5_1', 'c5_2'],
  8: ['c8_1', 'c8_2'],
  10: ['c10'],
  15: ['c15'],
  20: ['c20'],
  25: ['c25'],
  30: ['c30'],
};
const ZH_ROUND_CLIPS: Record<number, string[]> = {
  3: ['r3_1', 'r3_2'],
  2: ['r2_1', 'r2_2'],
  1: ['r1_1', 'r1_2'],
};
const pickOne = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// macOS 上这批中文语音机械感很重，浏览器语音回退时避开
const ROBOTIC_VOICES = /Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley/i;
const pickZhVoice = (): SpeechSynthesisVoice | undefined => {
  if (!window.speechSynthesis) return undefined;
  const zh = window.speechSynthesis
    .getVoices()
    .filter(v => /^zh[-_]CN/i.test(v.lang) && !ROBOTIC_VOICES.test(v.name));
  return (
    zh.find(v => /Natural|Online/i.test(v.name)) || // Edge 的神经网络语音，最自然
    zh.find(v => /Google/i.test(v.name)) ||
    zh.find(v => /Tingting|婷婷/i.test(v.name)) ||
    zh[0]
  );
};

const assetBase = () => (((window as any).routerBase as string) || '/').replace(/\/$/, '');

// 播放一个音频文件，播完（或失败）后返回是否成功
const playUrl = (url: string) =>
  new Promise<boolean>(resolve => {
    const audio = new Audio(url);
    const timer = setTimeout(() => resolve(false), 5000);
    audio.onended = () => { clearTimeout(timer); resolve(true); };
    audio.onerror = () => { clearTimeout(timer); resolve(false); };
    audio.play().catch(() => { clearTimeout(timer); resolve(false); });
  });

// 用浏览器语音读中文，读完后返回
const speakZhAndWait = (text: string) =>
  new Promise<void>(resolve => {
    if (!window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.9;
    const v = pickZhVoice();
    if (v) u.voice = v;
    const timer = setTimeout(resolve, 5000);
    u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
    window.speechSynthesis.speak(u);
  });

// 拼音音节对应的录音文件名：ü 写作 uu，轻声优先用 5 声录音，没有就用 1 声
const syllableFiles = (syllable: string, tone: number) => {
  const base = syllable.replace(/ü/g, 'uu');
  return tone === 0 || tone === 5 ? [`${base}5`, `${base}1`] : [`${base}${tone}`];
};

interface GameCanvasProps {
  level: 1 | 2 | 3 | 5;
  speed: number;
  maxCount: number;
  customList?: string;
  charType?: 'letter' | 'pinying' | 'mixed';
  handwritingMode?: boolean;
  currentTarget?: Target | null;
  explosions?: {id: number, x: number, y: number}[];
  showPinyin?: boolean;
  wordList?: WordEntry[];
  englishMode?: EnglishMode;
  focusLetters?: string;
  hanziMode?: HanziMode;
  hanziUnit?: HanziUnit;
}

export default function GameCanvas({
  level,
  speed,
  maxCount,
  customList = '',
  charType = 'mixed',
  handwritingMode = false,
  currentTarget = null,
  explosions = [],
  showPinyin = false,
  wordList = [],
  englishMode = 'en',
  focusLetters = '',
  hanziMode = 'see',
  hanziUnit = 'char',
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const popupIdRef = useRef(0);
  const hitIdsRef = useRef<Set<number>>(new Set()); // 防止同一目标被重复结算
  // 只保留英文非空的单词
  const validWords = wordList
    .map(w => ({ en: w.en.trim(), zh: w.zh.trim() }))
    .filter(w => w.en);
  const wordKey = JSON.stringify(validWords);

  // 第三关和第五关：连击、星星和每轮统计
  const statsRef = useRef({ hits: 0, correct: 0, wrong: 0, misses: 0, start: Date.now() });
  const comboRef = useRef(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const scored = level === 3 || level === 5;
  const isListen = (level === 5 && englishMode === 'listen') || (level === 3 && hanziMode === 'listen');
  const [totalStars, setTotalStars] = usePersistedState(`level${level}.totalStars`, 0);
  const announcedRef = useRef<Set<string>>(new Set()); // 听写模式已读过的目标
  const [currentTargetId, setCurrentTargetId] = useState<number | null>(null);
  const nextIdRef = useRef(0);
  const bulletIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastUpdateTimeRef = useRef(0);
  const spaceshipXRef = useRef(0);


  const pinyingMap: Record<string, string> = {

    'ü': '鱼',
    'a': '啊', 'b': '波', 'c': '雌', 'd': '得', 'e': '鹅',
    'f': '佛', 'g': '哥', 'h': '喝', 'i': '衣', 'j': '基',
    'k': '科', 'l': '勒', 'm': '摸', 'n': '讷', 'o': '喔',
    'p': '坡', 'q': '欺', 'r': '日', 's': '思', 't': '特', 
    'u': '乌', 'w': '巫', 'x': '希', 'y': '衣', 'z': '资',

    'sh': '思', 'ch': '蚩', 'ai': '哀', 'ei': '诶', 'ui': '威', 'ao': '熬',

    'ou': '欧', 'iu': '优', 'ie': '耶', 'üe': '约', 'er': '耳', 'an': '安',

    'en': '恩', 'in': '因', 'un': '温', 'ün': '云', 'ang': '昂', 'eng': '鞥', 'ing': '英', 'ong': '翁',
    'zhi': '知', 'chi': '吃', 'ri': '日', 'zi': '资', 'ci': '刺', 'si': '丝', 'wu': '屋', 'shi': '狮',
    'yi': '衣', 'yu': '鱼', 'ye': '耶', 'yue': '月', 'yuan': '元', 'yin': '因', 'yun': '云', 'ying': '鹰'

  };
   const pinyingList = Object.keys(pinyingMap)
  // const pinyinUnits = [
  //   // 声母
  //   'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  //   'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch',
  //   'sh', 'r', 'z', 'c', 's', 'y', 'w','ü',
  
  //   // 韵母
  //   'a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei',
  //   'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an',
  //   'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong',
  
  //   // 整体认读音节
  //   'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'wu',
  //   'yi', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'
  // ];
  const getCharPool = useCallback(() => {
    if (level === 1) {
      if (charType === 'letter') {
        return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
      } else if (charType === 'pinying') {
        return pinyingList;
      } else {
        return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
      }
    } else if (level === 2) {
      if (!customList.trim()) return pinyingList;
      return customList.split(',').map(s => s.trim()).filter(s => s);
    } else if (hanziUnit === 'phrase') {
      // 词组模式：用逗号、顿号、空格或换行分隔
      const list = customList.split(/[,，、;；\s]+/).map(s => s.trim()).filter(s => /[\u4e00-\u9fff]/.test(s));
      return list.length ? list : ['中国', '老师', '朋友'];
    } else {
      const list = customList.split('').filter(s => /[\u4e00-\u9fff]/.test(s));
      return list.length ? list : '我是中国人'.split('');
    }
  }, [level, customList, charType, hanziUnit]);

  // 每个词出现的总个数：每轮至少 5 个，且每个词次数相同
  const wordCount = Math.max(level === 5 ? validWords.length : level === 3 ? getCharPool().length : 1, 1);
  const roundSize = wordCount * Math.ceil(5 / wordCount);

  // 汉字/词组的拼音：plain 用于输入比对，syllables 用于音节间留空，toned 用于弹出显示
  const getPinyinInfo = (text: string) => {
    const plainArr = pinyin(text, { toneType: 'none', type: 'array' }) as string[];
    const tonedArr = pinyin(text, { type: 'array' }) as string[];
    const syllables: string[] = [];
    const toned: string[] = [];
    plainArr.forEach((p, i) => {
      const clean = p.toLowerCase().replace(/[^a-zü]/g, '');
      if (clean) {
        syllables.push(clean);
        toned.push((tonedArr[i] || clean).toLowerCase());
      }
    });
    return { plain: syllables.join(''), syllables, toned: toned.join(' ') };
  };

  // 洗牌发牌：每轮把列表打乱后依次发出，发完一轮再重新洗，保证每项出现机会均等
  const bagRef = useRef<number[]>([]);
  const bagKeyRef = useRef('');
  const lastIndexRef = useRef(-1);
  const drawIndex = (poolLen: number, poolKey: string): number => {
    if (poolLen <= 1) return 0;
    if (bagKeyRef.current !== poolKey) {
      bagKeyRef.current = poolKey;
      bagRef.current = [];
      lastIndexRef.current = -1;
    }
    if (bagRef.current.length === 0) {
      const bag = Array.from({ length: poolLen }, (_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // 新一轮的第一个不和上一轮最后一个重复
      if (bag[bag.length - 1] === lastIndexRef.current) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      bagRef.current = bag;
    }
    const idx = bagRef.current.pop()!;
    lastIndexRef.current = idx;
    return idx;
  };

  const createTarget = useCallback((): Target => {
    const canvas = canvasRef.current;
    if (!canvas) return { id: 0, text: '', x: 0, y: 0, speed: 0, currentInput: '' };
    if (level === 5) {
      const pool = validWords.length ? validWords : [{ en: 'apple', zh: '苹果' }];
      const w = pool[drawIndex(pool.length, JSON.stringify(pool))];
      const { word, syllables } = parseWord(w.en);
      return {
        id: nextIdRef.current++,
        text: englishMode === 'zh' ? (w.zh || word) : word,
        answer: word.toLowerCase(),
        translation: w.zh,
        syllables,
        round: 0,
        mode: englishMode,
        x: Math.random() * (canvas.width - 200) + 100,
        y: -30,
        speed: speed * 0.3 + 0.2,
        currentInput: '',
      };
    }
    const pool = getCharPool();
    const text = pool[drawIndex(pool.length, pool.join('\u0001'))];
    if (level === 3) {
      const info = getPinyinInfo(text);
      return {
        id: nextIdRef.current++,
        text,
        pinyin: info.plain,
        answer: info.plain,
        syllables: info.syllables.length > 1 ? info.syllables : undefined,
        toned: info.toned,
        round: 0,
        mode: hanziMode === 'listen' ? 'listen' : undefined,
        x: Math.random() * (canvas.width - 240) + 120,
        y: -30,
        speed: speed * 0.3 + 0.2,
        currentInput: '',
      };
    }
    return {
      id: nextIdRef.current++,
      text,
      x: Math.random() * (canvas.width - 100) + 50,
      y: -30,
      speed: speed * 0.3 + 0.2,
      currentInput: '',
    };
  }, [level, speed, getCharPool, wordKey, englishMode, hanziMode]);

  // 当前目标需要输入的内容
  const getExpected = (t: Target) => t.answer ?? (level === 3 ? t.pinyin! : t.text);

  const createBullet = (targetId: number, targetX: number, targetY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBullets(prev => [...prev, {
      id: bulletIdRef.current++,
      x: spaceshipXRef.current,
      y: canvas.height - 50,
      targetX, targetY, targetId,
      speed: 40,
    }]);
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = 1200; osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.04);
      osc.start(); osc.stop(ac.currentTime + 0.04);
    } catch (e) {}
  };

  const createExplosion = (x: number, y: number) => {
    const newP: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80;
      const spd = 2 + Math.random() * 7;
      newP.push({
        id: particleIdRef.current++, x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        size: 2 + Math.random() * 4,
      });
    }
    setParticles(prev => [...prev, ...newP]);
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = 120; osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.35);
      osc.start(); osc.stop(ac.currentTime + 0.35);
    } catch (e) {}
  };

  // const playLevel1Sound = (char: string) => {
  //   if (!window.speechSynthesis) return;
    
  //   const isUpperCase = /[A-Z]/.test(char);
  //   const isLowerCase = /[a-z]/.test(char);
  //   const isNumber = /[0-9]/.test(char);
    
  //   if (isUpperCase) {
  //     // 大写字母 - 纯正美式英语发音
  //     const utterance = new SpeechSynthesisUtterance(char);
  //     utterance.lang = 'en-US';
  //     utterance.rate = 0.9;
  //     utterance.pitch = 1.0;
  //     utterance.volume = 1.0;
  //     window.speechSynthesis.speak(utterance);
  //   } else if (isLowerCase) {
  //     // 小写字母 - 纯正中文拼音
  //     const letterToPinyin: Record<string, string> = {
  //       'a': 'a', 'b': 'be', 'c': 'se', 'd': 'de', 'e': 'e',
  //       'f': 'ef', 'g': 'ge', 'h': 'h', 'i': 'i', 'j': 'jie',
  //       'k': 'ke', 'l': 'el', 'm': 'em', 'n': 'ne', 'o': 'o',
  //       'p': 'pe', 'q': 'qiu', 'r': 'ar', 's': 's', 't': 'te',
  //       'u': 'u', 'v': 've', 'w': 'wa', 'x': 'x', 'y': 'y', 'z': 'ze',
  //     };
  //     const sound = letterToPinyin[char];
  //     if (sound) {
  //       const utterance = new SpeechSynthesisUtterance(sound);
  //       utterance.lang = 'zh-CN';
  //       utterance.rate = 0.85;
  //       utterance.pitch = 1.0;
  //       utterance.volume = 1.0;
  //       window.speechSynthesis.speak(utterance);
  //     }
  //   } else if (isNumber) {
  //     // 数字 - 中文发音
  //     const numberToChinese: Record<string, string> = {
  //       '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
  //       '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
  //     };
  //     const chinese = numberToChinese[char];
  //     if (chinese) {
  //       const utterance = new SpeechSynthesisUtterance(chinese);
  //       utterance.lang = 'zh-CN';
  //       utterance.rate = 0.85;
  //       utterance.pitch = 1.0;
  //       utterance.volume = 1.0;
  //       window.speechSynthesis.speak(utterance);
  //     }
  //   }
  // };


  const playLowerCasePinyin = (char: string) => {
    // const letterNames: Record<string, string> = {
    //   'a': '啊', 'b': '波', 'c': '雌', 'd': '得', 'e': '鹅',
    //   'f': '佛', 'g': '哥', 'h': '喝', 'i': '衣', 'j': '基',
    //   'k': '科', 'l': '勒', 'm': '摸', 'n': '讷', 'o': '喔',
    //   'p': '坡', 'q': '欺', 'r': '日', 's': '思', 't': '特', 'ü': '鱼',
    //   'u': '乌', 'v': '鱼', 'w': '巫', 'x': '希', 'y': '衣', 'z': '资',

    //   'sh': '思', 'ch': '蚩', 'ai': '哀', 'ei': '诶', 'ui': '威', 'ao': '熬',

    //   'ou': '欧', 'iu': '优', 'ie': '耶', 'üe': '约', 'er': '耳', 'an': '安',

    //   'en': '恩', 'in': '因', 'un': '温', 'ün': '云', 'ang': '昂', 'eng': '鞥', 'ing': '英', 'ong': '翁',
    //   'zhi': '知', 'chi': '吃', 'ri': '日', 'zi': '资', 'ci': '刺', 'si': '丝', 'wu': '屋', 'shi': '狮',
    //   'yi': '衣', 'yu': '鱼', 'ye': '耶', 'yue': '月', 'yuan': '元', 'yin': '因', 'yun': '云', 'ying': '鹰'

    // };
    console.log('Playing pinyin sound for:', char);
    const name = pinyingMap[char];
    if (name) {
      const utterance = new SpeechSynthesisUtterance(name);
      utterance.lang = 'zh-CN';
      const zhVoice = pickZhVoice();
      if (zhVoice) utterance.voice = zhVoice;
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);

    }
  }
  // 美式英语发音
  const speakEnglish = (text: string, rate = 0.85) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const speakWithVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // 按优先级选择最好的英语语音
      const bestVoice =
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
        voices.find(v => v.lang === 'en-US' && v.localService) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en'));
      if (bestVoice) utterance.voice = bestVoice;
      window.speechSynthesis.speak(utterance);
    };

    // 某些浏览器需要等待语音列表加载
    if (window.speechSynthesis.getVoices().length > 0) {
      speakWithVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speakWithVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  };

  const playLevel1Sound = (char: string) => {
    if (!window.speechSynthesis) return;
    
  //  const isUpperCase = /[A-Z]/.test(char);
   // const isLetter = /[a-zA-Z]/.test(char);

   console.log('Playing letter sound for:', charType);
    const isLetter = /^[a-zA-Z]$/.test(char) && charType !== 'pinying';
  //  const isLowerCase = /[a-z]/.test(char);
    const isPinYing = pinyingList.includes(char);
    const isNumber = /[0-9]/.test(char);
      if (isLetter) {
          console.log('Playing letter sound for:', char);
      // 大写字母 - 选择最好的美式英语语音
          speakEnglish(char);
      }else if (isPinYing) {
          console.log('Playing pinyin sound for:', char);
          playLowerCasePinyin(char);
      // const letterNames: Record<string, string> = {
      //   'a': '啊', 'b': '波', 'c': '呲', 'd': '的', 'e': '鹅',
      //   'f': '佛', 'g': '哥', 'h': '喝', 'i': '衣', 'j': '基',
      //   'k': '科', 'l': '勒', 'm': '摸', 'n': '讷', 'o': '喔',
      //   'p': '坡', 'q': '七', 'r': '日', 's': '思', 't': '特',
      //   'u': '乌', 'v': '吕', 'w': '巫', 'x': '希', 'y': '衣', 'z': '资',
      // };
      // const name = letterNames[char];
      // if (name) {
      //   const utterance = new SpeechSynthesisUtterance(name);
      //   utterance.lang = 'zh-CN';
      //   utterance.rate = 0.8;
      //   window.speechSynthesis.speak(utterance);

      // }
    }else if (isNumber) {
      // 数字用中文
      const numberToChinese: Record<string, string> = {
        '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
        '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
      };
      const chinese = numberToChinese[char];
      if (chinese) {
        const utterance = new SpeechSynthesisUtterance(chinese);
        utterance.lang = 'zh-CN';
        const zhVoice = pickZhVoice();
        if (zhVoice) utterance.voice = zhVoice;
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const playFourTones = async (txt: string) => {
    for (let tone = 1; tone <= 4; tone++) {
      try {

   //    const audio_file = `${window.routerBase || '/'}/mp3/${txt}${tone}.mp3`;
      //  const base = (window.routerBase || '/').replace(/\/$/, ''); // 去掉末尾的斜杠
       // const audio_file = `${base}/mp3/${txt}${tone}.mp3`;
       const base = (window.routerBase || '/').replace(/\/$/, ''); 
       const audio_file = `${base}/mp3/${txt}${tone}.mp3`;
   //    const audio_file = `./mp3/${txt}${tone}.mp3`;
        const audio = new Audio(audio_file);
         
   //     const audio = new Audio(`/mp3/${txt}${tone}.mp3`);
        await audio.play();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.error(`Failed to play ${txt}${tone}:`, e);
        break; // ✅ 直接跳出循环
      }
    }
  };



  // 听写模式读出目标：英文读单词，汉字读汉字/词组
  const speakTarget = (t: Target) => {
    if (level === 3) playHanziSound(t.text);
    else speakEnglish(t.answer || '', 0.8);
  };

  // 音频播放队列：读字、鼓励语依次播放，不会叠在一起
  const audioChainRef = useRef<Promise<void>>(Promise.resolve());
  const audioBusyRef = useRef(0);
  const enqueueAudio = (task: () => Promise<void>) => {
    audioBusyRef.current++;
    audioChainRef.current = audioChainRef.current
      .then(task)
      .catch(() => {})
      .finally(() => { audioBusyRef.current--; });
  };

  // 读汉字/词组：逐个音节播放真人录音（public/mp3），缺录音时才用浏览器语音
  const playHanziSound = (hz: string) => {
    enqueueAudio(async () => {
      const chars = [...hz];
      const nums = pinyin(hz, { toneType: 'num', type: 'array' }) as string[];
      for (let i = 0; i < nums.length; i++) {
        const m = (nums[i] || '').toLowerCase().match(/^([a-zü]+)(\d)$/);
        if (!m) continue; // 标点等非汉字跳过
        let ok = false;
        for (const name of syllableFiles(m[1], Number(m[2]))) {
          if (await playUrl(`${assetBase()}/mp3/${name}.mp3`)) { ok = true; break; }
        }
        if (!ok) await speakZhAndWait(chars[i] || '');
      }
    });
  };

  // 播放一段预先生成的中文鼓励语，文件缺失时用浏览器语音读同样的文字
  const playZhClip = (id: string) => {
    enqueueAudio(async () => {
      if (!(await playUrl(`${assetBase()}/voice/zh/${id}.m4a`))) await speakZhAndWait(ZH_CLIPS[id] || '');
    });
  };

  const drawSpaceship = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const x = spaceshipXRef.current, y = canvas.height - 40;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x - 12, y + 8);
    ctx.lineTo(x + 12, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  const drawBullets = useCallback((ctx: CanvasRenderingContext2D) => {
    bullets.forEach(b => {
      const dx = b.targetX - b.x, dy = b.targetY - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const len = Math.min(40, dist);
      if (dist > 0) {
        const ex = b.x + (dx/dist) * len, ey = b.y + (dy/dist) * len;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [bullets]);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    particles.forEach(p => {
      const lr = p.life;
      let r=255, g, b;
      if (lr > 0.7) { g=255; b=200+(1-lr)*55; }
      else if (lr > 0.4) { g=200-(0.7-lr)*200; b=100; }
      else { g=140-(0.4-lr)*140; b=50; }
      ctx.globalAlpha = lr;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }, [particles]);

  // const draw = useCallback(() => {
  //   const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
  //   if (!canvas || !ctx) return;
  //   ctx.fillStyle = '#0f172a';
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  //   ctx.fillStyle = 'rgba(255,255,255,0.3)';
  //   for (let i = 0; i < 80; i++) {
  //     ctx.beginPath();
  //     ctx.arc((i*137.5)%canvas.width, (i*197.3)%canvas.height, 0.8, 0, Math.PI*2);
  //     ctx.fill();
  //   }
  //   drawParticles(ctx);
  //   targets.forEach(t => {
  //     const active = currentTargetId === t.id;
  //     ctx.font = level === 1 ? 'bold 28px monospace' : 'bold 24px monospace';
  //     ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  //     if (level === 3) {
  //       ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
  //       ctx.fillText(t.text, t.x, t.y);
  //       if (t.currentInput) {
  //         ctx.font = 'bold 48px monospace'; ctx.fillStyle = '#10b981';
  //         ctx.fillText(t.currentInput, t.x, t.y+50);
  //       }
  //       if (t.pinyin && t.pinyin.length > t.currentInput.length) {
  //         ctx.font = 'bold 48px monospace'; ctx.fillStyle = '#64748b';
  //         ctx.fillText(t.pinyin.substring(t.currentInput.length), t.x+t.currentInput.length*28, t.y+50);
  //       }
  //     } else if (level === 2) {
  //       const il = t.currentInput.length;
  //       if (il > 0) {
  //         ctx.fillStyle = '#10b981';
  //         ctx.fillText(t.text.substring(0, il), t.x-(t.text.length-il)*9, t.y);
  //       }
  //       if (il < t.text.length) {
  //         ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
  //         ctx.fillText(t.text.substring(il), t.x+il*9, t.y);
  //       }
  //     } else {
  //       ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
  //       ctx.fillText(t.text, t.x, t.y);
  //     }
  //   });
  //   drawBullets(ctx);
  //   drawSpaceship(ctx, canvas);
  // }, [targets, currentTargetId, level, drawSpaceship, drawBullets, drawParticles]);

  const drawExplosions = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!handwritingMode) return;

    explosions.forEach(explosion => {
      // 创建爆炸粒子效果
      const particleCount = 30;
      const centerX = explosion.x;
      const centerY = explosion.y;

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const distance = Math.random() * 50;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        // 随机颜色
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];

        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 4 + 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 中心爆炸效果
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [handwritingMode, explosions]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc((i*137.5)%canvas.width, (i*197.3)%canvas.height, 0.8, 0, Math.PI*2);
      ctx.fill();
    }
    drawParticles(ctx);

    // 在手写模式下，高亮当前目标
    targets.forEach(t => {
      const active = handwritingMode
        ? currentTarget?.id === t.id
        : currentTargetId === t.id;

      ctx.font = level === 1 ? 'bold 28px monospace' : 'bold 24px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      if (handwritingMode) {
        // 手写模式下的特殊显示
        ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
        ctx.fillText(t.text, t.x, t.y);

        if (active) {
          // 为目标添加高亮边框
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.strokeRect(t.x - 30, t.y - 30, 60, 60);
        }
      } else if (level === 5) {
        const exp = t.answer || '';
        const word = englishMode === 'zh' ? exp : t.text;
        const n = t.currentInput.length;
        const mask = getFocusMask(word, focusLetters);
        const breaks = getSyllableBreaks(t.syllables);
        const pending = active ? '#fbbf24' : '#e2e8f0';
        // 已打字母：绿色；高亮底色上用浅绿保证看得清
        const typedColor = (i: number) => (mask[i] ? '#d1fae5' : '#10b981');
        if (englishMode === 'en') {
          // 英文模式：显示单词，已打的字母变绿，下方小字显示中文
          drawLetters(ctx, word, t.x, t.y, {
            size: 32,
            mask,
            breaks,
            color: i => (i < n ? typedColor(i) : pending),
          });
          if (t.translation) {
            ctx.font = '18px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(t.translation, t.x, t.y + 32);
          }
        } else {
          if (englishMode === 'zh') {
            // 中文模式：显示中文，下方显示孩子已经打出的字母（不给提示）
            ctx.font = 'bold 32px sans-serif';
            ctx.fillStyle = pending;
            ctx.fillText(t.text, t.x, t.y);
            if (n > 0) {
              drawLetters(ctx, exp.substring(0, n), t.x, t.y + 42, {
                size: 32,
                mask: mask.slice(0, n),
                color: typedColor,
              });
            }
          } else {
            // 听写模式：只显示喇叭和空格，已打的字母填进去
            ctx.font = '30px sans-serif';
            ctx.fillStyle = pending;
            ctx.fillText('🔊', t.x, t.y);
            const shown = exp.substring(0, n) + '_'.repeat(exp.length - n);
            drawLetters(ctx, shown, t.x, t.y + 42, {
              size: 30,
              mask: mask.map((m, i) => m && i < n),
              breaks,
              color: i => (i < n ? typedColor(i) : pending),
            });
          }
        }
      } else if (level === 3) {
        const py = t.pinyin || '';
        const n = t.currentInput.length;
        const mask = getFocusMask(py, focusLetters);
        const breaks = getSyllableBreaks(t.syllables);
        const pending = active ? '#fbbf24' : '#e2e8f0';
        const typedColor = (i: number) => (mask[i] ? '#d1fae5' : '#10b981');
        if (hanziMode === 'listen') {
          // 听音模式：不显示汉字，只显示喇叭和拼音空格
          ctx.font = '30px sans-serif';
          ctx.fillStyle = pending;
          ctx.fillText('🔊', t.x, t.y);
          const shown = py.substring(0, n) + '_'.repeat(py.length - n);
          drawLetters(ctx, shown, t.x, t.y + 50, {
            size: 40,
            mask: mask.map((m, i) => m && i < n),
            breaks,
            color: i => (i < n ? typedColor(i) : pending),
          });
        } else {
          ctx.font = 'bold 32px sans-serif';
          ctx.fillStyle = pending;
          ctx.fillText(t.text, t.x, t.y);
          // 已打的拼音变绿；开了拼音提示时，未打的部分用灰色显示
          const shown = showPinyin ? py : py.substring(0, n);
          if (shown) {
            drawLetters(ctx, shown, t.x, t.y + 50, {
              size: 40,
              mask: showPinyin ? mask : mask.slice(0, n),
              breaks: showPinyin ? breaks : getSyllableBreaks(t.syllables?.length ? t.syllables : undefined),
              color: i => (i < n ? typedColor(i) : '#64748b'),
            });
          }
        }
      } else if (level === 2) {
        const il = t.currentInput.length;
        if (il > 0) {
          ctx.fillStyle = '#10b981';
          ctx.fillText(t.text.substring(0, il), t.x-(t.text.length-il)*9, t.y);
        }
        if (il < t.text.length) {
          ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
          ctx.fillText(t.text.substring(il), t.x+il*9, t.y);
        }
      } else {
        // Level 1
        const active = currentTargetId === t.id;

        // 如果是拼音模式且有输入进度，需要显示
        if (charType === 'pinying' && t.currentInput) {
          // 已输入部分（绿色）
          ctx.fillStyle = '#10b981';
          const inputWidth = t.currentInput.length * 16;
          ctx.fillText(t.currentInput, t.x - (t.text.length - t.currentInput.length) * 8, t.y);

          // 未输入部分
          if (t.currentInput.length < t.text.length) {
            ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
            ctx.fillText(t.text.substring(t.currentInput.length), t.x + t.currentInput.length * 8, t.y);
          }
        } else {
          // 字母/混合模式，或没有输入
          ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
          ctx.fillText(t.text, t.x, t.y);
        }
      }
    });

    drawBullets(ctx);
    drawSpaceship(ctx, canvas);
    drawExplosions(ctx);

    // 第五关：击中后弹出 “英文 中文”
    popups.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      drawLetters(ctx, p.en, p.x, p.y, {
        size: 40,
        mask: getFocusMask(p.plain ?? p.en, focusLetters),
        breaks: getSyllableBreaks(p.syllables),
        color: () => '#fbbf24',
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (p.zh) {
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(p.zh, p.x, p.y + 44);
      }
    });
    ctx.globalAlpha = 1;

    if (scored) {
      // 左上角：累计星星、本轮进度、连击
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`⭐ ${totalStars}`, 16, 14);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`本轮 ${statsRef.current.hits}/${roundSize}`, 16, 42);
      if (comboRef.current >= 2) {
        ctx.fillStyle = '#f472b6';
        ctx.fillText(`连击 ×${comboRef.current}`, 16, 70);
      }
      if (isListen) {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('按空格再听一遍', 16, canvas.height - 30);
      }
      // 连击鼓励
      if (banner) {
        ctx.globalAlpha = Math.min(1, banner.life * 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const scale = 1 + (1 - banner.life) * 0.15;
        // 文字过长时缩小字号，保证不超出画布
        const fit = (text: string, size: number) => {
          ctx.font = `bold ${size}px sans-serif`;
          const w = ctx.measureText(text).width;
          const max = canvas.width * 0.9;
          if (w > max) ctx.font = `bold ${Math.floor((size * max) / w)}px sans-serif`;
        };
        fit(banner.text, Math.round((/[\u4e00-\u9fff]/.test(banner.text) ? 44 : 56) * scale));
        ctx.fillStyle = '#f472b6';
        ctx.fillText(banner.text, canvas.width / 2, canvas.height * 0.35);
        fit(banner.sub, 24);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(banner.sub, canvas.width / 2, canvas.height * 0.35 + 50);
        ctx.globalAlpha = 1;
      }
    }
  }, [targets, currentTargetId, level, drawSpaceship, drawBullets, drawParticles, handwritingMode, currentTarget, explosions, popups, englishMode, showPinyin, charType, focusLetters, banner, totalStars, roundSize, hanziMode, scored, isListen]);

  // 连击达到一定数量时的鼓励语
  // 第五关用英文，第三关用中文
  // 返回要显示的文字和播放方式；第三关用预先生成的中文语音
  const praiseFor = (combo: number): { text: string; play: () => void } | null => {
    if (level === 3) {
      let ids = ZH_COMBO_CLIPS[combo];
      if (!ids && combo > 30 && combo % 10 === 0) ids = ['c30'];
      if (!ids) return null;
      const id = pickOne(ids);
      return { text: ZH_CLIPS[id], play: () => playZhClip(id) };
    }
    let en = '';
    if (combo === 3) en = 'Good!';
    else if (combo === 5) en = 'Great!';
    else if (combo === 8) en = 'Excellent!';
    else if (combo >= 10 && combo % 5 === 0) en = 'Amazing!';
    return en ? { text: en, play: () => speakEnglish(en) } : null;
  };

  // 第三/五关击中后的统一处理：连击、鼓励、本轮计数
  const recordHit = () => {
    const st = statsRef.current;
    st.hits++;
    comboRef.current++;
    const praise = praiseFor(comboRef.current);
    if (praise) {
      setBanner({ text: praise.text, sub: `连击 ×${comboRef.current}`, life: 1, decay: 1 / 30 });
      setTimeout(praise.play, 150);
    }
    if (st.hits >= roundSize) finishRound();
  };

  // 第五关击中：先按音节慢读（如果有拆分），再正常读一遍
  const sayWord = (word: string, syllables?: string[]) => {
    if (syllables) syllables.forEach(sy => speakEnglish(sy, 0.6));
    speakEnglish(word);
  };

  // 一轮结束：不暂停游戏，只在屏幕中间飘过星级并累计星星，然后直接开始下一轮
  const finishRound = () => {
    const st = statsRef.current;
    const keys = st.correct + st.wrong;
    const accuracy = keys === 0 ? 1 : st.correct / keys;
    const stars = accuracy >= 0.95 && st.misses === 0 ? 3 : accuracy >= 0.8 && st.misses <= 2 ? 2 : 1;
    statsRef.current = { hits: 0, correct: 0, wrong: 0, misses: 0, start: Date.now() };
    setTotalStars(v => v + stars);
    setTimeout(() => {
      const zhId = level === 3 ? pickOne(ZH_ROUND_CLIPS[stars]) : '';
      setBanner({
        text: '⭐'.repeat(stars),
        sub: zhId
          ? `${ZH_CLIPS[zhId]}（正确率 ${Math.round(accuracy * 100)}%）`
          : `本轮完成 · 正确率 ${Math.round(accuracy * 100)}%`,
        life: 1,
        decay: 1 / 75,
      });
      if (zhId) playZhClip(zhId);
      else speakEnglish(stars === 3 ? 'Perfect!' : stars === 2 ? 'Well done!' : 'Good try!');
    }, 600);
  };


  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (scored) {
      // 掉到底部没打中：算漏掉，连击中断
      targets.forEach(t => {
        if (t.y + t.speed > canvas.height + 30) {
          statsRef.current.misses++;
          comboRef.current = 0;
        }
      });
    }
    setTargets(prev => prev.map(t => {
      let ny = t.y + t.speed;
      if (ny > canvas.height + 30) {
        // 如果这个目标被锁定了，解除锁定
        if (currentTargetId === t.id) {
          setCurrentTargetId(null);
        }
        const margin = scored ? 110 : 50;
        return {
          ...t,
          y: -30,
          x: Math.random() * (canvas.width - margin * 2) + margin,
          currentInput: '',
          round: (t.round || 0) + 1,
        };
      }
      return { ...t, y: ny };
    }));
    setBullets(prev => {
      const updated: Bullet[] = [];
      
      prev.forEach(b => {
        const tg = targets.find(t => t.id === b.targetId);
        
        // 如果目标不存在了，直接移除子弹
        if (!tg) {
          return; // 子弹不加入 updated，自动移除
        }
        
        // 更新目标位置
        b.targetX = tg.x;
        b.targetY = tg.y;
        
        const dx = b.targetX - b.x, dy = b.targetY - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 20) {
          // 子弹击中目标 - 检查是否完成
          const exp = getExpected(tg);
        //  const exp = level >= 2 ? tg.pinyin! : tg.text;
          if (tg.currentInput.length === exp.length) {
            if (hitIdsRef.current.has(tg.id)) return;
            hitIdsRef.current.add(tg.id);
            // 完成！移除目标和子弹
            createExplosion(b.targetX, b.targetY);
            
            if (level === 1) {
              setTimeout(() => playLevel1Sound(tg.text), 100);
            } else if (level === 2) {
              setTimeout(() => playFourTones(tg.text), 100);
            } else if (level === 3) {
              setTimeout(() => playHanziSound(tg.text), 100);
              const px = Math.min(Math.max(b.targetX, 140), canvas.width - 140);
              const py = Math.min(Math.max(b.targetY, 60), canvas.height - 120);
              const toned = tg.toned || tg.pinyin || '';
              setPopups(pp => [...pp, {
                id: popupIdRef.current++,
                x: px, y: py,
                en: toned,
                plain: (tg.syllables || [tg.pinyin || '']).join(' '),
                zh: tg.text,
                life: 1,
                decay: 1 / 24,
              }]);
              recordHit();
            } else if (level === 5) {
              const word = englishMode === 'zh' ? (tg.answer || '') : tg.text;
              const syllables = tg.syllables;
              setTimeout(() => sayWord(word, syllables), 100);
              const px = Math.min(Math.max(b.targetX, 120), canvas.width - 120);
              const py = Math.min(Math.max(b.targetY, 60), canvas.height - 120);
              setPopups(pp => [...pp, {
                id: popupIdRef.current++,
                x: px, y: py,
                en: word,
                zh: tg.translation || '',
                life: 1,
                // 有音节慢读时停留久一点，等读完
                decay: syllables ? 1 / 60 : 1 / 24,
                syllables,
              }]);
              recordHit();
            }
            
            setTargets(pv => pv.filter(t => t.id !== b.targetId));
            // 子弹不加入 updated，自动移除
            return;
          } else {
            // 未完成就击中了，移除子弹但保留目标
            return;
          }
        }
        
        // 子弹继续飞行
        const r = b.speed / dist;
        updated.push({ ...b, x: b.x + dx*r, y: b.y + dy*r });
      });
      
      return updated;
    });
    setParticles(prev => prev.map(p => ({
      ...p, x: p.x+p.vx, y: p.y+p.vy,
      vy: p.vy+0.08, vx: p.vx*0.98,
      life: p.life-0.035
    })).filter(p => p.life > 0));
    // 弹出文字约 0.8 秒后消失，并缓慢上浮
    setPopups(prev => prev.length === 0 ? prev : prev
      .map(p => ({ ...p, y: p.y - 0.8, life: p.life - p.decay }))
      .filter(p => p.life > 0));
    setBanner(prev => (prev && prev.life > 0.03 ? { ...prev, life: prev.life - prev.decay } : null));
    if (currentTargetId !== null) {
      const tg = targets.find(t => t.id === currentTargetId);
      if (tg) spaceshipXRef.current += (tg.x - spaceshipXRef.current) * 0.15;
    }
  }, [currentTargetId, targets, level, englishMode, roundSize, scored]);

  const gameLoop = useCallback((t: number) => {
    if (t - lastUpdateTimeRef.current >= 1000/30) {
      update();
      lastUpdateTimeRef.current = t;
    }
    draw();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  // const handleKeyPress = useCallback((e: KeyboardEvent) => {
  //   const k = e.key.toLowerCase();
  //   if (k.length !== 1) return;
  //   setTargets(prev => {
  //     if (currentTargetId !== null) {
  //       const tg = prev.find(t => t.id === currentTargetId);
  //       if (tg) {
  //         const exp = level === 3 ? tg.pinyin! : tg.text;
  //         const ec = exp[tg.currentInput.length];
  //         if (ec && k === ec.toLowerCase()) {
  //           createBullet(tg.id, tg.x, tg.y);
  //           return prev.map(t => t.id === tg.id ? { ...t, currentInput: tg.currentInput + k } : t);
  //         } else {
  //           setCurrentTargetId(null);
  //           return prev.map(t => t.id === tg.id ? { ...t, currentInput: '' } : t);
  //         }
  //       }
  //     }
  //     for (const tg of prev) {
  //       const exp = level === 3 ? tg.pinyin! : tg.text;
  //       if (k === exp[0].toLowerCase()) {
  //         createBullet(tg.id, tg.x, tg.y);
  //         setCurrentTargetId(tg.id);
  //         return prev.map(t => t.id === tg.id ? { ...t, currentInput: level===1 ? exp : k } : t);
  //       }
  //     }
  //     return prev;
  //   });
  // }, [currentTargetId, level]);
  // const handleKeyPress = useCallback((e: KeyboardEvent) => {
  //   let k = e.key.toLowerCase();
  //   if (k.length !== 1) return;
    
  //   // ü 的映射：v → ü（适用于 Level1 拼音模式和 Level2）
  //   if (k === 'v' && (level === 2 || (level === 1 && charType === 'pinying'))) {
  //     k = 'ü';
  //   }
    
  //   setTargets(prev => {
  //     if (currentTargetId !== null) {
  //       const tg = prev.find(t => t.id === currentTargetId);
  //       if (tg) {
  //         const exp = level === 3 ? tg.pinyin! : tg.text;
  //         const ec = exp[tg.currentInput.length];
  //         if (ec && k === ec.toLowerCase()) {
  //           createBullet(tg.id, tg.x, tg.y);
  //           const newInput = tg.currentInput + k;
            
  //           // 检查是否完成
  //           if (newInput.length === exp.length) {
  //             // 完成，但不在这里移除，等子弹击中时移除
  //           }
            
  //           return prev.map(t => t.id === tg.id ? { ...t, currentInput: newInput } : t);
  //         } else {
  //           setCurrentTargetId(null);
  //           return prev.map(t => t.id === tg.id ? { ...t, currentInput: '' } : t);
  //         }
  //       }
  //     }
      
  //     // 查找新目标
  //     for (const tg of prev) {
  //       const exp = level === 3 ? tg.pinyin! : tg.text;
  //       if (k === exp[0].toLowerCase()) {
  //         createBullet(tg.id, tg.x, tg.y);
          
  //         // Level1 的特殊处理
  //         if (level === 1) {
  //           // 如果是拼音模式，需要锁定并继续输入
  //           if (charType === 'pinying') {
  //             setCurrentTargetId(tg.id);
  //             return prev.map(t => t.id === tg.id ? { ...t, currentInput: k } : t);
  //           } else {
  //             // 字母/混合模式，单字符直接完成
  //             setCurrentTargetId(tg.id);
  //             return prev.map(t => t.id === tg.id ? { ...t, currentInput: exp } : t);
  //           }
  //         } else {
  //           // Level2/3 正常锁定
  //           setCurrentTargetId(tg.id);
  //           return prev.map(t => t.id === tg.id ? { ...t, currentInput: k } : t);
  //         }
  //       }
  //     }
  //     return prev;
  //   });
  // }, [currentTargetId, level, charType]);


  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // 在设置面板里打字时，不触发游戏
    const el = e.target as HTMLElement | null;
    const isTextInput =
      el?.tagName === 'TEXTAREA' ||
      el?.isContentEditable ||
      (el?.tagName === 'INPUT' &&
        !['radio', 'checkbox', 'range', 'button', 'submit'].includes((el as HTMLInputElement).type));
    if (isTextInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    let k = e.key.toLowerCase();
    if (k.length !== 1) return;

    if (scored) {
      if (k === ' ') e.preventDefault(); // 避免空格滚动页面
      if (level === 3 && k === 'v') k = 'ü'; // 拼音里用 v 打 ü
      // 听写模式：空格再读一遍（锁定的目标，否则最下面的那个）
      if (k === ' ' && isListen) {
        const locked = targets.find(t => t.id === currentTargetId);
        const nextIsSpace = locked && (locked.answer || '')[locked.currentInput.length] === ' ';
        if (!nextIsSpace) {
          const tg = locked || [...targets].sort((a, b) => b.y - a.y)[0];
          if (tg) speakTarget(tg);
          return;
        }
      }
      setTargets(prev => {
        if (currentTargetId !== null) {
          const tg = prev.find(t => t.id === currentTargetId);
          if (tg) {
            const exp = tg.answer || '';
            if (tg.currentInput.length >= exp.length) return prev;
            if (k === exp[tg.currentInput.length]) {
              statsRef.current.correct++;
              createBullet(tg.id, tg.x, tg.y);
              return prev.map(t => t.id === tg.id ? { ...t, currentInput: t.currentInput + k } : t);
            }
            // 打错字母：保留进度，只是不前进；连击中断
            statsRef.current.wrong++;
            comboRef.current = 0;
            return prev;
          }
        }
        // 选一个首字母匹配、位置最低（最紧急）的目标
        const candidates = prev
          .filter(t => (t.answer || '')[0] === k)
          .sort((a, b) => b.y - a.y);
        const tg = candidates[0];
        if (!tg) {
          // 屏幕上有目标但没有一个以这个字母开头：算打错
          if (prev.length > 0) {
            statsRef.current.wrong++;
            comboRef.current = 0;
          }
          return prev;
        }
        statsRef.current.correct++;
        createBullet(tg.id, tg.x, tg.y);
        setCurrentTargetId(tg.id);
        return prev.map(t => t.id === tg.id ? { ...t, currentInput: k } : t);
      });
      return;
    }
    
    // ü 的映射：v → ü（适用于 Level1 拼音模式和 Level2）
    if (k === 'v' && (level === 2 || (level === 1 && charType === 'pinying'))) {
      k = 'ü';
    }
    
    setTargets(prev => {
      if (currentTargetId !== null) {
        const tg = prev.find(t => t.id === currentTargetId);
        if (tg) {
          const exp = tg.text;
          const ec = exp[tg.currentInput.length];
          if (ec && k === ec.toLowerCase()) {
            createBullet(tg.id, tg.x, tg.y);
            const newInput = tg.currentInput + k;
            
            // 检查是否完成
            if (newInput.length === exp.length) {
              // 完成，但不在这里移除，等子弹击中时移除
            }
            
            return prev.map(t => t.id === tg.id ? { ...t, currentInput: newInput } : t);
          } else {
            setCurrentTargetId(null);
            return prev.map(t => t.id === tg.id ? { ...t, currentInput: '' } : t);
          }
        }
      }
      
      // 查找新目标
      for (const tg of prev) {
        const exp = tg.text;
        if (k === exp[0].toLowerCase()) {
          createBullet(tg.id, tg.x, tg.y);
          
          // Level1 的特殊处理
          if (level === 1) {
            // 如果是拼音模式，需要锁定并继续输入
            if (charType === 'pinying') {
              setCurrentTargetId(tg.id);
              return prev.map(t => t.id === tg.id ? { ...t, currentInput: k } : t);
            } else {
              // 字母/混合模式，单字符直接完成
              setCurrentTargetId(tg.id);
              return prev.map(t => t.id === tg.id ? { ...t, currentInput: exp } : t);
            }
          } else {
            // Level2/3 正常锁定
            setCurrentTargetId(tg.id);
            return prev.map(t => t.id === tg.id ? { ...t, currentInput: k } : t);
          }
        }
      }
      return prev;
    });
  }, [currentTargetId, level, charType, englishMode, targets, scored, isListen]);

  // 听写模式：每个单词出现（包括漏掉后重新掉落）时自动读一遍
  useEffect(() => {
    if (!isListen) return;
    targets.forEach(t => {
      const key = `${t.id}:${t.round || 0}`;
      // 只读听写模式下创建的目标；等前面的发音（如上一个词的击中发音）读完再读
      if (t.mode === 'listen' && !announcedRef.current.has(key) && !window.speechSynthesis?.speaking && audioBusyRef.current === 0) {
        announcedRef.current.add(key);
        speakTarget(t);
      }
    });
  }, [targets, isListen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const c = canvas.parentElement;
      if (c) {
        canvas.width = c.clientWidth;
        canvas.height = c.clientHeight;
        spaceshipXRef.current = canvas.width / 2;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const si = setInterval(() => {
      setTargets(p => p.length < maxCount ? [...p, createTarget()] : p);
    }, 2000 / speed);
    return () => clearInterval(si);
  }, [maxCount, speed, createTarget]);

  useEffect(() => {
    lastUpdateTimeRef.current = performance.now();
    gameLoop(performance.now());
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [gameLoop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    setTargets([]); 
    setCurrentTargetId(null); 
    setBullets([]); 
    setParticles([]);
    setPopups([]);
    setBanner(null);
    hitIdsRef.current.clear();
    announcedRef.current.clear();
    statsRef.current = { hits: 0, correct: 0, wrong: 0, misses: 0, start: Date.now() };
    comboRef.current = 0;
    nextIdRef.current = 0;
  }, [charType, speed, maxCount, customList, wordKey, englishMode, hanziMode, hanziUnit]);

  return (
    <div className="game-canvas-container">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  );
}
