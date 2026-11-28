// 关卡页面布局：左边游戏，右边设置。
// 触屏（App、手机、平板）上游戏 + 屏幕键盘占满整屏，设置收进右侧抽屉，右上角 🏠 / ⚙️ 两个按钮。
import { useState, useEffect, ReactNode } from 'react';
import { history } from 'umi';
import { useShowVirtualKeyboard } from './VirtualKeyboard';
import { pushBackHandler } from '@/utils/backButton';
import '../pages/level1/index.less';

export default function LevelLayout({ game, config }: { game: ReactNode; config: ReactNode }) {
  const compact = useShowVirtualKeyboard();
  const [configOpen, setConfigOpen] = useState(false);

  // 设置抽屉打开时，安卓返回键只关抽屉，回到原来的游戏，不退回首页
  useEffect(() => {
    if (!configOpen) return;
    return pushBackHandler(() => setConfigOpen(false));
  }, [configOpen]);

  return (
    <div className={`level-page${compact ? ' compact' : ''}${configOpen ? ' config-open' : ''}`}>
      <div className="game-area">
        {/* 触屏上设置收在抽屉里，游戏区右上角放 🏠 和 ⚙️；电脑上“返回首页”在设置标题行 */}
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
