import { useState, useEffect } from 'react';
import { history } from 'umi';
import GameCanvas from '@/components/GameCanvas';
import HandwritingCanvas from '@/components/HandwritingCanvas';
import '../level1/index.less';

interface Target {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  currentInput: string;
  pinyin?: string;
}

export default function Level4Page() {
  const [speed, setSpeed] = useState(3);
  const [count, setCount] = useState(1); // 手写模式只能同时1个汉字
  const [hanziList, setHanziList] = useState('我是中国人爱我中华');
  const [targets, setTargets] = useState<Target[]>([]);
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [explosions, setExplosions] = useState<{id: number, x: number, y: number}[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [currentCharacter, setCurrentCharacter] = useState(''); // 当前应该练习的汉字

  // 创建目标 - 使用指定的汉字（避免依赖外部状态）
  const createTarget = (character: string): Target => {
    const canvasWidth = 800;
    const text = character || '我'; // 使用传入的字符

    console.log('createTarget called:', {
      inputCharacter: character,
      finalText: text,
      timestamp: Date.now()
    });

    return {
      id: Date.now() + Math.random(),
      text,
      x: Math.random() * (canvasWidth - 100) + 50,
      y: -30,
      speed: speed * 0.3 + 0.2,
      currentInput: '',
      pinyin: '',
    };
  };

  // 处理汉字匹配成功 - 只有写出当前字符才算成功
  const handleCharacterMatch = (character: string) => {
    console.log('handleCharacterMatch called:', { character, currentCharacter, targets: targets.map(t => ({id: t.id, text: t.text})) });

    // 只有写出当前指定的字符才算成功
    if (character === currentCharacter) {
      const matchedTargets = targets.filter(target => target.text === character);
      console.log('匹配到的目标:', matchedTargets);

      if (matchedTargets.length > 0) {
        // 为所有匹配的目标创建爆炸效果
        matchedTargets.forEach(target => {
          createExplosion(target.x, target.y);
        });

        // 移除所有被击中的目标
        setTargets(prev => {
          const remaining = prev.filter(target => target.text !== character);
          console.log('剩余目标:', remaining);
          return remaining;
        });

        setSuccessCount(prev => prev + 1);
        playSuccessSound();

        // 切换到下一个汉字
        const characters = hanziList.split('').filter(char => char.trim());
        const currentIndex = characters.indexOf(currentCharacter);
        const nextIndex = (currentIndex + 1) % characters.length;
        const nextCharacter = characters[nextIndex];

        console.log('切换到下一个字符:', nextCharacter);

        // 延迟切换到下一个字符，让用户看到成功效果
        setTimeout(() => {
          setCurrentCharacter(nextCharacter);

          // 生成新的目标来替换被击落的
          setTargets(prev => {
            const needed = count - prev.length;
            console.log('需要生成', needed, '个新目标，使用字符:', nextCharacter);
            if (needed > 0) {
              const newTargets = Array.from({ length: needed }, (_, index) => {
                const newTarget = createTarget(nextCharacter); // 直接传入目标字符
                console.log(`生成新目标 ${index}:`, newTarget);
                return newTarget; // 不需要再修改text，createTarget已经使用了正确的字符
              });
              console.log('新目标列表:', newTargets);
              return [...prev, ...newTargets];
            }
            return prev;
          });
        }, 1000); // 1秒后切换到下一个字符
      }
    }
  };

  // 创建爆炸效果
  const createExplosion = (x: number, y: number) => {
    const explosionId = Date.now() + Math.random();
    setExplosions(prev => [...prev, { id: explosionId, x, y }]);

    setTimeout(() => {
      setExplosions(prev => prev.filter(exp => exp.id !== explosionId));
    }, 3000);
  };

  // 播放成功音效
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const frequencies = [523, 659, 784, 1047];
      const duration = 0.2;

      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, index * duration * 1000);
      });
    } catch (error) {
      console.error('播放音效失败:', error);
    }
  };

  // 初始化当前字符和初始目标
  useEffect(() => {
    console.log('=== 初始化开始 ===', { hanziList, currentCharacter, count, speed });
    if (hanziList) {
      const characters = hanziList.split('').filter(char => char.trim());
      console.log('字符列表:', characters);
      if (characters.length > 0) {
        const firstCharacter = characters[0];
        console.log('设置第一个字符:', firstCharacter);

        // 如果还没有设置currentCharacter，或者需要重新初始化
        if (!currentCharacter || currentCharacter === '') {
          setCurrentCharacter(firstCharacter);
        }

        // 生成初始目标
        const targetCharacter = currentCharacter || firstCharacter;
        const initialTargets = Array.from({ length: count }, (_, index) => ({
          id: Date.now() + index,
          text: targetCharacter,
          x: Math.random() * 700 + 50,
          y: Math.random() * -200 - 30, // 分散初始位置
          speed: speed * 0.3 + 0.2,
          currentInput: '',
          pinyin: '',
        }));
        console.log('生成初始目标:', initialTargets.length, '个目标，字符:', targetCharacter);
        setTargets(initialTargets);
        console.log('=== 初始化完成 ===');
      }
    }
  }, [hanziList, currentCharacter, count, speed]);

  // 目标移动动画 - 未被击中的目标循环掉落
  useEffect(() => {
    const interval = setInterval(() => {
      setTargets(prev => {
        const updated = prev.map(target => {
          const newY = target.y + target.speed;

          if (newY > 600) {
            // 目标掉出屏幕，保持在同一x位置重新从顶部开始
            return {
              ...target,
              y: -30,
              // 保持原来的x位置，确保一致性
            };
          }

          return { ...target, y: newY };
        });

        // 检查是否有目标的字符被意外修改
        const changedTargets = updated.filter((target, index) =>
          target.text !== prev[index].text
        );
        if (changedTargets.length > 0) {
          console.log('警告：目标字符被修改！', changedTargets);
        }

        return updated;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // 设置当前目标（总是选择与currentCharacter匹配的目标）
  useEffect(() => {
    // console.log('=== 设置当前目标 ===', {
    //   targetsLength: targets.length,
    //   currentCharacter,
    //   targets: targets.map(t => ({id: t.id, text: t.text})),
    //   timestamp: Date.now()
    // });
    if (targets.length > 0 && currentCharacter) {
      // 找到与currentCharacter匹配的第一个目标
      const matchingTarget = targets.find(t => t.text === currentCharacter);
    //  console.log('匹配结果:', matchingTarget);
      if (matchingTarget) {
      //  console.log('设置当前目标为:', matchingTarget.text, matchingTarget.id);
        setCurrentTarget(matchingTarget);
      }
    } else {
      console.log('没有匹配目标或没有当前字符');
      setCurrentTarget(null);
    }
  }, [targets, currentCharacter]);

  return (
    <div className="level-page">
      <div className="game-area">
        <div className="level-header level-4">
          <h2>第四关：手写挑战</h2>
          <p>在手写区域写出目标汉字来击落它们</p>
          <div className="success-counter">成功击落：{successCount} 个</div>
        </div>
        <GameCanvas
          level={3}
          speed={speed}
          maxCount={count}
          customList={hanziList}
          handwritingMode={true}
          currentTarget={currentTarget}
          explosions={explosions}
        />
      </div>

      <div className="config-area">
        <div className="config-panel">
          <h3>游戏设置</h3>

          <div className="config-section">
            <label>掉落速度</label>
            <input
              type="range"
              min="1"
              max="10"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="slider"
            />
            <div className="value-display">{speed}</div>
          </div>

          <div className="config-section">
            <label>汉字列表</label>
            <textarea
              value={hanziList}
              onChange={(e) => setHanziList(e.target.value)}
              placeholder="例如: 我是中国人爱我中华"
              rows={4}
              className="list-input"
            />
            <div className="hint">修改后立即生效</div>
          </div>

          <div className="handwriting-section">
            <h4>手写区域</h4>
            <div className="current-targets">
              {currentCharacter ? (
                <div className="target-list">
                  <p className="target-instruction">当前练习汉字：</p>
                  <div className="target-characters">
                    <span className="target-char active">
                      {currentCharacter}
                    </span>
                  </div>
                  <p className="target-hint">写出这个汉字来击落所有相同的目标</p>
                </div>
              ) : (
                <p className="no-targets">请设置汉字列表</p>
              )}
            </div>
            <HandwritingCanvas
              targetCharacter={currentCharacter}
              onCharacterMatch={handleCharacterMatch}
              width={280}
              height={280}
            />
          </div>
        </div>

        <button
          className="back-btn"
          onClick={() => history.push('/')}
        >
          返回首页
        </button>
      </div>
    </div>
  );
}