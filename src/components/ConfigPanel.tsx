import { useState, useEffect } from 'react';
import { parseWord, splitPhrases } from './GameCanvas';
import { cleanWord } from '@/utils/wordList';
import type { WordEntry, EnglishMode, HanziMode, HanziUnit } from './GameCanvas';
import SentenceEditor from './SentenceEditor';
import usePersistedState from '@/utils/usePersistedState';
import './ConfigPanel.less';

interface ConfigPanelProps {
  level: 1 | 2 | 3 | 5;
  speed: number;
  onSpeedChange: (speed: number) => void;
  count: number;
  onCountChange: (count: number) => void;
  customList?: string;
  onCustomListChange?: (list: string) => void;
  charType?: 'letter' | 'pinying' | 'mixed';
  onCharTypeChange?: (type: 'uppercase' | 'lowercase' | 'mixed') => void;
  showPinyin?: boolean;
  onShowPinyinChange?: (show: boolean) => void;
  englishMode?: EnglishMode;
  onEnglishModeChange?: (mode: EnglishMode) => void;
  wordList?: WordEntry[];
  onWordListChange?: (words: WordEntry[]) => void;
  hanziMode?: HanziMode;
  onHanziModeChange?: (mode: HanziMode) => void;
  hanziUnit?: HanziUnit;
  onHanziUnitChange?: (unit: HanziUnit) => void;
}

// 去掉空词和重复的词
const dedupe = (words: { word: string; hint?: string }[]) => {
  const seen = new Set<string>();
  return words.filter(w => w.word && !seen.has(w.word) && (seen.add(w.word), true));
};

