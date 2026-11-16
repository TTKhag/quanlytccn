/**
 * Accounts & Cash Page
 */
const AccountsPage = {
  async render(container) {
    const cash = await Services.getCashBalance();
    const accounts = await Services.getBankAccounts();
    const total = cash + accounts.reduce((s, a) => s + (a.balance || 0), 0);

    container.innerHTML = `
      <div class="section-header">
        <h2>Số dư & Tài khoản</h2>
        <div class="flex gap-1">
          <button class="btn btn-secondary btn-sm" id="btn-adjust-cash">Điều chỉnh tiền mặt</button>
          <button class="btn btn-primary btn-sm" id="btn-add-account">+ Tài khoản NH</button>
          <button class="btn btn-secondary btn-sm" id="btn-transfer">Chuyển tiền</button>
        </div>
      </div>

      <div class="grid grid-3 mb-2">
        <div class="stat-card accent">
          <div class="label">Tổng số dư</div>
          <div class="value">${Utils.formatMoney(total)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Tiền mặt</div>
          <div class="value">${Utils.formatMoney(cash)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Ngân hàng</div>
          <div class="value">${Utils.formatMoney(total - cash)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Tài khoản ngân hàng</h3>
        </div>
        ${accounts.length === 0 ? `
          <div class="empty-state">
            <div class="icon">◎</div>
            <p>Chưa có tài khoản ngân hàng</p>
            <button class="btn btn-primary btn-sm" id="btn-add-account-empty">Thêm tài khoản</button>
          </div>
        ` : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngân hàng</th>
                  <th>Số tài khoản</th>
                  <th>Chủ TK</th>
                  <th>Số dư</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${accounts.map(a => `
                  <tr>
                    <td><strong>${a.bankName}</strong></td>
                    <td>${a.accountNumber || '—'}</td>
                    <td>${a.ownerName || '—'}</td>
                    <td class="amount">${Utils.formatMoney(a.balance)}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm btn-edit-acc" data-id="${a.id}">Sửa</button>
                      <button class="btn btn-ghost btn-sm btn-del-acc" data-id="${a.id}">Xóa</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    this._bind(container, accounts);
  },

  _bind(container, accounts) {
    const addAcc = async () => {
      await UI.promptForm('Thêm tài khoản ngân hàng', [
        { name: 'bankName', label: 'Ngân hàng', type: 'select', options: Utils.VIETNAMESE_BANKS, required: true },
        { name: 'accountNumber', label: 'Số tài khoản', required: true },
        { name: 'ownerName', label: 'Tên chủ tài khoản' },
        { name: 'balance', label: 'Số dư ban đầu', type: 'number', value: 0, min: 0 },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ], async (data, close) => {
        await Services.createBankAccount(data);
        UI.toast('Đã thêm tài khoản', 'success');
        close();
        this.render(container);
      });
    };

    document.getElementById('btn-add-account')?.addEventListener('click', addAcc);
    document.getElementById('btn-add-account-empty')?.addEventListener('click', addAcc);

    document.getElementById('btn-adjust-cash')?.addEventListener('click', async () => {
      const current = await Services.getCashBalance();
      await UI.promptForm('Điều chỉnh tiền mặt', [
        { name: 'amount', label: 'Số dư mới', type: 'number', value: current, required: true },
        { name: 'reason', label: 'Lý do', type: 'text', required: true, placeholder: 'Ví dụ: Kiểm kê thực tế' }
      ], async (data, close) => {
        await Services.setCashBalance(Utils.parseNumber(data.amount), data.reason);
        UI.toast('Đã cập nhật tiền mặt', 'success');
        close();
        this.render(container);
      });
    });

    document.getElementById('btn-transfer')?.addEventListener('click', () => this._openTransfer(container, accounts));

    container.querySelectorAll('.btn-edit-acc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const acc = accounts.find(a => a.id === Number(btn.dataset.id));
        if (!acc) return;
        await UI.promptForm('Sửa tài khoản', [
          { name: 'bankName', label: 'Ngân hàng', type: 'select', options: Utils.VIETNAMESE_BANKS, value: acc.bankName, required: true },
          { name: 'accountNumber', label: 'Số tài khoản', value: acc.accountNumber, required: true },
          { name: 'ownerName', label: 'Tên chủ tài khoản', value: acc.ownerName },
          { name: 'note', label: 'Ghi chú', type: 'textarea', value: acc.note || '' }
        ], async (data, close) => {
          await Services.updateBankAccount(acc.id, data);
          UI.toast('Đã cập nhật', 'success');
          close();
          this.render(container);
        });
      });
    });

    container.querySelectorAll('.btn-del-acc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirm('Ẩn tài khoản này? Số dư phải = 0.');
        if (!ok) return;
        try {
          await Services.deleteBankAccount(btn.dataset.id);
          UI.toast('Đã xóa', 'success');
          this.render(container);
        } catch (e) {
          UI.toast(e.message, 'error');
        }
      });
    });
  },

  async _openTransfer(container, accounts) {
    const sourceOpts = [
      { value: 'cash', label: 'Tiền mặt' },
      ...accounts.map(a => ({ value: `bank:${a.id}`, label: `${a.bankName} (${Utils.formatMoney(a.balance)})` }))
    ];
    await UI.promptForm('Chuyển tiền nội bộ', [
      { name: 'from', label: 'Từ', type: 'select', options: sourceOpts, required: true },
      { name: 'to', label: 'Đến', type: 'select', options: sourceOpts, required: true },
      { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true },
      { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
      { name: 'note', label: 'Ghi chú', type: 'text' }
    ], async (data, close) => {
      if (data.from === data.to) throw new Error('Nguồn và đích phải khác nhau');
      const from = UI.parseSource(data.from);
      const to = UI.parseSource(data.to);
      await Services.transfer({
        fromType: from.sourceType,
        fromId: from.sourceId,
        toType: to.sourceType,
        toId: to.sourceId,
        amount: Utils.parseNumber(data.amount),
        note: data.note,
        date: data.date
      });
      UI.toast('Chuyển tiền thành công', 'success');
      close();
      this.render(container);
    });
  }
};

window.AccountsPage = AccountsPage;
