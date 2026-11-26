// 原型假数据一致性校验：design/mock-data.json（唯一数据源）
//   → 用 miniprogram/utils/stats.js 的真实口径重算
//   → 逐屏比对 design/界面设计原型.html 里的数字、色块、图表比例
// 任何一边改了数据没同步，这里会 FAIL，退出码 1。
const fs = require('fs');
const path = require('path');
const S = require('../miniprogram/utils/stats.js');
const D = require('../miniprogram/utils/date.js');

const root = path.join(__dirname, '..');
const mock = JSON.parse(fs.readFileSync(path.join(root, 'design/mock-data.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'design/界面设计原型.html'), 'utf8');

const T = mock.today;
const habits = mock.habits.map((h) => ({
  _id: h.id,
  name: h.name,
  icon: h.icon,
  startDate: h.startDate,
  periodType: h.periodType,
  limit: h.limit,
  createdAt: h.createdAt
}));
const records = mock.records.map((r) => ({ habitId: r.habitId, date: r.date, count: r.count }));

let fail = 0;
function ok(label, cond, detail) {
  if (cond) console.log('  ✓ ' + label);
  else {
    console.log('  ✗ ' + label + (detail ? '\n      实际/期望：' + detail : ''));
    fail++;
  }
}
function eq(label, got, exp) {
  const pass = JSON.stringify(got) === JSON.stringify(exp);
  ok(label, pass, pass ? '' : JSON.stringify(got) + ' ≠ ' + JSON.stringify(exp));
}

// 原型色块类 ↔ 代码 state 的映射
function barClass(cell) {
  if (cell.state === 'broken') return cell.count > 1 ? 'b-broken-2' : 'b-broken';
  if (cell.state === 'clean') return 'b-clean';
  if (cell.state === 'today') return 'b-today';
  if (cell.state === 'beforeStart') return 'b-before';
  return 'b-future';
}

// 截取某一屏的 HTML 片段
function screen(no, from, to) {
  const a = html.indexOf(from);
  const b = to ? html.indexOf(to) : html.length;
  return a < 0 || b < 0 ? '' : html.slice(a, b);
}

console.log('数据源：' + mock.habits.length + ' 个戒断目标 / ' + mock.records.length + ' 条记录 / 今天 ' + T + '（周' + D.weekdayLabel(T) + '）');

// ---------- 01 首页 ----------
console.log('--- 01 首页 ---');
const home = screen('01', '01 · 首页', '02 · 破戒记录页');
const [, hm, hd] = T.split('-');
ok('顶部日期与星期', home.indexOf(`${Number(hm)}月${Number(hd)}日 · 周${D.weekdayLabel(T)}`) > -1);
const cards = home.split('<div class="habit"').slice(1);
eq('卡片数量', cards.length, habits.length);
habits.forEach((h, i) => {
  const card = cards[i] || '';
  const cells = S.weekCells(h, records, T);
  const streak = (card.match(/streak-num num[^>]*>(\d+)</) || [])[1];
  eq(`${h.name} 连续天数`, streak, String(S.currentCleanDays(h, records, T)));
  const bars = Array.from(card.matchAll(/class="bar (b-[\w-]+)"/g)).map((m) => m[1]);
  eq(`${h.name} 周视图七格`, bars, cells.map(barClass));
  const cnt = card.match(/本周破戒 <b class="([\w- ]+)">(\d+)<\/b> \/ (\d+) 次/);
  const pc = S.periodCount(h, records, T);
  const over = S.isOverLimit(h, records, T);
  eq(`${h.name} 本周次数`, cnt ? [cnt[1], cnt[2], cnt[3]] : null, [over ? 'cnt-clay num' : 'num', String(pc), String(h.limit)]);
  eq(`${h.name} 状态标签`, card.indexOf(over ? 'chip-over">已超限' : 'chip-ok">正常') > -1, true);
});

// ---------- 04 单卡统计 ----------
console.log('--- 04 单卡统计（' + habits[0].name + '）---');
const a = habits[0];
const det = S.habitDetail(a, records, T);
const d04 = screen('04', '04 · 单卡统计页', '05 · 记录明细页');
const mmdd = a.startDate.slice(5);
ok('起始日副标题', d04.indexOf(`每周不超过 ${a.limit} 次 · 始于 ${mmdd}`) > -1);
ok('起始日', d04.indexOf(`<div class="k">起始日</div><div class="v sm num">${mmdd}</div>`) > -1);
ok('当前已戒', d04.indexOf(`<div class="k">当前已戒</div><div class="v num">${det.cleanDays}<span class="u"> 天</span>`) > -1);
ok('最长已戒', d04.indexOf(`<div class="k">最长已戒</div><div class="v num">${det.longestDays}<span class="u"> 天</span>`) > -1);
ok('合计破戒', d04.indexOf(`<div class="k">合计破戒</div><div class="v num" style="color:var(--clay)">${det.total}<span class="u"> 次</span>`) > -1);
ok('达成目标', d04.indexOf(`<div class="k">达成目标</div><div class="v num">${det.achieved}<span class="u"> 次</span>`) > -1);
const month = T.slice(0, 7);
ok('月历月份标题', d04.indexOf(`${T.slice(0, 4)} 年 ${Number(T.slice(5, 7))} 月`) > -1);
const calExpected = S.monthCells(a, records, month, T)
  .flat()
  .filter(Boolean)
  .map((c) => ({
    cls: { broken: c.count > 1 ? 'c-broken-2' : 'c-broken', clean: 'c-clean', today: 'c-today', beforeStart: 'c-before', future: 'c-future' }[c.state],
    day: String(c.day)
  }));
const calGot = Array.from(d04.matchAll(/cal-cell (c-[\w-]+)">(\d+)</g)).map((m) => ({ cls: m[1], day: m[2] }));
eq('月历逐格状态', calGot, calExpected);
const padGot = (d04.match(/cal-grid">([\s\S]*?)<div class="cal-cell/) || ['', ''])[1].split('<div></div>').length - 1;
eq('月历首行占位格数', padGot, (D.monthFirstWeekday(month) === 0 ? 6 : D.monthFirstWeekday(month) - 1));

// ---------- 05 记录明细 ----------
console.log('--- 05 记录明细（' + a.name + '）---');
const d05 = screen('05', '05 · 记录明细页', '06 · 总体统计页');
const mine = mock.records.filter((r) => r.habitId === a._id).sort((x, y) => (x.date < y.date ? 1 : -1));
const latestMonth = mine.length ? mine[0].date.slice(0, 7) : T.slice(0, 7);
const inMonth = mine.filter((r) => r.date.slice(0, 7) === latestMonth);
const monthSum = inMonth.reduce((s, r) => s + r.count, 0);
ok('筛选月份', d05.indexOf(`${latestMonth.slice(0, 4)} 年 ${Number(latestMonth.slice(5))} 月`) > -1);
eq('条目数', (d05.match(/class="log-item"/g) || []).length, inMonth.length);
eq(
  '条目日期（倒序）',
  Array.from(d05.matchAll(/class="d num">(\d+)</g)).map((m) => m[1]),
  inMonth.map((r) => r.date.slice(8))
);
eq(
  '条目次数',
  Array.from(d05.matchAll(/class="c num">破戒 (\d+) 次</g)).map((m) => m[1]),
  inMonth.map((r) => String(r.count))
);
ok('底部汇总', d05.indexOf(`${Number(latestMonth.slice(5))} 月 · ${inMonth.length} 条记录 · 破戒 ${monthSum} 次`) > -1);

// ---------- 06 总体统计 ----------
console.log('--- 06 总体统计 ---');
const d06 = screen('06', '06 · 总体统计页');
const sum = S.overallSummary(habits, records, T);
ok('当前连续未破戒', d06.indexOf(`>${sum.cleanDays}<span class="u"> 天</span>`) > -1);
ok('累计破戒', d06.indexOf(`>${sum.totalCount}<span class="u"> 次</span>`) > -1);
ok('进行中目标数', d06.indexOf(`>${sum.habitCount}<span class="u"> 个</span>`) > -1);
ok('坚持最久', d06.indexOf(`${sum.longest.habit.icon} ${sum.longest.habit.name} · ${sum.longest.days} 天`) > -1);
const trend = S.monthlyTrend(records, T, 6);
eq(
  '六柱高度',
  Array.from(d06.matchAll(/class="bv( hot)?" style="height:(\d+)%"/g)).map((m) => Number(m[2])),
  trend.data.map((d) => Math.round((d.count / trend.max) * 100))
);
eq(
  '六柱最高月标红',
  Array.from(d06.matchAll(/class="bv( hot)?" style="height:\d+%"/g)).map((m) => !!m[1]),
  trend.data.map((d) => d.count === trend.max)
);
const cmp = S.habitMonthCompare(habits, records, month, T);
eq(
  '本月对比（降序）',
  Array.from(d06.matchAll(/<span>([^<]+)<\/span><span class="num">(\d+) 次<\/span>/g)).map((m) => m[1] + '=' + m[2]),
  cmp.list.map((x) => `${x.habit.icon} ${x.habit.name}=${x.count}`)
);
eq(
  '本月对比条宽',
  Array.from(d06.matchAll(/class="fill( hot)?" style="width:(\d+)%"/g)).map((m) => Number(m[2])),
  cmp.list.map((x) => Math.round((x.count / cmp.max) * 100))
);

// ---------- 02 破戒记录页 ----------
console.log('--- 02 破戒记录页（' + a.name + '）---');
const d02 = screen('02', '02 · 破戒记录页', '03 · 戒断目标管理页');
ok('目标提示（起始日/周期）', d02.indexOf(`始于 ${a.startDate} · 每周不超过 ${a.limit} 次`) > -1);
ok('日期默认今天', d02.indexOf(`${T} · 今天`) > -1);
ok('最早可选 = 起始日', d02.indexOf(`最早可选 ${a.startDate.slice(5)}（戒断起点）`) > -1);

// ---------- 03 戒断目标管理页 ----------
console.log('--- 03 戒断目标管理页 ---');
const d03 = screen('03', '03 · 戒断目标管理页', '04 · 单卡统计页');
habits.forEach((h) => {
  ok(`${h.name} 起始日/周期`, d03.indexOf(`始于 ${h.startDate.slice(5)} · 每周 ≤ ${h.limit} 次`) > -1);
});
ok('编辑表单开始日期与起始日一致', d03.indexOf(`>${a.startDate}</div>`) > -1);

// ---------- 文案卫生：内部代号不得进入界面 ----------
console.log('--- 界面文案：内部代号零泄漏 ---');
const protoCopyStart = html.indexOf('01 · 首页');
const protoCopyEnd = html.indexOf('<div class="footnote"');
const protoCopy = protoCopyStart >= 0 && protoCopyEnd > protoCopyStart
  ? html.slice(protoCopyStart, protoCopyEnd)
  : '';
ok('原型六屏文案无 C1~C5 编号', !/C[1-5]/.test(protoCopy));
ok('原型六屏文案无「上限次数 X」', protoCopy.indexOf('上限次数 X') === -1);
const wxmlCopy = ['habits', 'record']
  .map((n) => fs.readFileSync(path.join(root, `miniprogram/pages/${n}/${n}.wxml`), 'utf8'))
  .join('\n')
  .replace(/<!--[\s\S]*?-->/g, ''); // 代码注释允许保留需求编号
ok('真机表单文案无 C1~C5 编号', !/C[1-5]/.test(wxmlCopy));
ok('真机表单文案无「上限次数 X」', !/上限次数\s*X/.test(wxmlCopy));
ok('表单 label 原型与真机一致', d03.indexOf('从哪天开始戒') > -1 && d03.indexOf('>目标周期<') > -1);

console.log('');
if (fail) {
  console.log('原型数据校验：' + fail + ' 项不一致，请按 design/mock-data.json 重算后更新原型');
  process.exit(1);
}
console.log('原型数据校验：全部通过（数字、色块、图表比例与代码口径一致）');
