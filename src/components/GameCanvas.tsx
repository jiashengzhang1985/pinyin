import { useEffect, useRef, useState, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';
import './GameCanvas.less';

interface Target {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  currentInput: string;
  pinyin?: string;
}

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

interface GameCanvasProps {
  level: 1 | 2 | 3;
  speed: number;
  maxCount: number;
  customList?: string;
  charType?: 'letter' | 'pinying' | 'mixed';
  handwritingMode?: boolean;
  currentTarget?: Target | null;
  explosions?: {id: number, x: number, y: number}[];
  showPinyin?: boolean;
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
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
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
    } else {
      if (!customList.trim()) return '我是中国人'.split('');
      return customList.split('').filter(s => s.trim());
    }
  }, [level, customList, charType]);

  const getHanziPinyin = (hanzi: string): string => {
    const result = pinyin(hanzi, { toneType: 'none', type: 'array' });
    return result[0]?.toLowerCase() || 'unknown';
  };

  const createTarget = useCallback((): Target => {
    const canvas = canvasRef.current;
    if (!canvas) return { id: 0, text: '', x: 0, y: 0, speed: 0, currentInput: '' };
    const pool = getCharPool();
    const text = pool[Math.floor(Math.random() * pool.length)];
    return {
      id: nextIdRef.current++,
      text,
      x: Math.random() * (canvas.width - 100) + 50,
      y: -30,
      speed: speed * 0.3 + 0.2,
      currentInput: '',
      pinyin: level === 3 ? getHanziPinyin(text) : undefined,
    };
  }, [level, speed, getCharPool]);

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
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);

    }
  }
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
          const utterance = new SpeechSynthesisUtterance(char);
          utterance.lang = 'en-US';
          utterance.rate = 0.85;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          
          const speakWithVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            
            // 按优先级选择最好的英语语音
            const bestVoice = 
              // 1. 优先选择 Google US English (通常最标准)
              voices.find(v => v.name.includes('Google US English')) ||
              // 2. 其次选择系统自带的美式英语女声
              voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
              // 3. 任何美式英语本地语音
              voices.find(v => v.lang === 'en-US' && v.localService) ||
              // 4. 任何美式英语语音
              voices.find(v => v.lang === 'en-US') ||
              // 5. 任何英语语音
              voices.find(v => v.lang.startsWith('en'));
            
            if (bestVoice) {
              utterance.voice = bestVoice;
              console.log('Using voice:', bestVoice.name); // 调试用
            }
            
            window.speechSynthesis.speak(utterance);
          };
          
          // 确保语音列表已加载
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            speakWithVoice();
          } else {
            // 某些浏览器需要等待语音列表加载
            window.speechSynthesis.onvoiceschanged = () => {
              speakWithVoice();
              window.speechSynthesis.onvoiceschanged = null; // 只执行一次
            };
          }
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
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const playFourTones = async (txt: string) => {
    for (let tone = 1; tone <= 4; tone++) {
      try {
        const audio = new Audio(`/mp3/${txt}${tone}.mp3`);
        await audio.play();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.error(`Failed to play ${txt}${tone}:`, e);
        break; // ✅ 直接跳出循环
      }
    }
  };



  const playHanziSound = (hz: string) => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(hz);
    u.lang = 'zh-CN'; u.rate = 0.8;
    window.speechSynthesis.speak(u);
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
      } else if (level === 3) {
        ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
        ctx.fillText(t.text, t.x, t.y);
        if (t.currentInput) {
          ctx.font = 'bold 48px monospace'; ctx.fillStyle = '#10b981';
          ctx.fillText(t.currentInput, t.x, t.y+50);
        }
        if (showPinyin && t.pinyin && t.pinyin.length > t.currentInput.length) {
          ctx.font = 'bold 48px monospace'; ctx.fillStyle = '#64748b';
          ctx.fillText(t.pinyin.substring(t.currentInput.length), t.x+t.currentInput.length*28, t.y+50);
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
  }, [targets, currentTargetId, level, drawSpaceship, drawBullets, drawParticles, handwritingMode, currentTarget, explosions]);


  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTargets(prev => prev.map(t => {
      let ny = t.y + t.speed;
      if (ny > canvas.height + 30) {
        // 如果这个目标被锁定了，解除锁定
        if (currentTargetId === t.id) {
          setCurrentTargetId(null);
        }
        return { ...t, y: -30, x: Math.random()*(canvas.width-100)+50, currentInput: '' };
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
          const exp = level === 3 ? tg.pinyin! : tg.text;
          console.log('Expected:', tg,exp,tg.currentInput.length,exp.length);
        //  const exp = level >= 2 ? tg.pinyin! : tg.text;
          if (tg.currentInput.length === exp.length) {
            // 完成！移除目标和子弹
            createExplosion(b.targetX, b.targetY);
            
            if (level === 1) {
              setTimeout(() => playLevel1Sound(tg.text), 100);
            } else if (level === 2) {
              setTimeout(() => playFourTones(tg.text), 100);
            } else if (level === 3) {
              setTimeout(() => playHanziSound(tg.text), 100);
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
      life: p.life-0.018
    })).filter(p => p.life > 0));
    if (currentTargetId !== null) {
      const tg = targets.find(t => t.id === currentTargetId);
      if (tg) spaceshipXRef.current += (tg.x - spaceshipXRef.current) * 0.15;
    }
  }, [currentTargetId, targets, level]);

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
    let k = e.key.toLowerCase();
    if (k.length !== 1) return;
    
    // ü 的映射：v → ü（适用于 Level1 拼音模式和 Level2）
    if (k === 'v' && ( level === 2 || level === 3 || (level === 1 && charType === 'pinying'))) {
      k = 'ü';
    }
    
    setTargets(prev => {
      if (currentTargetId !== null) {
        const tg = prev.find(t => t.id === currentTargetId);
        if (tg) {
          const exp = level === 3 ? tg.pinyin! : tg.text;
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
        const exp = level === 3 ? tg.pinyin! : tg.text;
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
  }, [currentTargetId, level, charType]);
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
    nextIdRef.current = 0;
  }, [charType, speed, maxCount, customList]);

  return <div className="game-canvas-container"><canvas ref={canvasRef} className="game-canvas" /></div>;
}
