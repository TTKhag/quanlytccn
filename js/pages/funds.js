/**
 * Funds Management
 */
const FundsPage = {
  async render(container) {
    await Services.refreshFundInterest();
    const funds = await Services.getFunds('active');
    const accounts = await Services.getBankAccounts();

    container.innerHTML = `
      <div class="section-header">
        <h2>Quản lý Quỹ</h2>
        <button class="btn btn-primary btn-sm" id="btn-add-fund">+ Tạo quỹ</button>
      </div>

      ${funds.length === 0 ? `
        <div class="empty-state">
          <div class="icon">◈</div>
          <p>Chưa có quỹ nào</p>
          <button class="btn btn-primary btn-sm" id="btn-add-fund-empty">Tạo quỹ đầu tiên</button>
        </div>
      ` : `
        <div class="grid" style="gap:1rem">
          ${funds.map(f => {
            const accrued = Math.max(0, (f.accruedInterest || 0) - (f.receivedInterest || 0));
            return `
              <div class="card">
                <div class="flex-between mb-1">
                  <div>
                    <strong>${f.name}</strong>
                    ${f.purpose ? `<div class="text-secondary" style="font-size:0.85rem">${f.purpose}</div>` : ''}
                  </div>
                  <div class="amount">${Utils.formatMoney(f.principal)}</div>
                </div>
                <div class="grid grid-2" style="font-size:0.85rem">
                  <div>Lãi tích lũy: <strong>${Utils.formatMoney(accrued)}</strong></div>
                  <div>Lãi đã nhận: <strong>${Utils.formatMoney(f.receivedInterest || 0)}</strong></div>
                </div>
                <div class="text-secondary mt-1" style="font-size:0.8rem">
                  Bắt đầu: ${Utils.formatDate(f.startDate)} · Lãi suất: ${f.interestRate || 0}%
                </div>
                <div class="mt-2 flex gap-1" style="flex-wrap:wrap">
                  <button class="btn btn-secondary btn-sm btn-deposit-fund" data-id="${f.id}">Nạp</button>
                  <button class="btn btn-secondary btn-sm btn-withdraw-fund" data-id="${f.id}">Rút</button>
                  <button class="btn btn-primary btn-sm btn-interest-fund" data-id="${f.id}">Nhận lãi</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    this._bind(container, accounts, funds);
  },

  _bind(container, accounts, funds) {
    const openCreate = async () => {
      await UI.promptForm('Tạo quỹ mới', [
        { name: 'name', label: 'Tên quỹ', required: true },
        { name: 'purpose', label: 'Mục đích' },
        { name: 'initialAmount', label: 'Số tiền ban đầu', type: 'number', min: 0, value: 0 },
        { name: 'source', label: 'Nguồn nạp', type: 'select', options: [
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
        ]},
        { name: 'interestRate', label: 'Lãi suất (%/năm)', type: 'number', value: 0, step: 0.01 },
        { name: 'interestMethod', label: 'Cách tính lãi', type: 'select', options: Utils.INTEREST_METHODS },
        { name: 'startDate', label: 'Ngày bắt đầu', type: 'date', value: Utils.today() },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ], async (data, close) => {
        const src = UI.parseSource(data.source || 'cash');
        await Services.createFund({
          name: data.name,
          purpose: data.purpose,
          initialAmount: Utils.parseNumber(data.initialAmount),
          sourceType: src.sourceType,
          sourceId: src.sourceId,
          interestRate: Utils.parseNumber(data.interestRate),
          interestMethod: data.interestMethod,
          startDate: data.startDate,
          note: data.note
        });
        UI.toast('Đã tạo quỹ', 'success');
        close();
        this.render(container);
      });
    };

    document.getElementById('btn-add-fund')?.addEventListener('click', openCreate);
    document.getElementById('btn-add-fund-empty')?.addEventListener('click', openCreate);

    container.querySelectorAll('.btn-deposit-fund').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fund = funds.find(f => f.id === Number(btn.dataset.id));
        await UI.promptForm(`Nạp vào quỹ: ${fund.name}`, [
          { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true },
          { name: 'source', label: 'Nguồn', type: 'select', options: [
            { value: 'cash', label: 'Tiền mặt' },
            ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
          ], required: true },
          { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
          { name: 'note', label: 'Ghi chú' }
        ], async (data, close) => {
          const src = UI.parseSource(data.source);
          await Services.depositToFund(fund.id, {
            amount: Utils.parseNumber(data.amount),
            sourceType: src.sourceType,
            sourceId: src.sourceId,
            note: data.note,
            date: data.date
          });
          UI.toast('Đã nạp quỹ', 'success');
          close();
          this.render(container);
        });
      });
    });

    container.querySelectorAll('.btn-withdraw-fund').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fund = funds.find(f => f.id === Number(btn.dataset.id));
        await UI.promptForm(`Rút từ quỹ: ${fund.name}`, [
          { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true, value: fund.principal },
          { name: 'target', label: 'Nhận về', type: 'select', options: [
            { value: 'cash', label: 'Tiền mặt' },
            ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
          ], required: true },
          { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
          { name: 'note', label: 'Ghi chú' }
        ], async (data, close) => {
          const tgt = UI.parseSource(data.target);
          await Services.withdrawFromFund(fund.id, {
            amount: Utils.parseNumber(data.amount),
            targetType: tgt.sourceType,
            targetId: tgt.sourceId,
            note: data.note,
            date: data.date
          });
          UI.toast('Đã rút quỹ', 'success');
          close();
          this.render(container);
        });
      });
    });

    container.querySelectorAll('.btn-interest-fund').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fund = funds.find(f => f.id === Number(btn.dataset.id));
        const accrued = Math.max(0, (fund.accruedInterest || 0) - (fund.receivedInterest || 0));
        await UI.promptForm(`Nhận lãi quỹ: ${fund.name}`, [
          { name: 'amount', label: 'Số lãi nhận', type: 'number', min: 0, value: accrued, required: true },
          { name: 'method', label: 'Cách nhận', type: 'select', options: [
            { value: 'add_to_fund', label: 'Cộng vào số dư quỹ' },
            { value: 'to_cash', label: 'Nhận về tiền mặt' },
            { value: 'to_bank', label: 'Nhận vào tài khoản NH' }
          ], required: true },
          { name: 'targetBank', label: 'Tài khoản NH (nếu chọn)', type: 'select', options: accounts.map(a => ({ value: a.id, label: a.bankName })) },
          { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
          { name: 'note', label: 'Ghi chú' }
        ], async (data, close) => {
          await Services.receiveFundInterest(fund.id, {
            amount: Utils.parseNumber(data.amount),
            method: data.method,
            targetType: data.method === 'to_cash' ? 'cash' : 'bank',
            targetId: data.method === 'to_bank' ? Number(data.targetBank) : null,
            note: data.note,
            date: data.date
          });
          UI.toast('Đã ghi nhận lãi quỹ', 'success');
          close();
          this.render(container);
        });
      });
    });
  }
};

window.FundsPage = FundsPage;
