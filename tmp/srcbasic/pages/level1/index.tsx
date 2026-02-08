import { useState } from 'react';
import GameCanvas from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import './index.less';

export default function Level1Page() {
  const [speed, setSpeed] = useState(2);
  const [count, setCount] = useState(1);

  return (
    <div className="level-page">
      <div className="game-area">
        <div className="level-header">
          <h2>第一关：字母数字射击</h2>
          <p>键盘输入对应字符即可击落目标</p>
        </div>
        <GameCanvas level={1} speed={speed} maxCount={count} />
      </div>
      <div className="config-area">
        <ConfigPanel
          level={1}
          speed={speed}
          onSpeedChange={setSpeed}
          count={count}
          onCountChange={setCount}
        />
      </div>
    </div>
  );
}
