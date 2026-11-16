/**
 * Reports Page
 */
const ReportsPage = {
  chart: null,

  async render(container) {
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = Utils.today();

    container.innerHTML = `
      <div class="section-header">
        <h2>Báo cáo</h2>
      </div>

      <div class="filters">
        <input type="date" class="form-control" id="rpt-from" value="${from}" />
        <span class="text-muted">→</span>
        <input type="date" class="form-control" id="rpt-to" value="${to}" />
        <button class="btn btn-primary btn-sm" id="btn-rpt-load">Xem báo cáo</button>
      </div>

      <div id="rpt-content">
        <div class="empty-state"><p>Chọn khoảng thời gian và nhấn Xem báo cáo</p></div>
      </div>
    `;

    document.getElementById('btn-rpt-load').addEventListener('click', () => this._load(container));
    // Auto load
    this._load(container);
  },

  async _load(container) {
    const from = document.getElementById('rpt-from').value;
    const to = document.getElementById('rpt-to').value;
    const ie = await Services.getIncomeExpenseSummary(from, to);
    const summary = await Services.getDashboardSummary();

    const content = document.getElementById('rpt-content');
    content.innerHTML = `
      <div class="grid grid-3 mb-2">
        <div class="stat-card positive">
          <div class="label">Tổng thu nhập</div>
          <div class="value">${Utils.formatMoney(ie.income)}</div>
        </div>
        <div class="stat-card negative">
          <div class="label">Tổng chi tiêu</div>
          <div class="value">${Utils.formatMoney(ie.expense)}</div>
        </div>
        <div class="stat-card ${ie.net >= 0 ? 'positive' : 'negative'}">
          <div class="label">Chênh lệch</div>
          <div class="value">${Utils.formatMoney(ie.net, true)}</div>
        </div>
      </div>

      <div class="grid grid-2 mb-2">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Theo danh mục</h3></div>
          <div class="chart-container"><canvas id="chart-cat"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Tóm tắt nợ & cho vay</h3></div>
          <div style="padding:0.5rem 0">
            <div class="flex-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <span>Tổng nợ phải trả</span>
              <strong class="text-danger">${Utils.formatMoney(summary.totalLiabilities)}</strong>
            </div>
            <div class="flex-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <span>Đang cho vay (gốc)</span>
              <strong class="text-success">${Utils.formatMoney(summary.totalLoanGivenP)}</strong>
            </div>
            <div class="flex-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <span>Lãi cho vay tích lũy</span>
              <strong>${Utils.formatMoney(summary.totalLoanGivenI)}</strong>
            </div>
            <div class="flex-between" style="padding:0.5rem 0">
              <span>Số dư quỹ</span>
              <strong>${Utils.formatMoney(summary.totalFundPrincipal)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Chi tiết giao dịch</h3></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Số tiền</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${ie.transactions.filter(t => t.type === 'income' || t.type === 'expense').map(t => `
                <tr>
                  <td>${Utils.formatDate(t.date)}</td>
                  <td><span class="badge badge-${t.type === 'income' ? 'success' : 'danger'}">${t.type === 'income' ? 'Thu' : 'Chi'}</span></td>
                  <td>${t.category}</td>
                  <td class="amount ${t.type === 'income' ? 'positive' : 'negative'}">${t.type === 'income' ? '+' : '-'}${Utils.formatMoney(t.amount)}</td>
                  <td class="text-secondary">${t.note || '—'}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="text-muted">Không có giao dịch</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Category chart
    if (this.chart) this.chart.destroy();
    const catLabels = Object.keys(ie.byCategory);
    const catData = catLabels.map(k => Math.abs(ie.byCategory[k]));
    const ctx = document.getElementById('chart-cat');
    if (ctx && catLabels.length) {
      this.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: catLabels,
          datasets: [{
            data: catData,
            backgroundColor: [
              '#c9a227', '#5b9fd4', '#2dd4a8', '#e05a5a', '#a78bfa',
              '#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#94a3b8'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: '#a8a5a0', boxWidth: 12 } }
          }
        }
      });
    }
  }
};

window.ReportsPage = ReportsPage;
