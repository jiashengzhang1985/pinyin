import GameCanvas, { HanziMode, HanziUnit } from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import '../level1/index.less';
import usePersistedState from '@/utils/usePersistedState';

export default function Level3Page() {
  const [speed, setSpeed] = usePersistedState('level3.speed', 3);
  const [count, setCount] = usePersistedState('level3.count', 2);
  const [hanziList, setHanziList] = usePersistedState('level3.list', '我是中国人');
  const [phraseList, setPhraseList] = usePersistedState('level3.phraseList', '苹果，中国，老师，朋友，学校');
  const [showPinyin, setShowPinyin] = usePersistedState('level3.showPinyin', false);
  const [unit, setUnit] = usePersistedState<HanziUnit>('level3.unit', 'char');
  const [mode, setMode] = usePersistedState<HanziMode>('level3.mode', 'see');
  const [focus, setFocus] = usePersistedState('level3.focus', '');

  // 汉字和词组各自保存一份列表，切换时互不影响
  const list = unit === 'phrase' ? phraseList : hanziList;
  const setList = unit === 'phrase' ? setPhraseList : setHanziList;

  return (
    <div className="level-page">
      <div className="game-area">
        <GameCanvas
          level={3}
          speed={speed}
          maxCount={count}
          customList={list}
          showPinyin={showPinyin}
          hanziMode={mode}
          hanziUnit={unit}
          focusLetters={focus}
        />
      </div>
      <div className="config-area">
        <ConfigPanel
          level={3}
          speed={speed}
          onSpeedChange={setSpeed}
          count={count}
          onCountChange={setCount}
          customList={list}
          onCustomListChange={setList}
          showPinyin={showPinyin}
          onShowPinyinChange={setShowPinyin}
          hanziMode={mode}
          onHanziModeChange={setMode}
          hanziUnit={unit}
          onHanziUnitChange={setUnit}
          focusLetters={focus}
          onFocusLettersChange={setFocus}
        />
      </div>
    </div>
  );
}
