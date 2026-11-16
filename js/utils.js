/**
 * Utilities
 */
const Utils = {
  formatMoney(amount, showSign = false) {
    const n = Number(amount) || 0;
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('vi-VN') + ' ₫';
    if (!showSign) return (n < 0 ? '-' : '') + formatted;
    if (n > 0) return '+' + formatted;
    if (n < 0) return '-' + formatted;
    return formatted;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  daysBetween(d1, d2) {
    const a = new Date(d1);
    const b = new Date(d2);
    a.setHours(0,0,0,0);
    b.setHours(0,0,0,0);
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  },

  parseNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return Number(String(val).replace(/[^\d.-]/g, '')) || 0;
  },

  debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  // Vietnamese banks list
  VIETNAMESE_BANKS: [
    'Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'VPBank',
    'MB Bank', 'HDBank', 'Sacombank', 'ACB', 'SHB',
    'LPBank', 'TPBank', 'MSB', 'VIB', 'SeABank',
    'OCB', 'Agribank', 'PVcomBank', 'Bac A Bank', 'ABBank',
    'Kienlongbank', 'BaoViet Bank', 'Nam A Bank', 'VietABank',
    'Khác'
  ],

  INTEREST_METHODS: [
    { value: 'simple_daily', label: 'Lãi đơn theo ngày' },
    { value: 'simple_monthly', label: 'Lãi đơn theo tháng' },
    { value: 'fixed', label: 'Lãi cố định (không tính theo thời gian)' }
  ]
};

window.Utils = Utils;
