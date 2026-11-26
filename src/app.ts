// Umi 运行时入口：只在安卓 App 里生效，网页不受影响
import { App } from '@capacitor/app';
import { isNativeApp } from '@/utils/tts';

if (isNativeApp) {
  document.documentElement.classList.add('is-native');

  // 安卓返回键：关卡页回到首页；首页退到后台而不是关掉，再打开还能接着玩
  App.addListener('backButton', () => {
    const route = window.location.hash.replace(/^#/, '') || '/';
    if (route === '/') App.minimizeApp();
    else window.location.hash = '/';
  });
}
