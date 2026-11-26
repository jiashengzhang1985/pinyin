import GameCanvas from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import '../level1/index.less';
import usePersistedState from '@/utils/usePersistedState';

export default function Level2Page() {
  const [speed, setSpeed] = usePersistedState('level2.speed', 3);
  const [count, setCount] = usePersistedState('level2.count', 2);
  const [pinyinList, setPinyinList] = usePersistedState('level2.list', 'wo,ni,ta,shi,bo,po,mo,fo');

  return (
    <div className="level-page">
      <div className="game-area">
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
