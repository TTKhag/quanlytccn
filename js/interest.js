/**
 * Interest calculation engine
 * Consistent rules:
 * - Simple interest by default
 * - Interest only recognized as income/expense when actually received/paid
 * - Accrued interest is tracked separately
 */
const Interest = {
  /**
   * Calculate accrued interest from startDate to asOfDate
   * @param {number} principal
   * @param {number} rate - annual rate in % (e.g. 12 for 12%)
   * @param {string} method - simple_daily | simple_monthly | fixed
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} asOfDate - YYYY-MM-DD
   * @param {number} fixedAmount - for fixed method
   */
  calculateAccrued(principal, rate, method, startDate, asOfDate, fixedAmount = 0) {
    if (!principal || principal <= 0) return 0;
    const start = new Date(startDate);
    const end = new Date(asOfDate || Utils.today());
    if (end < start) return 0;

    if (method === 'fixed') {
      return Number(fixedAmount) || 0;
    }

    const days = Utils.daysBetween(startDate, asOfDate || Utils.today());
    if (days <= 0) return 0;

    const annualRate = (Number(rate) || 0) / 100;

    if (method === 'simple_daily') {
      // Interest = P * r * days / 365
      return Math.round(principal * annualRate * days / 365);
    }

    if (method === 'simple_monthly') {
      // Approximate months = days / 30
      const months = days / 30;
      return Math.round(principal * annualRate * months / 12);
    }

    return 0;
  },

  /**
   * Calculate interest for a period with partial payments considered
   * Simplified: interest on remaining principal
   */
  calculateOnRemaining(principal, rate, method, startDate, asOfDate, paidInterest = 0) {
    const accrued = this.calculateAccrued(principal, rate, method, startDate, asOfDate);
    return Math.max(0, accrued - paidInterest);
  },

  /**
   * Round money to nearest VND (integer)
   */
  round(amount) {
    return Math.round(Number(amount) || 0);
  }
};

window.Interest = Interest;
