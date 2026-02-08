import { useState, useEffect } from 'react';
import './ConfigPanel.less';

interface ConfigPanelProps {
  level: 1 | 2 | 3;
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
}

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
}: ConfigPanelProps) {
  const [localList, setLocalList] = useState(customList);
  const [isLocked, setIsLocked] = useState(false); 

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
      {(level === 2 || level === 3) && (
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
          <label>汉字列表</label>
          <textarea
            value={localList}
            disabled={isLocked}
            onChange={(e) => handleListChange(e.target.value)}
            placeholder="例如: 我是中国人"
            rows={4}
            className="list-input"
          />
          <div className="hint">修改后立即生效</div>
        </div>
      )}

      {level === 3 && (
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
          {level === 3 && <li>🔊 击中后播放汉字读音</li>}
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
