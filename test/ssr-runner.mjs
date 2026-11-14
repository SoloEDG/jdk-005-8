// 通过 Vite SSR 加载器运行 .mjs 测试入口（能正确编译 .vue 与 .ts）
import { createServer } from "vite";
const entry = process.argv[2];
if (!entry) {
  console.error("用法：node test/ssr-runner.mjs <测试入口>");
  process.exit(1);
}
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
try {
  await vite.ssrLoadModule(entry);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await vite.close();
  process.exit(process.exitCode ?? 0);
}
