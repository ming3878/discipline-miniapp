// 首页：记录卡列表（FR-01）
const DB = require('../../utils/db.js');
const S = require('../../utils/stats.js');
const D = require('../../utils/date.js');

Page({
  data: {
    loading: true,
    today: '',
    dateLabel: '',
    cards: []
  },

  onLoad() {
    const today = D.todayKey();
    this.setData({
      today,
      dateLabel: `${today.slice(5, 7)}月${today.slice(8)}日 周${D.weekdayLabel(today)}`
    });
  },

  onShow() {
    // 跨零点从后台切回时重新取当天日期并刷新
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const today = D.todayKey();
      const [habits, records] = await Promise.all([DB.getHabits(), DB.getAllCheckins()]);
      const cards = habits.map((h) => {
        const detail = S.habitDetail(h, records, today);
        const periodNames = { day: '今日', week: '本周', month: '本月' };
        return {
          id: h._id,
          icon: h.icon,
          name: h.name,
          subtitle: h.subtitle,
          weekCells: S.weekCells(h, records, today),
          overLimit: detail.overLimit,
          cleanDays: detail.cleanDays,
          periodCount: detail.periodCount,
          limit: Number(h.limit),
          periodName: periodNames[h.periodType] || '本周期'
        };
      });
      this.setData({
        loading: false,
        cards,
        today,
        dateLabel: `${today.slice(5, 7)}月${today.slice(8)}日 周${D.weekdayLabel(today)}`
      });
    } catch (err) {
      console.error('[首页] 加载失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  goRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/record/record?habitId=${id}` });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/habit-stats/habit-stats?id=${id}` });
  },

  goHabits() {
    wx.switchTab({ url: '/pages/habits/habits' });
  }
});
