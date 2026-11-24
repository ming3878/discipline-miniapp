// 统计核心：所有口径集中在此，供首页 / 单卡统计 / 总体统计共用
// 约定：records 为 checkins 数组，每条含 { habitId, date, count, note, createdAt }
const D = require('./date.js');

// ---------- 基础聚合 ----------

// 按日期聚合破戒次数：{ 'YYYY-MM-DD': count }
function countByDate(records) {
  const map = {};
  for (const r of records) {
    map[r.date] = (map[r.date] || 0) + (Number(r.count) || 0);
  }
  return map;
}

// 去重后的破戒日期（升序）
function brokenDates(records) {
  return Array.from(new Set(records.map((r) => r.date))).sort();
}

// 某主题的全部记录
function recordsOf(habitId, records) {
  return records.filter((r) => r.habitId === habitId);
}

// 某主题在 [startKey, endKey] 闭区间内的破戒总次数
function countInRange(rs, startKey, endKey) {
  let sum = 0;
  for (const r of rs) {
    if (r.date >= startKey && r.date <= endKey) sum += Number(r.count) || 0;
  }
  return sum;
}

// ---------- 单卡：首页 A3~A6 与统计页 1.1~1.5 ----------

// A3 一周七日状态（固定周一至周日，与目标周期无关）
// 状态：broken / clean / today / future / beforeStart
function weekCells(habit, records, today) {
  const todayKey = today || D.todayKey();
  const byDate = countByDate(recordsOf(habit._id, records));
  return D.weekKeys(todayKey).map((key) => {
    const count = byDate[key] || 0;
    let state;
    if (key < habit.startDate) state = 'beforeStart';
    else if (key > todayKey) state = 'future';
    else if (count > 0) state = 'broken';
    else if (key === todayKey) state = 'today';
    else state = 'clean';
    return { key, label: D.weekdayLabel(key), short: D.shortDate(key), count, state };
  });
}

// A5 / 1.2 当前已戒：今天 - 最近破戒日期；无记录则从 startDate 起算
function currentCleanDays(habit, records, today) {
  const todayKey = today || D.todayKey();
  const rs = recordsOf(habit._id, records);
  const latest = rs.length ? rs.map((r) => r.date).sort().pop() : null;
  return Math.max(0, D.diffDays(latest || habit.startDate, todayKey));
}

// 1.3 最长已戒：序列 [C4, 全部破戒日期去重, 今天] 相邻最大自然日差
function longestCleanDays(habit, records, today) {
  const todayKey = today || D.todayKey();
  const dates = brokenDates(recordsOf(habit._id, records))
    .filter((d) => d >= habit.startDate && d <= todayKey);
  const seq = [habit.startDate].concat(dates);
  if (todayKey > seq[seq.length - 1]) seq.push(todayKey);
  let longest = 0;
  for (let i = 1; i < seq.length; i++) {
    longest = Math.max(longest, D.diffDays(seq[i - 1], seq[i]));
  }
  return longest;
}

// 1.4 合计破戒次数
function totalCount(habit, records) {
  return recordsOf(habit._id, records).reduce((s, r) => s + (Number(r.count) || 0), 0);
}

// A6 当前周期破戒次数（跟随 periodType）
function periodCount(habit, records, today) {
  const todayKey = today || D.todayKey();
  const rs = recordsOf(habit._id, records);
  if (habit.periodType === 'day') {
    return countInRange(rs, todayKey, todayKey);
  }
  if (habit.periodType === 'week') {
    return countInRange(rs, D.weekStart(todayKey), D.weekEnd(todayKey));
  }
  return countInRange(rs, D.monthFirst(todayKey.slice(0, 7)), D.monthLast(todayKey.slice(0, 7)));
}

// A4 当前周期是否超限
function isOverLimit(habit, records, today) {
  return periodCount(habit, records, today) > Number(habit.limit);
}

// 枚举从 startDate 所在周期到上一个完整周期的所有周期 [start, end]
// 首周期即使不完整也计入（用户确认）
function completedPeriods(habit, today) {
  const todayKey = today || D.todayKey();
  const periods = [];
  if (habit.periodType === 'day') {
    let cursor = habit.startDate;
    while (cursor < todayKey) {
      periods.push([cursor, cursor]);
      cursor = D.shiftDay(cursor, 1);
    }
  } else if (habit.periodType === 'week') {
    let start = D.weekStart(habit.startDate);
    const currentWeekStart = D.weekStart(todayKey);
    // 进行中的当前周不计入：只枚举周一严格早于本周一的周期
    while (start < currentWeekStart) {
      periods.push([start, D.weekEnd(start)]);
      start = D.shiftDay(start, 7);
    }
  } else {
    let month = habit.startDate.slice(0, 7);
    const currentMonth = todayKey.slice(0, 7);
    while (month < currentMonth) {
      periods.push([D.monthFirst(month), D.monthLast(month)]);
      month = D.shiftMonth(month, 1);
    }
  }
  return periods;
}

