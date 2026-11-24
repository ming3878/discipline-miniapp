// 破戒记录页（FR-02）
const DB = require('../../utils/db.js');
const D = require('../../utils/date.js');

const MAX_COUNT = DB.MAX_COUNT; // 99，与写入层同一口径

Page({
  data: {
    habitId: '',
    habit: null,
    date: '',
    minDate: '',   // C4 起点：日期不得早于此
    maxDate: '',   // 今天：不得晚于此
    dateText: '',
    minLabel: '',
    periodLabel: '',
    count: 1,
    canMinus: false,
    canPlus: true,
    note: '',
    saving: false
  },

  async onLoad(options) {
    const habitId = options.habitId || '';
    const today = D.todayKey();
    this.setData({ habitId, date: today, maxDate: today, dateText: this.fmtDate(today) });
    if (!habitId) {
      wx.showToast({ title: '戒断目标不存在', icon: 'none' });
      return;
    }
    try {
      const habit = await DB.getHabitById(habitId);
      if (!habit) {
        wx.showToast({ title: '戒断目标不存在', icon: 'none' });
        return;
      }
      const periodMap = { day: '每天', week: '每周', month: '每月' };
      this.setData({
        habit,
        minDate: habit.startDate,
        minLabel: habit.startDate.slice(5),
        periodLabel: periodMap[habit.periodType] || '每周',
        dateText: this.fmtDate(today)
      });
      wx.setNavigationBarTitle({ title: '记录破戒' });
    } catch (err) {
      console.error('[记录页] 加载戒断目标失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 文案对齐原型：2026-11-24 · 今天
  fmtDate(key) {
    const today = this.data.maxDate || D.todayKey();
    let rel;
    if (key === today) rel = '今天';
    else if (key === D.shiftDay(today, -1)) rel = '昨天';
    else rel = `周${D.weekdayLabel(key)}`;
    return `${key} · ${rel}`;
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ date, dateText: this.fmtDate(date) });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  // 次数计步器：收敛到 [1, MAX_COUNT]，边界置灰
  setCount(n) {
    const v = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(n)) || 1));
    this.setData({ count: v, canMinus: v > 1, canPlus: v < MAX_COUNT });
  },

  minusCount() {
    if (this.data.count <= 1) return;
    this.setCount(this.data.count - 1);
  },

  plusCount() {
    if (this.data.count >= MAX_COUNT) return;
    this.setCount(this.data.count + 1);
  },

  async save() {
    if (this.data.saving) return;
    const { habitId, date, minDate, maxDate, note } = this.data;
    const count = Number(this.data.count);
    // 校验：次数为 [1, MAX_COUNT] 的整数
    if (!Number.isInteger(count) || count < 1) {
      wx.showToast({ title: '次数至少为 1', icon: 'none' });
      return;
    }
    if (count > MAX_COUNT) {
      wx.showToast({ title: `次数不能超过 ${MAX_COUNT}`, icon: 'none' });
      return;
    }
    // 校验：日期在 [C4, 今天] 之间
    if (date < minDate || date > maxDate) {
      wx.showToast({ title: '日期需在开始日期与今天之间', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await DB.addCheckin({ habitId, date, count, note: note.trim() });
      wx.showToast({ title: '已记录', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 600);
    } catch (err) {
      console.error('[记录页] 保存失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ saving: false });
    }
  }
});
