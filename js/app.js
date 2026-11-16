/**
 * Dark Finance - Main Application
 */
const App = {
  currentPage: 'dashboard',
  pages: {
    dashboard: { title: 'Dashboard', render: () => DashboardPage.render },
    accounts: { title: 'Số dư & Tài khoản', render: () => AccountsPage.render },
    transactions: { title: 'Thu Chi', render: () => TransactionsPage.render },
    debts: { title: 'Nợ phải trả', render: () => DebtsPage.render },
    loans: { title: 'Vay & Cho vay', render: () => LoansPage.render },
    funds: { title: 'Quỹ', render: () => FundsPage.render },
    projections: { title: 'Dự kiến', render: () => ProjectionsPage.render },
    reports: { title: 'Báo cáo', render: () => ReportsPage.render },
    audit: { title: 'Lịch sử', render: () => AuditPage.render },
    settings: { title: 'Cài đặt', render: () => SettingsPage.render }
  },

  async init() {
    // Wait for DB
    await db.open();
    this._bindNav();
    this._bindGlobal();
    this.navigate(location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', () => {
      this.navigate(location.hash.slice(1) || 'dashboard');
    });
  },

  navigate(page) {
    if (!this.pages[page]) page = 'dashboard';
    this.currentPage = page;
    const conf = this.pages[page];

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    document.getElementById('page-title').textContent = conf.title;

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('show');

    // Render
    const container = document.getElementById('page-content');
    conf.render()(container).catch(err => {
      console.error(err);
      container.innerHTML = `<div class="empty-state"><p>Lỗi: ${err.message}</p></div>`;
    });
  },

  _bindNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.page;
        location.hash = page;
      });
    });

    // Mobile menu
    const sidebar = document.getElementById('sidebar');
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    });

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
  },

  _bindGlobal() {
    // Quick add
    document.getElementById('btn-quick-add')?.addEventListener('click', async () => {
      const { close } = UI.openModal({
        title: 'Thêm nhanh',
        body: `
          <div class="grid" style="gap:0.75rem">
            <button class="btn btn-secondary w-full" data-action="income">+ Thu nhập</button>
            <button class="btn btn-secondary w-full" data-action="expense">+ Chi tiêu</button>
            <button class="btn btn-secondary w-full" data-action="transfer">Chuyển tiền</button>
            <button class="btn btn-secondary w-full" data-action="accounts">Tài khoản</button>
          </div>
        `
      });
      document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          close();
          const a = btn.dataset.action;
          if (a === 'income' || a === 'expense') {
            location.hash = 'transactions';
            setTimeout(() => {
              document.getElementById(a === 'income' ? 'btn-add-income' : 'btn-add-expense')?.click();
            }, 300);
          } else if (a === 'transfer') {
            location.hash = 'accounts';
            setTimeout(() => document.getElementById('btn-transfer')?.click(), 300);
          } else {
            location.hash = a;
          }
        });
      });
    });

    // Backup shortcut
    document.getElementById('btn-backup')?.addEventListener('click', async () => {
      try {
        const data = await Services.exportBackup();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dark-finance-backup-${Utils.today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Đã xuất backup', 'success');
      } catch (e) {
        UI.toast(e.message, 'error');
      }
    });
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(err => {
    console.error('App init failed', err);
    document.getElementById('page-content').innerHTML =
      `<div class="empty-state"><p>Không thể khởi động ứng dụng: ${err.message}</p></div>`;
  });
});
