// 主题管理页（FR-03 新增/编辑、FR-07 删除、排序）
const DB = require('../../utils/db.js');
const D = require('../../utils/date.js');

const EMOJIS = ['🚭', '🎮', '🌙', '🍺', '🍬', '📱', '🍖', '☕', '🚬', '🎲', '🛒', '💸', '🛌', '🍟', '🎬', '✍️'];
const PERIODS = [
  { key: 'day', label: '每天' },
  { key: 'week', label: '每周' },
  { key: 'month', label: '每月' }
];
const PERIOD_UNIT = { day: '天', week: '周', month: '月' };

Page({
  data: {
    loading: true,
    habits: [],
    // 编辑表单
    showForm: false,
    isEdit: false,
    editId: '',
    form: { name: '', subtitle: '', icon: '🚭', startDate: '', periodType: 'week', limit: 1 },
    emojis: EMOJIS,
    periods: PERIODS,
    periodUnit: PERIOD_UNIT,
    today: '',
    editMinDate: '',   // 编辑 C4 时：不得晚于最早破戒记录
    editMaxDate: '',   // 不得晚于今天
    // 记录数映射（用于判断编辑 C4 限制）
    earliestCheckin: {}
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const today = D.todayKey();
      const [habits, records] = await Promise.all([DB.getHabits(), DB.getAllCheckins()]);
      // 每个主题的最早破戒日期（编辑 C4 时作为上限）
      const earliest = {};
      for (const h of habits) {
        const dates = records.filter((r) => r.habitId === h._id).map((r) => r.date).sort();
        earliest[h._id] = dates.length ? dates[0] : '';
      }
      this.setData({ loading: false, habits, earliestCheckin: earliest, today });
    } catch (err) {
      console.error('[主题管理] 加载失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ---------- 新增 ----------
  addHabit() {
    const today = D.todayKey();
    this.setData({
      showForm: true,
      isEdit: false,
      editId: '',
      form: { name: '', subtitle: '', icon: '🚭', startDate: today, periodType: 'week', limit: 1 },
      editMinDate: '',
      editMaxDate: today
    });
  },

  // ---------- 编辑 ----------
  editHabit(e) {
    const id = e.currentTarget.dataset.id;
    const h = this.data.habits.find((x) => x._id === id);
    if (!h) return;
    const earliest = this.data.earliestCheckin[id];
    this.setData({
      showForm: true,
      isEdit: true,
      editId: id,
      form: {
        name: h.name,
        subtitle: h.subtitle || '',
        icon: h.icon || '🚭',
        startDate: h.startDate,
        periodType: h.periodType,
        limit: Number(h.limit)
      },
      // C4 不得晚于最早破戒记录（有记录时），也不得晚于今天
      editMinDate: '',
      editMaxDate: earliest || this.data.today
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  // 阻止表单点击冒泡
  noop() {},

  // ---------- 表单输入 ----------
  onNameInput(e) { this.setData({ 'form.name': e.detail.value }); },
  onSubInput(e) { this.setData({ 'form.subtitle': e.detail.value }); },

  pickEmoji(e) {
    this.setData({ 'form.icon': e.currentTarget.dataset.icon });
  },

  onStartChange(e) {
    this.setData({ 'form.startDate': e.detail.value });
  },

  onPeriodChange(e) {
    this.setData({ 'form.periodType': PERIODS[e.detail.value].key });
  },

  onLimitInput(e) {
    this.setData({ 'form.limit': e.detail.value });
  },

  // ---------- 保存 ----------
  async saveHabit() {
    const { form, isEdit, editId } = this.data;
    const name = (form.name || '').trim();
    const limit = Number(form.limit);
    // C1 标题非空
    if (!name) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    // X >= 1 正整数
    if (!Number.isInteger(limit) || limit < 1) {
      wx.showToast({ title: '上限至少为 1', icon: 'none' });
      return;
    }
    // C4 校验：不晚于今天，编辑时也不晚于最早破戒记录
    if (!form.startDate || form.startDate > this.data.today) {
      wx.showToast({ title: '开始日期不能晚于今天', icon: 'none' });
      return;
    }
    if (isEdit && this.data.editMaxDate && form.startDate > this.data.editMaxDate) {
      wx.showToast({ title: '开始日期不能晚于最早破戒记录', icon: 'none' });
      return;
    }

    const payload = {
      name,
      subtitle: (form.subtitle || '').trim(),
      icon: form.icon,
      startDate: form.startDate,
      periodType: form.periodType,
      limit
    };

    // C5 变更提示：编辑时改了周期类型或上限 → 全量重算提示
    if (isEdit) {
      const old = this.data.habits.find((x) => x._id === editId);
      const c5Changed = old && (old.periodType !== form.periodType || Number(old.limit) !== limit);
      if (c5Changed) {
        const confirmed = await this.confirm('修改目标后，历史统计将按新目标全部重算，确定继续？');
        if (!confirmed) return;
      }
    }

    try {
      if (isEdit) {
        await DB.updateHabit(editId, payload);
      } else {
        await DB.addHabit(payload);
      }
      this.setData({ showForm: false });
      wx.showToast({ title: isEdit ? '已更新' : '已创建', icon: 'success' });
      this.loadData();
    } catch (err) {
      console.error('[主题管理] 保存失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  // ---------- 删除 ----------
  async deleteHabit(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const confirmed = await this.confirm(`确定删除「${name}」？该主题的全部破戒记录也会一并删除，且不可恢复。`);
    if (!confirmed) return;
    try {
      await DB.deleteHabit(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadData();
    } catch (err) {
      console.error('[主题管理] 删除失败', err);
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  },

  // ---------- 排序 ----------
  async moveUp(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index <= 0) return;
    const ids = this.data.habits.map((h) => h._id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await this.applyOrder(ids);
  },

  async moveDown(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index >= this.data.habits.length - 1) return;
    const ids = this.data.habits.map((h) => h._id);
    [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
    await this.applyOrder(ids);
  },

  async applyOrder(ids) {
    try {
      await DB.reorderHabits(ids);
      this.loadData();
    } catch (err) {
      console.error('[主题管理] 排序失败', err);
      wx.showToast({ title: '排序失败', icon: 'none' });
    }
  },

  confirm(content) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '请确认',
        content,
        confirmText: '确定',
        cancelText: '取消',
        confirmColor: '#C0533B',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
  }
});
