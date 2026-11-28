import { defineConfig } from "umi";

export default defineConfig({
  // 基础路径：必须是 /仓库名/
  // base: process.env.NODE_ENV === 'production' ? '/pinyin/' : '/',
  // publicPath: process.env.NODE_ENV === 'production' ? '/pinyin/' : '/',
  
  base: '/',
  publicPath: '/',
  history: { type: 'hash' },
  hash: true,
  codeSplitting: {
    jsStrategy: 'bigVendors',
  },

  // 重点：如果是纯静态展示，可以开启这个配置，它会为每个路由生成 html
 // exportStatic: {},
  title: '元宝玩学',
  routes: [
    { path: "/", component: "index" },
    { path: "/level1", component: "level1" },
    { path: "/level2", component: "level2" },
    { path: "/level3", component: "level3" },
    { path: "/level4", component: "level4" },
    { path: "/level5", component: "level5" },
    { path: "/level6", component: "level6" },
    { path: "/*", redirect: "/" },
  ],
  npmClient: 'npm',
  // 本地开发时的有道发音、智谱接口转发（线上由 netlify.toml 转发）
  proxy: {
    '/yd': { target: 'https://dict.youdao.com', changeOrigin: true, pathRewrite: { '^/yd': '' } },
    '/zhipu': { target: 'https://open.bigmodel.cn', changeOrigin: true, pathRewrite: { '^/zhipu': '' } },
  },
  // 构建时注入 Gemini / 智谱 Key（来自 .env.local 或 Netlify 环境变量），不写进仓库
  define: {
    'process.env.GEMINI_API_KEY': process.env.GEMINI_API_KEY || '',
    'process.env.ZHIPU_API_KEY': process.env.ZHIPU_API_KEY || '',
  },
});