export default function ConfigPanel({
  level,
  speed,
  onSpeedChange,
  count,
  onCountChange,
  customList = '',
  onCustomListChange,
  charType = 'mixed',
  onCharTypeChange,
  showPinyin = false,
  onShowPinyinChange,
  englishMode = 'en',
  onEnglishModeChange,
  wordList = [],
  onWordListChange,
  hanziMode = 'see',
  onHanziModeChange,
  hanziUnit = 'char',
  onHanziUnitChange,
}: ConfigPanelProps) {
  const [localList, setLocalList] = useState(customList);
  const [isLocked, setIsLocked] = usePersistedState(`level${level}.locked`, false);
  const [newEn, setNewEn] = useState('');
  const [newZh, setNewZh] = useState('');

  const addWord = () => {
    const en = parseWord(newEn);
    if (!en) return;
    onWordListChange?.([...wordList, { en, zh: newZh.trim() }]);
    setNewEn('');
    setNewZh('');
  };
  const updateWord = (i: number, field: keyof WordEntry, value: string) => {
    const v = field === 'en' ? cleanWord(value) : value;
    onWordListChange?.(wordList.map((w, idx) => (idx === i ? { ...w, [field]: v } : w)));
  };
  const removeWord = (i: number) => {
    onWordListChange?.(wordList.filter((_, idx) => idx !== i));
  };

  useEffect(() => {
    setLocalList(customList);
  }, [customList]);

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };
  const handleListChange = (value: string) => {
    setLocalList(value);
    onCustomListChange?.(value);
  };
  

  return (
    <div className="config-panel">
      <h3>游戏设置</h3>
      {(level === 2 || level === 3 || level === 5) && (
        <div className="config-section">
          <label>锁定列表</label>
          <label className="switch">
            <input
              type="checkbox"
              checked={isLocked}
              onChange={toggleLock}
            />
            <span className="slider round"></span>
          </label>
        </div>
      )}
      <div className="config-section">
        <label>掉落速度</label>
        <input
          type="range"
          min="1"
          max="10"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="slider"
        />
        <div className="value-display">{speed}</div>
      </div>

      <div className="config-section">
        <label>同时掉落数量</label>
        <input
          type="range"
          min="1"
          max="5"
          value={count}
          onChange={(e) => onCountChange(Number(e.target.value))}
          className="slider"
        />
        <div className="value-display">{count}</div>
      </div>

      {level === 1 && (
        <div className="config-section">
          <label>字符类型</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="charType"
                value="letter"
                checked={charType === 'letter'}
                onChange={(e) => onCharTypeChange?.(e.target.value as any)}
              />
              <span>字母</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="charType"
                value="pinying"
                checked={charType === 'pinying'}
                onChange={(e) => onCharTypeChange?.(e.target.value as any)}
              />
              <span>基础拼音</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="charType"
                value="mixed"
                checked={charType === 'mixed'}
                onChange={(e) => onCharTypeChange?.(e.target.value as any)}
              />
              <span>大小写混合+数字</span>
            </label>
          </div>
        </div>
      )}

      {level === 2 && (
        <div className="config-section">
          <label>拼音列表（逗号分隔）</label>
          <textarea
            value={localList}
            onChange={(e) => handleListChange(e.target.value)}
            placeholder="例如: wo,ni,ta,bo,po,mo"
            rows={4}
            disabled={isLocked} 
            className="list-input"
          />
          <div className="hint">修改后立即生效</div>
        </div>
      )}

      {level === 3 && (
        <div className="config-section">
          <label>练习内容</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="hanziUnit"
                checked={hanziUnit === 'char'}
                onChange={() => onHanziUnitChange?.('char')}
              />
              <span>单个汉字</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="hanziUnit"
                checked={hanziUnit === 'phrase'}
                onChange={() => onHanziUnitChange?.('phrase')}
              />
              <span>词组（整个词组的拼音都打对才消灭）</span>
            </label>
          </div>
        </div>
      )}

      {level === 3 && (
        <div className="config-section">
          <label>游戏模式</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="hanziMode"
                checked={hanziMode === 'see'}
                onChange={() => onHanziModeChange?.('see')}
              />
              <span>看汉字 → 打拼音</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="hanziMode"
                checked={hanziMode === 'listen'}
                onChange={() => onHanziModeChange?.('listen')}
              />
              <span>听发音 → 打拼音</span>
            </label>
          </div>
        </div>
      )}

      {level === 3 && (
        <div className="config-section">
          <label>{hanziUnit === 'phrase' ? '词组列表' : '汉字列表'}</label>
          <textarea
            value={localList}
            disabled={isLocked}
            onChange={(e) => handleListChange(e.target.value)}
            placeholder={hanziUnit === 'phrase' ? '例如: 苹果，中国，老师' : '例如: 我是中国人'}
            rows={4}
            className="list-input"
          />
          <div className="hint">
            {hanziUnit === 'phrase'
              ? '词组之间用逗号、顿号、空格或换行分隔，修改后立即生效并自动保存'
              : '修改后立即生效并自动保存'}
          </div>
        </div>
      )}

      {level === 5 && (
        <div className="config-section">
          <label>游戏模式</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="englishMode"
                checked={englishMode === 'en'}
                onChange={() => onEnglishModeChange?.('en')}
              />
              <span>落英文 → 照着打</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="englishMode"
                checked={englishMode === 'zh'}
                onChange={() => onEnglishModeChange?.('zh')}
              />
              <span>落中文 → 拼出英文</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="englishMode"
                checked={englishMode === 'listen'}
                onChange={() => onEnglishModeChange?.('listen')}
              />
              <span>听发音 → 拼出英文</span>
            </label>
          </div>
        </div>
      )}

      {level === 5 && (
        <div className="config-section">
          <label>单词列表（{wordList.length} 个）</label>
          <div className="word-list">
            {wordList.map((w, i) => (
              <div className="word-row" key={i}>
                <input
                  className="word-input"
                  value={w.en}
                  disabled={isLocked}
                  placeholder="英文"
                  onChange={(e) => updateWord(i, 'en', e.target.value)}
                />
                <input
                  className="word-input"
                  value={w.zh}
                  disabled={isLocked}
                  placeholder="中文"
                  onChange={(e) => updateWord(i, 'zh', e.target.value)}
                />
                <button
                  className="word-btn remove"
                  disabled={isLocked}
                  title="删除"
                  onClick={() => removeWord(i)}
                >
                  ×
                </button>
              </div>
            ))}
            {!isLocked && (
              <div className="word-row add-row">
                <input
                  className="word-input"
                  value={newEn}
                  placeholder="英文，如 apple"
                  onChange={(e) => setNewEn(cleanWord(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && addWord()}
                />
                <input
                  className="word-input"
                  value={newZh}
                  placeholder="中文，如 苹果"
                  onChange={(e) => setNewZh(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addWord()}
                />
                <button className="word-btn add" title="添加" onClick={addWord}>
                  +
                </button>
              </div>
            )}
          </div>
          <div className="hint">按回车或 + 添加，修改后立即生效并自动保存</div>
          <div className="hint">用 - 分音节，如 let-tuce，击中后先慢读音节再读整词</div>
        </div>
      )}

      {level === 5 && (
        <SentenceEditor
          lang="en"
          disabled={isLocked}
          words={dedupe(wordList.map(w => ({ word: parseWord(w.en).toLowerCase(), hint: w.zh.trim() || undefined })))}
        />
      )}

      {level === 3 && hanziUnit === 'phrase' && (
        <SentenceEditor lang="zh" disabled={isLocked} words={dedupe(splitPhrases(customList).map(word => ({ word })))} />
      )}

      {level === 3 && hanziMode === 'see' && (
        <div className="config-section">
          <label>显示拼音提示</label>
          <label className="switch">
            <input
              type="checkbox"
              checked={showPinyin}
              onChange={(e) => onShowPinyinChange?.(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      )}

      <div className="config-section info-section">
        <h4>操作说明</h4>
        <ul>
          <li>🎯 键盘输入对应字符击落目标</li>
          <li>⚡ 多目标时自动匹配最近的</li>
          <li>🔄 未击中会重新掉落</li>
          {level === 3 && <li>📝 输入进度显示在汉字下方</li>}
          {level === 2 && <li>🔊 击中后播放四声发音</li>}
          {level === 3 && <li>🔊 击中后读出汉字，并显示带声调的拼音；词组还会读一句例句</li>}
          {level === 3 && <li>✏️ 打错字母不会清空，ü 用 v 输入</li>}
          {level === 3 && <li>🎧 听音模式按空格再听一遍</li>}
          {level === 3 && <li>⭐ 连续打对有连击奖励，每轮结束自动评星</li>}
          {level === 5 && <li>🔊 击中后美式发音，并显示中文，再读一句例句</li>}
          {level === 5 && <li>✏️ 打错字母不会清空，继续打对的即可</li>}
          {level === 5 && <li>🎧 听写模式按空格再听一遍</li>}
          {level === 5 && <li>⭐ 连续打对有连击奖励，每轮结束自动评星，不打断游戏</li>}
          <li>💾 设置会自动保存在本浏览器</li>
        </ul>
      </div>

      <button
        className="back-btn"
        onClick={() => window.history.back()}
      >
        返回首页
      </button>
    </div>
  );
}
