// 同步更新设计文档里的用户可见文案：主题 → 戒断目标
const fs = require('fs');

const jobs = [
  ['design/界面设计原型.html', [
    ['3 个主题正在坚持中', '3 个戒断目标正在坚持中'],
    ['<span class="ti">☰</span>主题</div>', '<span class="ti">☰</span>戒断目标</div>'],
    ['（主题起点）', '（戒断起点）'],
    ['03 · 主题管理页', '03 · 戒断目标管理页'],
    ['>我的主题<', '>我的戒断目标<'],
    ['＋ 新增主题', '＋ 新增戒断目标'],
    ['>主题统计<', '>戒断目标统计<'],
    ['趋势柱状 + 主题对比条形', '趋势柱状 + 戒断目标对比条形'],
    ['任一主题破戒即重新计时', '任一戒断目标破戒即重新计时'],
    ['<div class="k">进行中主题</div>', '<div class="k">进行中</div>'],
    ['<div class="k">坚持最久的主题</div>', '<div class="k">坚持最久</div>'],
    ['本月各主题破戒对比', '本月各戒断目标破戒对比'],
    ['首页 · 记录页 · 主题管理', '首页 · 记录页 · 戒断目标管理'],
    ['<div class="k">习惯始于</div>', '<div class="k">起始日</div>']
  ]],
  ['design/界面设计规范.md', [
    ['条形图（主题对比）', '条形图（戒断目标对比）'],
    ['"还没有主题，点此创建第一个"', '"还没有戒断目标，点此创建第一个"'],
    ['顶部主题条', '顶部戒断目标条'],
    ['| 03 主题管理 |', '| 03 戒断目标管理 |'],
    ['对比（主题）', '对比（戒断目标）']
  ]]
];

for (const [file, pairs] of jobs) {
  let src = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (src.includes(from)) {
      src = src.split(from).join(to);
      n++;
    } else {
      console.log('未命中（跳过）:', file, '|', from);
    }
  }
  fs.writeFileSync(file, src);
  console.log(`${file}：命中 ${n}/${pairs.length} 处`);
}
