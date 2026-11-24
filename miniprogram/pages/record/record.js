// 破戒记录页（FR-02）
const DB = require('../../utils/db.js');
const D = require('../../utils/date.js');

Page({
  data: {
    habitId: '',
    habit: null,
    date: '',
    minDate: '',   // C4 起点：日期不得早于此
    maxDate: '',   // 今天：不得晚于此
    dateText: '',
    count: 1,
    note: '',
    saving: false
  },

  async onLoad(options) {
    const habitId = options.habitId || '';
    const today = D.todayKey();
    this.setData({ habitId, date: today, maxDate: today });
    if (!habitId) {
      wx.showToast({ title: '主题不存在', icon: 'none' });
      return;
    }
    try {
      const habit = await DB.getHabitById(habitId);
      if (!habit) {
        wx.showToast({ title: '主题不存在', icon: 'none' });
        return;
      }
      this.setData({
        habit,
        minDate: habit.startDate,
        dateText: this.fmtDate(today)
      });
      wx.setNavigationBarTitle({ title: '记一次 · ' + habit.name });
    } catch (err) {
      console.error('[记录页] 加载主题失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  fmtDate(key) {
    const [y, m, d] = key.split('-');
    return `${y} 年 ${Number(m)} 月 ${Number(d)} 日 周${D.weekdayLabel(key)}`;
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ date, dateText: this.fmtDate(date) });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  minusCount() {
    if (this.data.count > 1) this.setData({ count: this.data.count - 1 });
  },

  plusCount() {
    this.setData({ count: this.data.count + 1 });
  },

  async save() {
    if (this.data.saving) return;
    const { habitId, date, minDate, maxDate, count, note } = this.data;
    // 校验：次数 >= 1
    if (!Number.isInteger(count) || count < 1) {
      wx.showToast({ title: '次数至少为 1', icon: 'none' });
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
