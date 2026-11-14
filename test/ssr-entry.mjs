import { renderToString } from "vue/server-renderer";
import { createSSRApp } from "vue";
import App from "/src/app/App.vue";

globalThis.localStorage = {
  store: new Map(),
  getItem(k) { return this.store.get(k) ?? null; },
  setItem(k, v) { this.store.set(k, v); },
  removeItem(k) { this.store.delete(k); },
};

const app = createSSRApp(App);
const html = await renderToString(app);
const checks = [
  ["开垦地图标题", html.includes("开垦地图")],
  ["9 个分块标签", (html.match(/区 · 第/g) || []).length === 9],
  ["12 块沃土文案", html.includes("12 块沃土")],
  ["初始田块渲染", (html.match(/data-plot=/g) || []).length === 12],
  ["默认谷仓面板", html.includes("谷仓库存")],
  ["当前分块 9 格地图", (html.match(/map-tile/g) || []).length >= 9],
  ["中心分块为沃土", (html.match(/terrain-fertile/g) || []).length >= 9],
  ["开垦提示存在", html.includes("分块加载")],
];
let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) ok = false;
}
if (!ok) process.exit(1);
console.log("SSR 渲染烟雾测试通过 ✅");
