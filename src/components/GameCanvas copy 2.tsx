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
  charType?: 'uppercase' | 'lowercase' | 'mixed';
}

export default function GameCanvas({ level, speed, maxCount, customList = '', charType = 'mixed'  }: GameCanvasProps) {
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

  useEffect(() => {
    setTargets([]); 
    setCurrentTargetId(null); 
    setBullets([]); 
    setParticles([]);
    nextIdRef.current = 0;  // 重置ID计数器
  }, [charType, speed, maxCount, customList]); 
  
  const getCharPool = useCallback(() => {
    if (level === 1) {
      if (charType === 'uppercase') {
        return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      } else if (charType === 'lowercase') {
        return 'abcdefghijklmnopqrstuvwxyz'.split('');
      } else {
        return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
      }
    } else if (level === 2) {
      if (!customList.trim()) return ['wo', 'ni', 'ta', 'shi', 'bo', 'po', 'mo', 'fo'];
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

  const playFourTones = (txt: string) => {
    if (!window.speechSynthesis) return;
    ['1','2','3','4'].forEach((t, i) => {
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(txt + t);
        u.lang = 'zh-CN'; u.rate = 1.0;
        window.speechSynthesis.speak(u);
      }, i * 600);
    });
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
    targets.forEach(t => {
      const active = currentTargetId === t.id;
      ctx.font = level === 1 ? 'bold 28px monospace' : 'bold 24px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (level === 3) {
        ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
        ctx.fillText(t.text, t.x, t.y);
        if (t.currentInput) {
          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = '#10b981';
          ctx.fillText(t.currentInput, t.x, t.y+35);
        }
        if (t.pinyin && t.pinyin.length > t.currentInput.length) {
          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(t.pinyin.substring(t.currentInput.length), t.x+t.currentInput.length*12, t.y+35);
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
        ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
        ctx.fillText(t.text, t.x, t.y);
      }
    });
    drawBullets(ctx);
    drawSpaceship(ctx, canvas);
  }, [targets, currentTargetId, level, drawSpaceship, drawBullets, drawParticles]);

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTargets(prev => prev.map(t => {
      let ny = t.y + t.speed;
      if (ny > canvas.height + 30) {
        return { ...t, y: -30, x: Math.random()*(canvas.width-100)+50, currentInput: '' };
      }
      return { ...t, y: ny };
    }));
    setBullets(prev => {
      const updated: Bullet[] = [];
      const bulletsToRemove = new Set<number>();
      const targetsToRemove = new Set<number>();
      
      prev.forEach(b => {
        const tg = targets.find(t => t.id === b.targetId);
        
        // 如果目标不存在了，直接移除这个子弹
        if (!tg) {
          bulletsToRemove.add(b.id);
          return;
        }
        
        // 更新子弹的目标位置
        b.targetX = tg.x;
        b.targetY = tg.y;
        
        const dx = b.targetX - b.x, dy = b.targetY - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // 子弹击中目标
        if (dist < 12) {
          const exp = level === 3 ? tg.pinyin! : tg.text;
          if (tg.currentInput.length === exp.length) {
            createExplosion(b.targetX, b.targetY);
            if (level === 2) setTimeout(() => playFourTones(tg.text), 100);
            else if (level === 3) setTimeout(() => playHanziSound(tg.text), 100);
            // 立即重置currentTargetId以避免光标遗留
            if (currentTargetId === b.targetId) {
              setCurrentTargetId(null);
            }
            bulletsToRemove.add(b.id);
            targetsToRemove.add(b.targetId);
          }
          return;
        }
        
        // 子弹继续飞行
        if (!bulletsToRemove.has(b.id)) {
          const r = b.speed / dist;
          updated.push({ ...b, x: b.x + dx*r, y: b.y + dy*r });
        }
      });
      
      // 在所有子弹处理完后统一移除目标
      if (targetsToRemove.size > 0) {
        setTargets(pv => pv.filter(t => !targetsToRemove.has(t.id)));
      }
      
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

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k.length !== 1) return;
    setTargets(prev => {
      if (currentTargetId !== null) {
        const tg = prev.find(t => t.id === currentTargetId);
        if (tg) {
          const exp = level === 3 ? tg.pinyin! : tg.text;
          const ec = exp[tg.currentInput.length];
          if (ec && k === ec.toLowerCase()) {
            createBullet(tg.id, tg.x, tg.y);
            return prev.map(t => t.id === tg.id ? { ...t, currentInput: tg.currentInput + k } : t);
          } else {
            setCurrentTargetId(null);
            return prev.map(t => t.id === tg.id ? { ...t, currentInput: '' } : t);
          }
        }
      }
      for (const tg of prev) {
        const exp = level === 3 ? tg.pinyin! : tg.text;
        if (k === exp[0].toLowerCase()) {
          createBullet(tg.id, tg.x, tg.y);
          setCurrentTargetId(tg.id);
          return prev.map(t => t.id === tg.id ? { ...t, currentInput: level===1 ? exp : k } : t);
        }
      }
      return prev;
    });
  }, [currentTargetId, level]);

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
    setTargets([]); setCurrentTargetId(null); setBullets([]); setParticles([]);
  }, [level, customList, speed, maxCount]);

  return <div className="game-canvas-container"><canvas ref={canvasRef} className="game-canvas" /></div>;
}
