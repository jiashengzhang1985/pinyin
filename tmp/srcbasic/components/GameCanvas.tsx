import { useEffect, useRef, useState, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';
import './GameCanvas.less';

interface Target {
  id: number;
  text: string; // 显示的文本（字母/拼音/汉字）
  x: number;
  y: number;
  speed: number;
  currentInput: string; // 当前已输入的内容
  pinyin?: string; // 对于汉字，存储其拼音
}

interface GameCanvasProps {
  level: 1 | 2 | 3;
  speed: number;
  maxCount: number;
  customList?: string;
}

export default function GameCanvas({ level, speed, maxCount, customList = '' }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [currentTargetId, setCurrentTargetId] = useState<number | null>(null);
  const nextIdRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const lastSpawnTimeRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);

  // 获取字符池
  const getCharPool = useCallback(() => {
    if (level === 1) {
      // 字母和数字
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    } else if (level === 2) {
      // 拼音列表
      if (!customList.trim()) {
        return ['wo', 'ni', 'ta', 'shi', 'bo', 'po', 'mo', 'fo'];
      }
      return customList.split(',').map(s => s.trim()).filter(s => s);
    } else {
      // 汉字列表
      if (!customList.trim()) {
        return '我是中国人'.split('');
      }
      return customList.split('').filter(s => s.trim());
    }
  }, [level, customList]);

  // 获取汉字的拼音（使用 pinyin-pro 库）
  const getHanziPinyin = (hanzi: string): string => {
    // 使用 pinyin-pro 获取拼音，去掉声调
    const result = pinyin(hanzi, { 
      toneType: 'none',  // 不带声调
      type: 'array'      // 返回数组
    });
    
    // 返回第一个拼音（对于多音字，取第一个读音）
    return result[0]?.toLowerCase() || 'unknown';
  };

  // 创建新目标
  const createTarget = useCallback((): Target => {
    const canvas = canvasRef.current;
    if (!canvas) return { id: 0, text: '', x: 0, y: 0, speed: 0, currentInput: '' };

    const pool = getCharPool();
    const text = pool[Math.floor(Math.random() * pool.length)];
    const id = nextIdRef.current++;

    return {
      id,
      text,
      x: Math.random() * (canvas.width - 100) + 50,
      y: -30,
      speed: speed * 0.3 + 0.2, // 速度范围: 0.5 (speed=1) 到 3.2 (speed=10)
      currentInput: '',
      pinyin: level === 3 ? getHanziPinyin(text) : undefined,
    };
  }, [level, speed, getCharPool]);

  // 播放四声
  const playFourTones = (pinyin: string) => {
    if (!window.speechSynthesis) return;

    const tones = ['1', '2', '3', '4'];
    let delay = 0;

    tones.forEach((tone) => {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(pinyin + tone);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }, delay);
      delay += 600; // 每个声调间隔600ms
    });
  };

  // 播放汉字读音
  const playHanziSound = (hanzi: string) => {
    if (!window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(hanzi);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  // 绘制游戏
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 清空画布
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制星星背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 50; i++) {
      const x = (i * 137.5) % canvas.width;
      const y = (i * 197.3) % canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制目标
    targets.forEach((target) => {
      const isActive = currentTargetId === target.id;

      // 绘制目标背景
      ctx.fillStyle = isActive ? 'rgba(255, 100, 100, 0.3)' : 'rgba(100, 150, 255, 0.2)';
      const width = level === 1 ? 40 : target.text.length * 25 + 20;
      const height = 50;
      ctx.fillRect(target.x - width / 2, target.y - 25, width, height);

      // 绘制边框
      ctx.strokeStyle = isActive ? '#ff6464' : '#6496ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(target.x - width / 2, target.y - 25, width, height);

      // 绘制文本
      ctx.font = level === 1 ? 'bold 32px Arial' : 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (level === 3) {
        // 汉字
        ctx.fillStyle = '#fff';
        ctx.fillText(target.text, target.x, target.y - 5);

        // 显示输入进度
        if (target.currentInput) {
          ctx.font = '14px Arial';
          ctx.fillStyle = '#4CAF50';
          ctx.fillText(target.currentInput, target.x, target.y + 18);
        }
        if (target.pinyin && target.pinyin.length > target.currentInput.length) {
          ctx.font = '14px Arial';
          ctx.fillStyle = '#999';
          ctx.fillText(
            target.pinyin.substring(target.currentInput.length),
            target.x + target.currentInput.length * 7,
            target.y + 18
          );
        }
      } else if (level === 2) {
        // 拼音 - 部分高亮
        const inputLen = target.currentInput.length;
        
        // 已输入部分（绿色）
        if (inputLen > 0) {
          ctx.fillStyle = '#4CAF50';
          ctx.fillText(target.text.substring(0, inputLen), target.x - (target.text.length - inputLen) * 8, target.y);
        }
        
        // 未输入部分（白色）
        if (inputLen < target.text.length) {
          ctx.fillStyle = '#fff';
          ctx.fillText(target.text.substring(inputLen), target.x + inputLen * 8, target.y);
        }
      } else {
        // 字母数字
        ctx.fillStyle = '#fff';
        ctx.fillText(target.text, target.x, target.y);
      }
    });
  }, [targets, currentTargetId, level]);

  // 更新游戏状态
  const update = useCallback(() => {
    setTargets((prev) => {
      const canvas = canvasRef.current;
      if (!canvas) return prev;

      return prev.map((target) => {
        // 固定每帧移动距离，不再依赖帧率
        let newY = target.y + target.speed;

        // 如果掉落到底部，重置到顶部
        if (newY > canvas.height + 30) {
          return {
            ...target,
            y: -30,
            x: Math.random() * (canvas.width - 100) + 50,
            currentInput: '', // 重置输入
          };
        }

        return { ...target, y: newY };
      });
    });
  }, []);

  // 游戏循环
  const gameLoop = useCallback((currentTime: number) => {
    // 限制更新频率为 30 FPS
    const deltaTime = currentTime - lastUpdateTimeRef.current;
    const targetFrameTime = 1000 / 30; // 30 FPS
    
    if (deltaTime >= targetFrameTime) {
      update();
      lastUpdateTimeRef.current = currentTime;
    }
    
    // 始终绘制以保持流畅
    draw();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  // 处理键盘输入
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // 忽略特殊键
      if (key.length !== 1) return;

      setTargets((prev) => {
        // 如果当前有锁定目标，继续输入
        if (currentTargetId !== null) {
          const target = prev.find((t) => t.id === currentTargetId);
          if (target) {
            const expectedText = level === 3 ? target.pinyin! : target.text;
            const expectedChar = expectedText[target.currentInput.length];

            if (expectedChar && key === expectedChar.toLowerCase()) {
              const newInput = target.currentInput + key;

              // 检查是否完成
              if (newInput.length === expectedText.length) {
                // 完成击落
                if (level === 2) {
                  playFourTones(target.text);
                } else if (level === 3) {
                  playHanziSound(target.text);
                }

                setCurrentTargetId(null);
                return prev.filter((t) => t.id !== target.id);
              }

              // 更新输入进度
              return prev.map((t) =>
                t.id === target.id ? { ...t, currentInput: newInput } : t
              );
            } else {
              // 输入错误，解锁目标
              setCurrentTargetId(null);
              return prev.map((t) =>
                t.id === target.id ? { ...t, currentInput: '' } : t
              );
            }
          }
        }

        // 没有锁定目标，查找匹配的目标
        for (const target of prev) {
          const expectedText = level === 3 ? target.pinyin! : target.text;
          const firstChar = expectedText[0];

          if (key === firstChar.toLowerCase()) {
            if (level === 1) {
              // 第一关：直接消灭
              return prev.filter((t) => t.id !== target.id);
            } else {
              // 锁定目标
              setCurrentTargetId(target.id);
              const newInput = key;

              // 检查是否一个字符就完成
              if (newInput.length === expectedText.length) {
                if (level === 2) {
                  playFourTones(target.text);
                } else if (level === 3) {
                  playHanziSound(target.text);
                }
                setCurrentTargetId(null);
                return prev.filter((t) => t.id !== target.id);
              }

              return prev.map((t) =>
                t.id === target.id ? { ...t, currentInput: newInput } : t
              );
            }
          }
        }

        return prev;
      });
    },
    [currentTargetId, level]
  );

  // 初始化画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // 生成目标
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      setTargets((prev) => {
        if (prev.length < maxCount) {
          return [...prev, createTarget()];
        }
        return prev;
      });
    }, 2000 / speed); // 根据速度调整生成频率

    return () => clearInterval(spawnInterval);
  }, [maxCount, speed, createTarget]);

  // 游戏循环
  useEffect(() => {
    lastUpdateTimeRef.current = performance.now();
    gameLoop(performance.now());
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameLoop]);

  // 键盘事件
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // 配置变化时清空目标
  useEffect(() => {
    setTargets([]);
    setCurrentTargetId(null);
  }, [level, customList, speed, maxCount]);

  return (
    <div className="game-canvas-container">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  );
}
