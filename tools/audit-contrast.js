// 对比度回归：直接读 app.wxss 的令牌值，避免脚本与实际样式脱节
// 用法：node tools/audit-contrast.js
const fs = require('fs');

const css = fs.readFileSync('miniprogram/app.wxss', 'utf8');
const tk = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) tk[m[1]] = m[2];

function lum(hex) {
  const c = hex.replace('#', '').match(/../g)
    .map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const R = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// [说明, 前景, 背景, 阈值]；前景/背景可写令牌名或 #hex
const cases = [
  ['正文 ink / 纸底', 'ink', 'paper', 4.5],
  ['正文 ink / 白卡', 'ink', 'surface', 4.5],
  ['次级文字 sub / 纸底', 'sub', 'paper', 4.5],
  ['次级文字 sub / 白卡', 'sub', 'surface', 4.5],
  ['标签「正常」字 / 浅绿底', 'sage-ink', 'sage-soft', 4.5],
  ['标签「超标」字 / 浅红底', 'clay-ink', 'clay-soft', 4.5],
  ['月历 clean 数字 / 浅绿底', 'sage-ink', 'sage-soft', 4.5],
  ['月历 future 数字 / 浅灰底', 'sub', 'mist-soft', 4.5],
  ['白字 / 主按钮 墨绿', '#FFFFFF', 'pine', 4.5],
  ['白字 / 破戒格 赤陶', '#FFFFFF', 'clay', 4.5],
  ['白字 / 今日格 靛蓝', '#FFFFFF', 'indigo', 4.5],
  ['周视图 clean 块 / 白卡（图形）', 'sage-mid', 'surface', 1.5],
  ['周视图 future 块 / 白卡（图形）', 'mist-2', 'surface', 1.5],
  ['周视图 broken 块 / 白卡（图形）', 'clay', 'surface', 1.5],
  ['周视图 today 块 / 白卡（图形）', 'indigo', 'surface', 1.5],
];

let fail = 0;
console.log('令牌读取：' + Object.keys(tk).length + ' 个\n');
for (const [name, fg, bg, min] of cases) {
  const f = tk[fg] || fg;
  const b = tk[bg] || bg;
  if (!f || !b) {
    console.log('缺令牌 ->', name, fg, bg);
    fail++;
    continue;
  }
  const r = R(f, b);
  const ok = r >= min;
  if (!ok) fail++;
  console.log(name.padEnd(34), r.toFixed(2).padStart(5), ' ≥' + min, ok ? 'PASS' : 'FAIL');
}
console.log(fail ? '\n' + fail + ' 项不达标' : '\n全部达标');
process.exit(fail ? 1 : 0);