// 1.5 达成次数：已结束周期中破戒次数 <= 上限的个数
function achievedCount(habit, records, today) {
  const rs = recordsOf(habit._id, records);
  const limit = Number(habit.limit);
  return completedPeriods(habit, today).filter(([a, b]) => countInRange(rs, a, b) <= limit).length;
}

// 1.6 记录明细：该主题全部记录（倒序）
function recordList(habitId, records) {
  return recordsOf(habitId, records).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

// ---------- 月历 ----------

// 月历网格：返回按周分组的日期格，含前置占位 null
function monthCells(habit, records, month, today) {
  const todayKey = today || D.todayKey();
  const byDate = countByDate(recordsOf(habit._id, records));
  const cells = [];
  const firstWd = D.monthFirstWeekday(month); // 0=周日
  const padCount = firstWd === 0 ? 6 : firstWd - 1; // 周一为首列
  for (let i = 0; i < padCount; i++) cells.push(null);
  for (const key of D.monthKeys(month)) {
    const count = byDate[key] || 0;
    let state;
    if (key < habit.startDate) state = 'beforeStart';
    else if (key > todayKey) state = 'future';
    else if (count > 0) state = 'broken';
    else if (key === todayKey) state = 'today';
    else state = 'clean';
    cells.push({ key, day: Number(key.slice(-2)), count, state });
  }
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ---------- 总体统计 ----------

// 全局当前连续未破戒天数：今天 - 全局最近破戒日期；无记录取最早 startDate
function overallCleanDays(habits, records, today) {
  const todayKey = today || D.todayKey();
  const latest = records.length ? records.map((r) => r.date).sort().pop() : null;
  const start = latest || (habits.length
    ? habits.map((h) => h.startDate).sort()[0]
    : todayKey);
  return Math.max(0, D.diffDays(start, todayKey));
}

// 坚持最久主题：当前已戒天数最大者，并列取创建时间较早者
function longestHabit(habits, records, today) {
  let best = null;
  for (const h of habits) {
    const days = currentCleanDays(h, records, today);
    if (!best || days > best.days || (days === best.days && h.createdAt < best.createdAt)) {
      best = { habit: h, days };
    }
  }
  return best;
}

// 总体 4 项总览
function overallSummary(habits, records, today) {
  const best = longestHabit(habits, records, today);
  return {
    cleanDays: overallCleanDays(habits, records, today),
    totalCount: records.reduce((s, r) => s + (Number(r.count) || 0), 0),
    habitCount: habits.length,
    longest: best
  };
}

// ---------- 月度图形 ----------

// 近 n 个月破戒次数趋势（含当前月）
function monthlyTrend(records, today, n) {
  const months = D.lastNMonths(n || 6, today || D.todayKey());
  const byMonth = {};
  for (const r of records) {
    const m = r.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + (Number(r.count) || 0);
  }
  const data = months.map((m) => ({ month: m, label: D.monthLabel(m), count: byMonth[m] || 0 }));
  const max = Math.max(1, ...data.map((d) => d.count));
  return { data, max };
}

// 本月各主题破戒对比（降序）
function habitMonthCompare(habits, records, month, today) {
  const m = month || (today || D.todayKey()).slice(0, 7);
  const list = habits.map((h) => {
    const rs = recordsOf(h._id, records);
    return {
      habit: h,
      count: countInRange(rs, D.monthFirst(m), D.monthLast(m))
    };
  }).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...list.map((x) => x.count));
  return { list, max, month: m };
}

// ---------- 单卡统计页一次性取全部指标 ----------
function habitDetail(habit, records, today) {
  return {
    startDate: habit.startDate,
    cleanDays: currentCleanDays(habit, records, today),
    longestDays: longestCleanDays(habit, records, today),
    total: totalCount(habit, records),
    achieved: achievedCount(habit, records, today),
    periods: completedPeriods(habit, today).length,
    periodCount: periodCount(habit, records, today),
    overLimit: isOverLimit(habit, records, today)
  };
}

module.exports = {
  countByDate,
  brokenDates,
  recordsOf,
  weekCells,
  currentCleanDays,
  longestCleanDays,
  totalCount,
  periodCount,
  isOverLimit,
  completedPeriods,
  achievedCount,
  recordList,
  monthCells,
  overallCleanDays,
  longestHabit,
  overallSummary,
  monthlyTrend,
  habitMonthCompare,
  habitDetail
};
