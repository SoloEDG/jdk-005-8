#!/usr/bin/env bash
# 运行全部领域测试：纯 TS 用 esbuild 打包，含 .vue 的 SSR 测试走 Vite
set -e
cd "$(dirname "$0")/.."

echo "== 开垦全流程集成测试 =="
node_modules/.bin/esbuild test/reclaim.test.mjs \
  --bundle --platform=node --format=esm \
  --outfile=node_modules/.test-reclaim.mjs --log-level=warning
node node_modules/.test-reclaim.mjs

echo
echo "== 地图连通性测试 =="
node_modules/.bin/esbuild test/connectivity.test.mjs \
  --bundle --platform=node --format=esm \
  --outfile=node_modules/.test-conn.mjs --log-level=warning
node node_modules/.test-conn.mjs

echo
echo "== App SSR 渲染烟雾测试 =="
node test/ssr-runner.mjs /test/ssr-entry.mjs

rm -f node_modules/.test-reclaim.mjs node_modules/.test-conn.mjs
echo
echo "全部测试完成。"
