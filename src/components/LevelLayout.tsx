// 关卡页面布局：左边游戏，右边设置。
// 触屏（App、手机、平板）上游戏 + 屏幕键盘占满整屏，设置收进右侧抽屉，右上角 🏠 / ⚙️ 两个按钮。
import { useState, ReactNode } from 'react';
import { history } from 'umi';
import { useShowVirtualKeyboard } from './VirtualKeyboard';
import '../pages/level1/index.less';

export default function LevelLayout({ game, config }: { game: ReactNode; config: ReactNode }) {
  const compact = useShowVirtualKeyboard();
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className={`level-page${compact ? ' compact' : ''}${configOpen ? ' config-open' : ''}`}>
      <div className="game-area">
        {compact && (
          <div className="compact-toolbar">
            <button onClick={() => history.push('/')} aria-label="返回首页">🏠</button>
            <button onClick={() => setConfigOpen(true)} aria-label="设置">⚙️</button>
          </div>
        )}
        {game}
      </div>
      {compact && configOpen && <div className="config-backdrop" onClick={() => setConfigOpen(false)} />}
      <div className="config-area">
        {compact && (
          <button className="config-close" onClick={() => setConfigOpen(false)}>✕ 关闭设置</button>
        )}
        {config}
      </div>
    </div>
  );
}
