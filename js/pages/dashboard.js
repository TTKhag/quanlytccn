/**
 * Dashboard Page
 */
const DashboardPage = {
  charts: {},

  async render(container) {
    container.innerHTML = `<div class="loading" style="padding:2rem;color:var(--text-muted)">Đang tải...</div>`;
    try {
      const s = await Services.getDashboardSummary();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const monthEnd = Utils.today();
      const ie = await Services.getIncomeExpenseSummary(monthStart, monthEnd);

      container.innerHTML = `
        <div class="grid grid-4 mb-2">
          <div class="stat-card accent">
            <div class="label">Tài sản ròng</div>
            <div class="value">${Utils.formatMoney(s.netWorth)}</div>
            <div class="sub">Tài sản − Nợ phải trả</div>
          </div>
          <div class="stat-card">
            <div class="label">Tổng tài sản</div>
            <div class="value">${Utils.formatMoney(s.totalAssets)}</div>
            <div class="sub">Tiền + Cho vay + Quỹ</div>
          </div>
          <div class="stat-card negative">
            <div class="label">Tổng nợ phải trả</div>
            <div class="value">${Utils.formatMoney(s.totalLiabilities)}</div>
            <div class="sub">Gốc + Lãi chưa trả</div>
          </div>
          <div class="stat-card">
            <div class="label">Tiền thực tế</div>
            <div class="value">${Utils.formatMoney(s.cash + s.bankTotal)}</div>
            <div class="sub">Mặt: ${Utils.formatMoney(s.cash)} · NH: ${Utils.formatMoney(s.bankTotal)}</div>
          </div>
        </div>

        <div class="grid grid-3 mb-2">
          <div class="stat-card">
            <div class="label">Đang cho vay</div>
            <div class="value text-success">${Utils.formatMoney(s.totalLoanGivenP)}</div>
            <div class="sub">Lãi tích lũy: ${Utils.formatMoney(s.totalLoanGivenI)}</div>
          </div>
          <div class="stat-card">
            <div class="label">Số dư quỹ</div>
            <div class="value">${Utils.formatMoney(s.totalFundPrincipal)}</div>
            <div class="sub">Lãi tích lũy: ${Utils.formatMoney(s.totalFundAccrued)}</div>
          </div>
          <div class="stat-card">
            <div class="label">Thu − Chi tháng này</div>
            <div class="value ${ie.net >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatMoney(ie.net, true)}</div>
            <div class="sub">Thu ${Utils.formatMoney(ie.income)} · Chi ${Utils.formatMoney(ie.expense)}</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Phân bổ tài sản</h3>
            </div>
            <div class="chart-container">
              <canvas id="chart-assets"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Thu chi tháng này</h3>
            </div>
            <div class="chart-container">
              <canvas id="chart-ie"></canvas>
            </div>
          </div>
        </div>

        <div class="card mt-2">
          <div class="card-header">
            <h3 class="card-title">Cảnh báo & Sắp đến hạn</h3>
          </div>
          <div id="alerts-list"></div>
        </div>
      `;

      // Update sidebar net worth
      const nwEl = document.querySelector('#sidebar-net-worth .value');
      if (nwEl) nwEl.textContent = Utils.formatMoney(s.netWorth);

      this._renderCharts(s, ie);
      this._renderAlerts(s);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Lỗi tải dashboard: ${err.message}</p></div>`;
      console.error(err);
    }
  },

  _renderCharts(s, ie) {
    // Destroy old
    Object.values(this.charts).forEach(c => c.destroy());
    this.charts = {};

    const assetData = [
      s.cash,
      s.bankTotal,
      s.totalLoanGivenP,
      s.totalFundPrincipal
    ];
    const assetLabels = ['Tiền mặt', 'Ngân hàng', 'Cho vay', 'Quỹ'];
    const colors = ['#c9a227', '#5b9fd4', '#2dd4a8', '#a78bfa'];

    const ctx1 = document.getElementById('chart-assets');
    if (ctx1 && assetData.some(v => v > 0)) {
      this.charts.assets = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: assetLabels,
          datasets: [{ data: assetData, backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#a8a5a0', padding: 16 } }
          }
        }
      });
    } else if (ctx1) {
      ctx1.parentElement.innerHTML = '<div class="empty-state"><p>Chưa có dữ liệu tài sản</p></div>';
    }

    const ctx2 = document.getElementById('chart-ie');
    if (ctx2) {
      this.charts.ie = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['Thu nhập', 'Chi tiêu'],
          datasets: [{
            data: [ie.income, ie.expense],
            backgroundColor: ['rgba(45,212,168,0.7)', 'rgba(224,90,90,0.7)'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: '#6b6864' }, grid: { color: '#2a2a3a' } },
            x: { ticks: { color: '#a8a5a0' }, grid: { display: false } }
          }
        }
      });
    }
  },

  _renderAlerts(s) {
    const el = document.getElementById('alerts-list');
    const alerts = [];
    const today = Utils.today();

    // Overdue / upcoming loans given
    for (const l of s.loansGiven) {
      if (l.dueDate) {
        const days = Utils.daysBetween(today, l.dueDate);
        if (days < 0) alerts.push({ type: 'danger', text: `Cho vay ${l.borrowerName} đã quá hạn ${-days} ngày` });
        else if (days <= 7) alerts.push({ type: 'warning', text: `Cho vay ${l.borrowerName} đến hạn trong ${days} ngày` });
      }
    }
    for (const l of s.loansRecv) {
      if (l.dueDate) {
        const days = Utils.daysBetween(today, l.dueDate);
        if (days < 0) alerts.push({ type: 'danger', text: `Khoản vay từ ${l.lenderName} đã quá hạn ${-days} ngày` });
        else if (days <= 7) alerts.push({ type: 'warning', text: `Khoản vay từ ${l.lenderName} đến hạn trong ${days} ngày` });
      }
    }
    for (const d of s.debts) {
      if (d.dueDate) {
        const days = Utils.daysBetween(today, d.dueDate);
        if (days < 0) alerts.push({ type: 'danger', text: `Nợ ${d.name} đã quá hạn ${-days} ngày` });
        else if (days <= 7) alerts.push({ type: 'warning', text: `Nợ ${d.name} đến hạn trong ${days} ngày` });
      }
    }

    if (alerts.length === 0) {
      el.innerHTML = '<p class="text-muted" style="padding:0.5rem 0">Không có cảnh báo sắp đến hạn.</p>';
      return;
    }
    el.innerHTML = alerts.map(a => `
      <div style="padding:0.6rem 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.75rem">
        <span class="badge badge-${a.type === 'danger' ? 'danger' : 'warning'}">${a.type === 'danger' ? 'Quá hạn' : 'Sắp đến'}</span>
        <span>${a.text}</span>
      </div>
    `).join('');
  }
};

window.DashboardPage = DashboardPage;
