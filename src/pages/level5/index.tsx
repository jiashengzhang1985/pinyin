import GameCanvas, { WordEntry, EnglishMode } from '@/components/GameCanvas';
import ConfigPanel from '@/components/ConfigPanel';
import usePersistedState from '@/utils/usePersistedState';
import LevelLayout from '@/components/LevelLayout';
import { useEffect } from 'react';
import { DEFAULT_WORDS, cleanWord } from '@/utils/wordList';

export default function Level5Page() {
  const [speed, setSpeed] = usePersistedState('level5.speed', 2);
  const [count, setCount] = usePersistedState('level5.count', 1);
  const [mode, setMode] = usePersistedState<EnglishMode>('level5.mode', 'en');
  const [words, setWords] = usePersistedState<WordEntry[]>('level5.words', DEFAULT_WORDS);

  // 以前保存的词表里可能有“let-tuce”这种拆音节写法，去掉“-”
  useEffect(() => {
    if (words.some(w => w.en.includes('-'))) setWords(words.map(w => ({ ...w, en: cleanWord(w.en) })));
  }, []);

  return (
    <LevelLayout
      game={
        <GameCanvas
          level={5}
          speed={speed}
          maxCount={count}
          wordList={words}
          englishMode={mode}
        />
      }
      config={
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
        />
      }
    />
  );
}
