// 统计口径端到端验证（对照需求文档 v1.3）
global.wx = { cloud: { database: () => ({ collection: () => ({}) }) } };
const S = require('../miniprogram/utils/stats.js');
const D = require('../miniprogram/utils/date.js');
const T = '2026-11-24'; // 周二
let fail = false;
function ok(name, got, exp) {
  const pass = JSON.stringify(got) === JSON.stringify(exp);
  console.log((pass ? 'PASS ' : 'FAIL ') + name + ' => ' + JSON.stringify(got) + (pass ? '' : ' (期望 ' + JSON.stringify(exp) + ')'));
  if (!pass) fail = true;
}

const habit = { _id: 'h1', name: '戒烟', startDate: '2026-11-01', periodType: 'week', limit: 2, createdAt: 1 };
// 破戒记录：11-05(1次)、11-05(2次 同日叠加)、11-20(1次)
const recs = [
  { habitId: 'h1', date: '2026-11-05', count: 1 },
  { habitId: 'h1', date: '2026-11-05', count: 2 },
  { habitId: 'h1', date: '2026-11-20', count: 1 }
];

console.log('--- 基础工具 ---');
ok('weekStart(周二)', D.weekStart(T), '2026-11-23');
ok('weekEnd(周二)', D.weekEnd(T), '2026-11-29');
ok('diffDays', D.diffDays('2026-11-01', T), 23);
ok('monthLast(2026-02)', D.monthLast('2026-02'), '2026-02-28');
ok('lastNMonths(6)', D.lastNMonths(6, T), ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']);

console.log('--- A3 一周五态 ---');
const cells = S.weekCells(habit, recs, T);
ok('A3 七天', cells.length, 7);
ok('A3 周一=已过未破戒', cells[0].state, 'clean');   // 11-23 周一 < 今天11-24，无记录 → clean
ok('A3 今天=today', cells[1].state, 'today');
ok('A3 周三=未来', cells[2].state, 'future');
console.log('  A3 明细:', cells.map(c => c.key.slice(5) + '(' + c.label + '):' + c.state).join(' '));

console.log('--- 单卡 1.1~1.5 ---');
ok('1.2 当前已戒(最近11-20→11-24)', S.currentCleanDays(habit, recs, T), 4);
ok('1.3 最长已戒(含C4起点)', S.longestCleanDays(habit, recs, T), 15); // 11-05→11-20 = 15
ok('1.4 合计破戒(同日叠加)', S.totalCount(habit, recs), 4);
ok('A6 本周破戒(本周11-23起,无记录)', S.periodCount(habit, recs, T), 0);
ok('1.5 达成次数(周目标)', S.achievedCount(habit, recs, T), 3); // 11-01所在周~11-16所在周 共3个完整周
ok('A4 是否超限', S.isOverLimit(habit, recs, T), false);

console.log('--- 边界：无记录 ---');
ok('1.3 无记录=C4到今天', S.longestCleanDays(habit, [], T), 23);
ok('1.2 无记录从C4', S.currentCleanDays(habit, [], T), 23);
ok('1.5 无记录达成次数(4个完整周)', S.achievedCount(habit, [], T), 4);

console.log('--- 边界：月目标 ---');
const monthHabit = Object.assign({}, habit, { periodType: 'month', limit: 3 });
ok('A6 月目标本月合计', S.periodCount(monthHabit, recs, T), 4);
ok('A4 月目标超限(4>3)', S.isOverLimit(monthHabit, recs, T), true);

console.log('--- 总体统计 ---');
const h2 = { _id: 'h2', name: '戒游戏', startDate: '2026-11-10', periodType: 'month', limit: 5, createdAt: 2 };
const allRecs = recs.concat([{ habitId: 'h2', date: '2026-11-22', count: 2 }]);
const sum = S.overallSummary([habit, h2], allRecs, T);
ok('总体连续天数(全局最近11-22)', sum.cleanDays, 2);
ok('总体累计破戒', sum.totalCount, 6);
ok('进行中主题数', sum.habitCount, 2);
console.log('  坚持最久:', sum.longest.habit.name, sum.longest.days, '天');

console.log('--- 月度图形 ---');
const trend = S.monthlyTrend(allRecs, T, 6);
ok('趋势月份数', trend.data.length, 6);
ok('11月破戒合计', trend.data[5].count, 6);
const cmp = S.habitMonthCompare([habit, h2], allRecs, '2026-11', T);
console.log('  本月主题对比:', cmp.list.map(x => x.habit.name + '=' + x.count).join(' '));

console.log(fail ? '\nFAIL 存在口径不符' : '\nPASS 全部口径验证通过');
process.exit(fail ? 1 : 0);
