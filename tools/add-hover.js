// 给所有可点元素补按压反馈：bindtap/catchtap 的 view 统一加 hover-class="is-pressed"
// 用法：node tools/add-hover.js [--write]
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const HOVER = 'hover-class="is-pressed"';

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.wxml')) files.push(p);
  }
})('miniprogram');

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const short = file.replace(/^miniprogram\//, '');
  let added = 0;

  const next = src.replace(/<view(\s[^>]*?)>/g, (whole, attrs) => {
    const tappable = /(bindtap|catchtap)=/.test(attrs);
    if (!tappable) return whole;
    if (/hover-class=/.test(attrs)) return whole;
    added++;
    return '<view ' + HOVER + attrs + '>';
  });

  if (added) {
    total += added;
    console.log((WRITE ? '写入 ' : '待改 ') + short + '  ' + added + ' 处');
    if (WRITE) fs.writeFileSync(file, next, 'utf8');
  }
}
console.log('\n合计 ' + total + ' 处' + (WRITE ? '（已写入）' : '（dry run，加 --write 生效）'));
