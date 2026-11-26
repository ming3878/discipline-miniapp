// 统计 wxss 中 font-size 的分布与对应选择器，用于字号体系收敛
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (p.endsWith('.wxss')) files.push(p);
  }
})('miniprogram');

const map = {};
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const b of css.split('}')) {
    const i = b.lastIndexOf('{');
    if (i < 0) continue;
    const sel = b.slice(0, i).trim().split('\n').pop().trim();
    const m = b.slice(i + 1).match(/font-size:\s*(\d+)rpx/);
    if (!m) continue;
    const k = Number(m[1]);
    (map[k] = map[k] || []).push(path.basename(f, '.wxss') + ':' + sel);
  }
}

const keys = Object.keys(map).map(Number).sort((a, b) => b - a);
for (const k of keys) {
  const list = [...new Set(map[k])];
  console.log(
    String(k).padStart(3) + 'rpx (' + k / 2 + 'px) x' + list.length +
    '  ' + list.slice(0, 6).join(' | ') + (list.length > 6 ? ' …' : '')
  );
}
console.log('---- 不同字号总数:', keys.length);
