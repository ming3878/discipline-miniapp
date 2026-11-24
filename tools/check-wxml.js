// 校验 WXML 事件处理器是否均在对应 JS 中定义
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
let fail = false;
for (const p of app.pages) {
  const wxml = fs.readFileSync(path.join(root, p + '.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(root, p + '.js'), 'utf8');
  const handlers = new Set();
  const re = /(?:bind|catch)[a-z]*\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(wxml))) handlers.add(m[1]);
  const missing = [];
  for (const h of handlers) {
    const defined = new RegExp('(^|\\s)' + h + '\\s*\\(').test(js) || new RegExp(h + '\\s*:').test(js);
    if (!defined) { missing.push(h); fail = true; }
  }
  console.log(p + ': ' + handlers.size + ' 个事件' + (missing.length ? ' | 未定义: ' + missing.join(', ') : ' | 全部已定义'));
}
console.log(fail ? '\nFAIL 有未定义的事件处理器' : '\nPASS 所有事件处理器均已定义');
process.exit(fail ? 1 : 0);
