// 触屏用的屏幕键盘：QWERTY 三行字母 + “再读”键。
// 手机/平板上显示，电脑上不显示（电脑照旧用实体键盘）。
import { useState } from 'react';
import { isNativeApp } from '@/utils/tts';
import './VirtualKeyboard.less';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** App 里或以触屏为主的设备上显示屏幕键盘 */
export const useShowVirtualKeyboard = () =>
  useState(() => {
    if (isNativeApp) return true;
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  })[0];

interface Props {
  onKey: (key: string) => void;
  onReplay: () => void;
  pinyinMode?: boolean; // 拼音：v 键显示为 ü
  withSpace?: boolean;  // 英文词组需要空格
}

export default function VirtualKeyboard({ onKey, onReplay, pinyinMode, withSpace }: Props) {
  const [pressed, setPressed] = useState<string | null>(null);

  const press = (id: string, action: () => void) => (e: React.PointerEvent) => {
    e.preventDefault(); // 不抢焦点、不触发双击缩放
    setPressed(id);
    try { navigator.vibrate?.(10); } catch {}
    action();
  };
  const release = () => setPressed(null);

  const key = (k: string) => (
    <button
      key={k}
      className={`vk-key${pressed === k ? ' is-pressed' : ''}`}
      onPointerDown={press(k, () => onKey(k))}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      {pinyinMode && k === 'v' ? <>ü<small>v</small></> : k}
    </button>
  );

  return (
    <div className="virtual-keyboard" onContextMenu={e => e.preventDefault()}>
      <div className="vk-row">{[...ROWS[0]].map(key)}</div>
      <div className="vk-row vk-row-2">{[...ROWS[1]].map(key)}</div>
      <div className="vk-row">
        {[...ROWS[2]].map(key)}
        {withSpace && (
          <button
            className={`vk-key vk-space${pressed === ' ' ? ' is-pressed' : ''}`}
            onPointerDown={press(' ', () => onKey(' '))}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
          >
            空格
          </button>
        )}
        <button
          className={`vk-key vk-replay${pressed === 'replay' ? ' is-pressed' : ''}`}
          onPointerDown={press('replay', onReplay)}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        >
          🔊 再读
        </button>
      </div>
    </div>
  );
}
