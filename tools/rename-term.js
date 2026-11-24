// 一次性术语替换：主题 → 戒断目标（仅改文案，不动标识符）
const fs = require('fs');
const path = require('path');

const targets = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|wxml|json|wxss)$/.test(p)) targets.push(p);
  }
})('miniprogram');

let changed = 0;
for (const f of targets) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('主题')) continue;
  let out = src.replace(/主题/g, '戒断目标');
  // —— 修掉替换后读不通的组合 ——
  out = out
    // 首页空态：原「点此创建第一个戒断主题」
    .replace(/创建第一个戒断戒断目标/g, '创建第一个戒断目标')
    // 记录页提示：太长，收成「戒断起点」
    .replace(/（戒断目标起点）/g, '（戒断起点）')
    // 总体统计两张卡片：去掉与「达成目标」撞车的「目标」
    .replace(/<view class="k">进行中戒断目标<\/view>/g, '<view class="k">进行中</view>')
    .replace(/<view class="k">坚持最久的戒断目标<\/view>/g, '<view class="k">坚持最久</view>');
  if (out !== src) {
    fs.writeFileSync(f, out);
    changed++;
    console.log('改写:', f);
  }
}
console.log('共改写 ' + changed + ' 个文件');
