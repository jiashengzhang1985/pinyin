// 安卓返回键的“拦截栈”：抽屉、弹层打开时登记一个关闭函数，
// 按返回键先关最上面那一层，而不是直接退回首页。
const handlers: (() => void)[] = [];

/** 登记一个返回键处理函数，返回取消登记的函数 */
export const pushBackHandler = (fn: () => void) => {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
};

/** 有登记的处理函数就执行最上面那个并返回 true */
export const handleBack = () => {
  const fn = handlers[handlers.length - 1];
  if (!fn) return false;
  fn();
  return true;
};
