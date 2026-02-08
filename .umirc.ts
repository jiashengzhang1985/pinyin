import { defineConfig } from "umi";

export default defineConfig({
  title: '打字射击游戏',
  routes: [
    { path: "/", component: "index" },
    { path: "/level1", component: "level1" },
    { path: "/level2", component: "level2" },
    { path: "/level3", component: "level3" },
    { path: "/level4", component: "level4" },
  ],
  npmClient: 'npm',
});