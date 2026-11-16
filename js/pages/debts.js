/**
 * Debts (Nợ phải trả) Page
 */
const DebtsPage = {
  async render(container) {
    await Services.refreshAllDebtInterest();
    const debts = await Services.getDebts('active');
    const closed = await Services.getDebts('closed');
    const accounts = await Services.getBankAccounts();

    container.innerHTML = `
      <div class="section-header">
        <h2>Nợ phải trả</h2>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-sm" id="btn-add-debt-bank">+ Nợ ngân hàng</button>
          <button class="btn btn-secondary btn-sm" id="btn-add-debt-cash">+ Nợ tiền mặt</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="active">Đang nợ (${debts.length})</button>
        <button class="tab" data-tab="closed">Đã tất toán (${closed.length})</button>
      </div>

      <div id="debts-active">
        ${this._renderList(debts, true)}
      </div>
      <div id="debts-closed" class="hidden">
        ${this._renderList(closed, false)}
      </div>
    `;

    this._bind(container, accounts, debts);
  },

  _renderList(list, canPay) {
    if (!list.length) {
      return `<div class="empty-state"><div class="icon">↓</div><p>Không có khoản nợ</p></div>`;
    }
    return `
      <div class="grid" style="gap:1rem">
        ${list.map(d => {
          const remainP = Math.max(0, (d.principal || 0) - (d.paidPrincipal || 0));
          const remainI = Math.max(0, (d.accruedInterest || 0) - (d.paidInterest || 0));
          const total = remainP + remainI;
          return `
            <div class="card">
              <div class="flex-between mb-1">
                <div>
                  <strong>${d.name}</strong>
                  <span class="badge badge-muted" style="margin-left:0.5rem">${d.type === 'bank' ? 'Ngân hàng' : 'Tiền mặt'}</span>
                </div>
                <div class="amount negative">${Utils.formatMoney(total)}</div>
              </div>
              <div class="text-secondary" style="font-size:0.85rem">
                ${d.type === 'bank' ? `${d.bankName || ''} · ${d.accountNumber || ''}` : ''}
                ${d.phone ? ` · ${d.phone}` : ''}
              </div>
              <div class="grid grid-3 mt-1" style="font-size:0.85rem">
                <div>Gốc còn: <strong>${Utils.formatMoney(remainP)}</strong></div>
                <div>Lãi chưa trả: <strong>${Utils.formatMoney(remainI)}</strong></div>
                <div>LS suất: ${d.interestRate || 0}%/năm</div>
              </div>
              ${d.dueDate ? `<div class="mt-1 text-secondary" style="font-size:0.8rem">Đến hạn: ${Utils.formatDate(d.dueDate)}</div>` : ''}
              ${canPay ? `
                <div class="mt-2 flex gap-1">
                  <button class="btn btn-primary btn-sm btn-pay-debt" data-id="${d.id}">Trả nợ</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _bind(container, accounts, debts) {
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isActive = tab.dataset.tab === 'active';
        document.getElementById('debts-active').classList.toggle('hidden', !isActive);
        document.getElementById('debts-closed').classList.toggle('hidden', isActive);
      });
    });

    document.getElementById('btn-add-debt-bank')?.addEventListener('click', async () => {
      await UI.promptForm('Thêm nợ ngân hàng / tín dụng', [
        { name: 'name', label: 'Tên khoản nợ / Mô tả', required: true, placeholder: 'VD: Thẻ tín dụng VCB' },
        { name: 'bankName', label: 'Ngân hàng', type: 'select', options: Utils.VIETNAMESE_BANKS, required: true },
        { name: 'accountNumber', label: 'Số tài khoản / Thẻ', required: true },
        { name: 'principal', label: 'Dư nợ gốc', type: 'number', min: 0, value: 0, required: true },
        { name: 'interestRate', label: 'Lãi suất (%/năm)', type: 'number', value: 0, step: 0.01 },
        { name: 'interestMethod', label: 'Cách tính lãi', type: 'select', options: Utils.INTEREST_METHODS },
        { name: 'startDate', label: 'Ngày bắt đầu', type: 'date', value: Utils.today() },
        { name: 'dueDate', label: 'Ngày đến hạn', type: 'date' },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ], async (data, close) => {
        await Services.createDebt({
          type: 'bank',
          name: data.name,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          principal: Utils.parseNumber(data.principal),
          interestRate: Utils.parseNumber(data.interestRate),
          interestMethod: data.interestMethod,
          startDate: data.startDate,
          dueDate: data.dueDate || null,
          note: data.note
        });
        UI.toast('Đã thêm khoản nợ', 'success');
        close();
        this.render(container);
      });
    });

    document.getElementById('btn-add-debt-cash')?.addEventListener('click', async () => {
      await UI.promptForm('Thêm nợ tiền mặt (cá nhân)', [
        { name: 'name', label: 'Họ tên chủ nợ', required: true },
        { name: 'phone', label: 'Số điện thoại' },
        { name: 'idNumber', label: 'CCCD / CMND' },
        { name: 'address', label: 'Địa chỉ' },
        { name: 'principal', label: 'Số tiền nợ', type: 'number', min: 0, value: 0, required: true },
        { name: 'interestRate', label: 'Lãi suất (%/năm)', type: 'number', value: 0, step: 0.01 },
        { name: 'interestMethod', label: 'Cách tính lãi', type: 'select', options: Utils.INTEREST_METHODS },
        { name: 'startDate', label: 'Ngày vay', type: 'date', value: Utils.today() },
        { name: 'dueDate', label: 'Ngày đến hạn', type: 'date' },
        { name: 'receiveTo', label: 'Tiền nhận vào', type: 'select', options: [
          { value: '', label: 'Không (chỉ ghi nhận nợ)' },
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
        ]},
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ], async (data, close) => {
        let receiveTo = null, receiveAccountId = null;
        if (data.receiveTo === 'cash') receiveTo = 'cash';
        else if (data.receiveTo?.startsWith('bank:')) {
          receiveTo = 'bank';
          receiveAccountId = Number(data.receiveTo.split(':')[1]);
        }
        await Services.createDebt({
          type: 'cash',
          name: data.name,
          phone: data.phone,
          idNumber: data.idNumber,
          address: data.address,
          principal: Utils.parseNumber(data.principal),
          interestRate: Utils.parseNumber(data.interestRate),
          interestMethod: data.interestMethod,
          startDate: data.startDate,
          dueDate: data.dueDate || null,
          note: data.note,
          receiveTo,
          receiveAccountId
        });
        UI.toast('Đã thêm khoản nợ', 'success');
        close();
        this.render(container);
      });
    });

    container.querySelectorAll('.btn-pay-debt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const debt = debts.find(d => d.id === Number(btn.dataset.id));
        if (!debt) return;
        const remainP = Math.max(0, (debt.principal || 0) - (debt.paidPrincipal || 0));
        const remainI = Math.max(0, (debt.accruedInterest || 0) - (debt.paidInterest || 0));
        const sourceOpts = [
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: `${a.bankName} (${Utils.formatMoney(a.balance)})` }))
        ];
        await UI.promptForm(`Trả nợ: ${debt.name}`, [
          { name: 'amount', label: 'Tổng số tiền trả', type: 'number', min: 1, required: true, value: remainP + remainI },
          { name: 'payInterest', label: 'Trong đó trả lãi', type: 'number', value: remainI, min: 0 },
          { name: 'payPrincipal', label: 'Trong đó trả gốc', type: 'number', value: remainP, min: 0 },
          { name: 'source', label: 'Nguồn tiền', type: 'select', options: sourceOpts, required: true },
          { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
          { name: 'note', label: 'Ghi chú', type: 'text' }
        ], async (data, close) => {
          const src = UI.parseSource(data.source);
          await Services.payDebt(debt.id, {
            amount: Utils.parseNumber(data.amount),
            payPrincipal: Utils.parseNumber(data.payPrincipal),
            payInterest: Utils.parseNumber(data.payInterest),
            sourceType: src.sourceType,
            sourceId: src.sourceId,
            note: data.note,
            date: data.date
          });
          UI.toast('Đã ghi nhận thanh toán', 'success');
          close();
          this.render(container);
        });
      });
    });
  }
};

window.DebtsPage = DebtsPage;
