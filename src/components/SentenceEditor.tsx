import { useEffect, useState } from 'react';
import {
  SentenceLang,
  useSentences,
  sentenceState,
  sentencesToText,
  saveSentencesText,
  regenerateSentences,
} from '@/utils/exampleSentence';

interface Props {
  lang: SentenceLang;
  words: { word: string; hint?: string }[];
  disabled?: boolean;
}

// 配置面板：每个词的例句，录入词后自动生成，可以人工修改或重新生成
export default function SentenceEditor({ lang, words, disabled }: Props) {
  useSentences(lang, words);
  if (!words.length) return null;
  return (
    <div className="config-section">
      <label>击中后朗读的例句</label>
      <div className="hint">
        录入词后自动用 AI 生成，请检查是否合适。一行一句
        {lang === 'en' ? '，格式“英文句子 | 中文翻译”' : ''}；清空表示这个词不读例句。
      </div>
      <div className="sentence-list">
        {words.map(w => (
          <SentenceRow key={w.word} lang={lang} word={w.word} hint={w.hint} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

function SentenceRow({ lang, word, hint, disabled }: { lang: SentenceLang; word: string; hint?: string; disabled?: boolean }) {
  const { status, list } = sentenceState(lang, word);
  const saved = sentencesToText(list);
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);

  // 没在编辑时，跟随生成/重新生成的结果
  useEffect(() => {
    if (!editing) setText(saved);
  }, [saved, editing]);

  const save = () => {
    setEditing(false);
    if (text.trim() !== saved.trim()) saveSentencesText(lang, word, text);
  };

  return (
    <div className="sentence-row">
      <div className="sentence-head">
        <span className="sentence-word">
          {word}
          {hint ? <small> {hint}</small> : null}
        </span>
        <span className={`sentence-status ${status}`}>
          {status === 'loading' && '生成中…'}
          {status === 'failed' && '生成失败'}
          {status === 'none' && '不读例句'}
        </span>
        <button
          className="sentence-regen"
          disabled={disabled || status === 'loading'}
          title="丢掉现有例句，让 AI 重新生成"
          onClick={() => regenerateSentences(lang, word, hint)}
        >
          {status === 'failed' ? '重试' : '重新生成'}
        </button>
      </div>
      <textarea
        className="sentence-input"
        rows={Math.max(2, (text.match(/\n/g)?.length || 0) + 1)}
        value={text}
        disabled={disabled || status === 'loading'}
        placeholder={status === 'loading' ? '' : lang === 'en' ? 'I like apples. | 我喜欢苹果。' : '我爱吃苹果。'}
        onFocus={() => setEditing(true)}
        onChange={e => setText(e.target.value)}
        onBlur={save}
      />
    </div>
  );
}
