// 首页：记录卡列表（FR-01）
const DB = require('../../utils/db.js');
const S = require('../../utils/stats.js');
const D = require('../../utils/date.js');

Page({
  data: {
    loading: true,
    today: '',
    dateLabel: '',
    greet: '',
    total: 0,
    cards: []
  },

  onLoad() {
    const today = D.todayKey();
    this.setData({
      today,
      dateLabel: this.fmtDateLabel(today),
      greet: this.fmtGreet()
    });
  },

  // 文案对齐原型：11月24日 · 周二
  fmtDateLabel(key) {
    return `${Number(key.slice(5, 7))}月${Number(key.slice(8))}日 · 周${D.weekdayLabel(key)}`;
  },

  // 文案对齐原型：下午好，稳住。
  fmtGreet() {
    const h = new Date().getHours();
    let word = '夜深了';
    if (h >= 5 && h < 9) word = '早上好';
    else if (h >= 9 && h < 12) word = '上午好';
    else if (h >= 12 && h < 14) word = '中午好';
    else if (h >= 14 && h < 18) word = '下午好';
    else if (h >= 18 && h < 23) word = '晚上好';
    return `${word}，稳住。`;
  },

  onShow() {
    // 跨零点从后台切回时重新取当天日期并刷新
    this.loadData();
  },

  onPullDownRefresh() {
    // 下拉是用户主动要最新数据，先让缓存失效，否则 15s 内会命中缓存看起来没刷新
    DB.invalidateCheckins();
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
        total: cards.length,
        today,
        dateLabel: this.fmtDateLabel(today)
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
