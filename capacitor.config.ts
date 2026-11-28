import type { CapacitorConfig } from '@capacitor/cli';

// 安卓 App 配置：把 `npm run build` 生成的 dist 打包进 App（离线可用）
const config: CapacitorConfig = {
  appId: 'app.pinyin.shooter',
  appName: '元宝玩学',
  webDir: 'dist',
  android: {
    // 调试包也允许 Chrome 远程调试（chrome://inspect），方便排查问题
    webContentsDebuggingEnabled: true,
  },
};

export default config;
