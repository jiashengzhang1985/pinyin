import GameCanvas, { WordEntry, EnglishMode } from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import usePersistedState from '@/utils/usePersistedState';
import '../level1/index.less';

const DEFAULT_WORDS: WordEntry[] = [
  { en: 'let-tuce', zh: '生菜' },
  { en: 'ce-re-al', zh: '麦片' },
  { en: 'cir-cle', zh: '圆圈' },
  { en: 'ci-ty', zh: '城市' },
  { en: 'face', zh: '脸' },
  { en: 'rice', zh: '米饭' },
  { en: 'pen-cil', zh: '铅笔' },
];

export default function Level5Page() {
  const [speed, setSpeed] = usePersistedState('level5.speed', 2);
  const [count, setCount] = usePersistedState('level5.count', 1);
  const [mode, setMode] = usePersistedState<EnglishMode>('level5.mode', 'en');
  const [words, setWords] = usePersistedState<WordEntry[]>('level5.words', DEFAULT_WORDS);
  const [focus, setFocus] = usePersistedState('level5.focus', 'c');

  return (
    <div className="level-page">
      <div className="game-area">
        <div className="level-header level-5">
          <h2>第五关：英语单词</h2>
          <p>
            {mode === 'en' && '照着英文单词打字，击中后读出单词并显示中文'}
            {mode === 'zh' && '看中文拼出英文单词，击中后读出单词'}
            {mode === 'listen' && '听发音拼出英文单词，按空格可以再听一遍'}
          </p>
        </div>
        <GameCanvas
          level={5}
          speed={speed}
          maxCount={count}
          wordList={words}
          englishMode={mode}
          focusLetters={focus}
        />
      </div>
      <div className="config-area">
        <ConfigPanel
          level={5}
          speed={speed}
          onSpeedChange={setSpeed}
          count={count}
          onCountChange={setCount}
          englishMode={mode}
          onEnglishModeChange={setMode}
          wordList={words}
          onWordListChange={setWords}
          focusLetters={focus}
          onFocusLettersChange={setFocus}
        />
      </div>
    </div>
  );
}
