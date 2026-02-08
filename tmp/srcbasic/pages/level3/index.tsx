import { useState } from 'react';
import GameCanvas from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import '../level1/index.less';

export default function Level3Page() {
  const [speed, setSpeed] = useState(3);
  const [count, setCount] = useState(2);
  const [hanziList, setHanziList] = useState('我是中国人');

  return (
    <div className="level-page">
      <div className="game-area">
        <div className="level-header level-3">
          <h2>第三关：汉字挑战</h2>
          <p>输入汉字拼音击落目标，下方显示输入进度</p>
        </div>
        <GameCanvas
          level={3}
          speed={speed}
          maxCount={count}
          customList={hanziList}
        />
      </div>
      <div className="config-area">
        <ConfigPanel
          level={3}
          speed={speed}
          onSpeedChange={setSpeed}
          count={count}
          onCountChange={setCount}
          customList={hanziList}
          onCustomListChange={setHanziList}
        />
      </div>
    </div>
  );
}
