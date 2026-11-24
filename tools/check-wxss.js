// 扫描 wxss 中「width:100% + 水平 padding 但没写 box-sizing」的溢出风险
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.wxss')) files.push(p);
  }
})('miniprogram');

let issues = 0;
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of css.split('}')) {
    const i = block.lastIndexOf('{');
    if (i < 0) continue;
    const sel = block.slice(0, i).trim();
    const body = block.slice(i + 1);
    if (!/width:\s*100%/.test(body)) continue;
    const m = body.match(/(?:^|;)\s*padding:\s*([^;]+)/);
    if (!m) continue;
    const parts = m[1].trim().split(/\s+/);
    const hPad = parts.length >= 2 ? parts[1] : parts[0];
    if (!hPad || hPad === '0') continue;
    if (/box-sizing:\s*border-box/.test(body)) continue;
    console.log('溢出风险:', f, '|', sel, '| padding:', m[1].trim());
    issues++;
  }
}
console.log(issues ? `共 ${issues} 处` : 'PASS 无 100%+padding 溢出风险');
