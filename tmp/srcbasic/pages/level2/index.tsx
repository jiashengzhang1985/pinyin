import { useState } from 'react';
import GameCanvas from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import '../level1/index.less';

export default function Level2Page() {
  const [speed, setSpeed] = useState(3);
  const [count, setCount] = useState(2);
  const [pinyinList, setPinyinList] = useState('wo,ni,ta,shi,bo,po,mo,fo');

  return (
    <div className="level-page">
      <div className="game-area">
        <div className="level-header level-2">
          <h2>第二关：拼音射击</h2>
          <p>输入完整拼音击落目标，击中后播放四声</p>
        </div>
        <GameCanvas
          level={2}
          speed={speed}
          maxCount={count}
          customList={pinyinList}
        />
      </div>
      <div className="config-area">
        <ConfigPanel
          level={2}
          speed={speed}
          onSpeedChange={setSpeed}
          count={count}
          onCountChange={setCount}
          customList={pinyinList}
          onCustomListChange={setPinyinList}
        />
      </div>
    </div>
  );
}
