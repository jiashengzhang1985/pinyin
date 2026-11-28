// Umi 运行时入口
import { App } from '@capacitor/app';
import { isNativeApp } from '@/utils/tts';
import { startBackgroundPrep } from '@/utils/backgroundPrep';
import { handleBack } from '@/utils/backButton';

// 网页和 App 都在后台提前生成例句、下载发音
startBackgroundPrep();

// 以下只在安卓 App 里生效，网页不受影响
if (isNativeApp) {
  document.documentElement.classList.add('is-native');

  // 安卓返回键：先关掉打开着的设置抽屉（游戏原样继续）；否则关卡页回到首页；首页退到后台而不是关掉
  App.addListener('backButton', () => {
    if (handleBack()) return;
    const route = window.location.hash.replace(/^#/, '') || '/';
    if (route === '/') App.minimizeApp();
    else window.location.hash = '/';
  });
}
