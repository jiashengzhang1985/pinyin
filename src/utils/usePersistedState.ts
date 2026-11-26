import { useEffect, useState } from 'react';
import { configChanged } from './backgroundPrep';

// 这些配置一改，就在后台提前准备声音和例句
const PREP_KEYS = new Set(['level3.list', 'level3.phraseList', 'level5.words']);

const PREFIX = 'typing-game:';

function load<T>(key: string, defaultValue: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    const parsed = JSON.parse(raw);
    // 类型不一致（比如旧版本存的数据格式不同）时回退到默认值
    if (Array.isArray(defaultValue) !== Array.isArray(parsed)) return defaultValue;
    if (typeof parsed !== typeof defaultValue) return defaultValue;
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 和 useState 用法一样，但值会保存到浏览器 localStorage，
 * 下次打开同域名页面时自动恢复。
 */
export default function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => load(key, defaultValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // 隐私模式或存储被禁用时忽略
    }
    if (PREP_KEYS.has(key)) configChanged();
  }, [key, value]);

  return [value, setValue] as const;
}
