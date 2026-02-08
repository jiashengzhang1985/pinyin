import { useState } from 'react';
import { history } from 'umi';
import GameCanvas from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import './index.less';

export default function Level1Page() {
  const [speed, setSpeed] = useState(2);
  const [count, setCount] = useState(1);
  const [charType, setCharType] = useState<'letter' | 'pinying' | 'mixed'>('mixed');

  return (
    <div className="level-page">
      <div className="game-area">
      
        <GameCanvas level={1} speed={speed} maxCount={count} charType={charType} />
        
        {/* 字母对照表 */}
        <div className="letter-reference">
       
          <div className="letter-grid">
            {Array.from({ length: 26 }, (_, i) => {
              const upper = String.fromCharCode(65 + i);
              const lower = String.fromCharCode(97 + i);
              return (
                <div key={i} className="letter-pair">
                  <span className="upper">{upper}</span>
                  <span className="separator">-</span>
                  <span className="lower">{lower}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="config-area">
        <ConfigPanel
          level={1}
          speed={speed}
          onSpeedChange={setSpeed}
          count={count}
          onCountChange={setCount}
          charType={charType}
          onCharTypeChange={setCharType}
        />
      </div>
    </div>
  );
}
