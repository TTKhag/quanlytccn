/**
 * Loans: Vay (received) & Cho vay (given)
 */
const LoansPage = {
  async render(container) {
    await Services.refreshLoanInterest();
    const received = await Services.getLoansReceived('active');
    const given = await Services.getLoansGiven('active');
    const accounts = await Services.getBankAccounts();

    container.innerHTML = `
      <div class="section-header">
        <h2>Vay & Cho vay</h2>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-sm" id="btn-add-loan-recv">+ Vay tiền</button>
          <button class="btn btn-secondary btn-sm" id="btn-add-loan-given">+ Cho vay</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="recv">Tôi vay (${received.length})</button>
        <button class="tab" data-tab="given">Tôi cho vay (${given.length})</button>
      </div>

      <div id="loans-recv">
        ${this._renderReceived(received)}
      </div>
      <div id="loans-given" class="hidden">
        ${this._renderGiven(given)}
      </div>
    `;

    this._bind(container, accounts, received, given);
  },

  _renderReceived(list) {
    if (!list.length) return `<div class="empty-state"><div class="icon">↑</div><p>Chưa có khoản vay</p></div>`;
    return `<div class="grid" style="gap:1rem">${list.map(l => {
      const remainP = Math.max(0, l.amount - (l.paidPrincipal || 0));
      const remainI = Math.max(0, (l.accruedInterest || 0) - (l.paidInterest || 0));
      return `
        <div class="card">
          <div class="flex-between mb-1">
            <strong>Vay từ: ${l.lenderName}</strong>
            <span class="amount negative">${Utils.formatMoney(remainP + remainI)}</span>
          </div>
          <div class="grid grid-3" style="font-size:0.85rem">
            <div>Gốc còn: <strong>${Utils.formatMoney(remainP)}</strong></div>
            <div>Lãi chưa trả: <strong>${Utils.formatMoney(remainI)}</strong></div>
            <div>LS suất: ${l.interestRate || 0}%</div>
          </div>
          <div class="text-secondary mt-1" style="font-size:0.8rem">
            Ngày vay: ${Utils.formatDate(l.startDate)}
            ${l.dueDate ? ` · Đến hạn: ${Utils.formatDate(l.dueDate)}` : ''}
          </div>
          <div class="mt-2">
            <button class="btn btn-primary btn-sm btn-pay-loan-recv" data-id="${l.id}">Trả vay</button>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  },

  _renderGiven(list) {
    if (!list.length) return `<div class="empty-state"><div class="icon">↑</div><p>Chưa có khoản cho vay</p></div>`;
    return `<div class="grid" style="gap:1rem">${list.map(l => {
      const remainP = Math.max(0, l.amount - (l.recoveredPrincipal || 0));
      const remainI = Math.max(0, (l.accruedInterest || 0) - (l.receivedInterest || 0));
      return `
        <div class="card">
          <div class="flex-between mb-1">
            <strong>Cho vay: ${l.borrowerName}</strong>
            <span class="amount positive">${Utils.formatMoney(remainP)}</span>
          </div>
          <div class="grid grid-3" style="font-size:0.85rem">
            <div>Gốc còn: <strong>${Utils.formatMoney(remainP)}</strong></div>
            <div>Lãi tích lũy: <strong>${Utils.formatMoney(remainI)}</strong></div>
            <div>Lãi suất: ${l.interestRate || 0}%</div>
          </div>
          <div class="text-secondary mt-1" style="font-size:0.8rem">
            Ngày cho vay: ${Utils.formatDate(l.startDate)}
            ${l.dueDate ? ` · Đến hạn: ${Utils.formatDate(l.dueDate)}` : ''}
          </div>
          <div class="mt-2">
            <button class="btn btn-primary btn-sm btn-recover-loan" data-id="${l.id}">Thu hồi</button>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  },

  _bind(container, accounts, received, given) {
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isRecv = tab.dataset.tab === 'recv';
        document.getElementById('loans-recv').classList.toggle('hidden', !isRecv);
        document.getElementById('loans-given').classList.toggle('hidden', isRecv);
      });
    });

    document.getElementById('btn-add-loan-recv')?.addEventListener('click', async () => {
      await UI.promptForm('Vay tiền', [
        { name: 'lenderName', label: 'Người / Tổ chức cho vay', required: true },
        { name: 'amount', label: 'Số tiền vay', type: 'number', min: 1, required: true },
        { name: 'interestRate', label: 'Lãi suất (%/năm)', type: 'number', value: 0, step: 0.01 },
        { name: 'interestMethod', label: 'Cách tính lãi', type: 'select', options: Utils.INTEREST_METHODS },
        { name: 'startDate', label: 'Ngày vay', type: 'date', value: Utils.today() },
        { name: 'dueDate', label: 'Ngày đến hạn', type: 'date' },
        { name: 'receiveTo', label: 'Nhận tiền vào', type: 'select', options: [
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
        ], required: true },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ], async (data, close) => {
        let receiveTo = 'cash', receiveAccountId = null;
        if (data.receiveTo.startsWith('bank:')) {
          receiveTo = 'bank';
          receiveAccountId = Number(data.receiveTo.split(':')[1]);
        }
        await Services.createLoanReceived({
          lenderName: data.lenderName,
          amount: Utils.parseNumber(data.amount),
          interestRate: Utils.parseNumber(data.interestRate),
          interestMethod: data.interestMethod,
          startDate: data.startDate,
          dueDate: data.dueDate || null,
          note: data.note,
          receiveTo,
          receiveAccountId
        });
        UI.toast('Đã ghi nhận khoản vay', 'success');
        close();
        this.render(container);
      });
    });

    document.getElementById('btn-add-loan-given')?.addEventListener('click', async () => {
      await UI.promptForm('Cho vay', [
        { name: 'borrowerName', label: 'Người vay', required: true },
        { name: 'amount', label: 'Số tiền cho vay', type: 'number', min: 1, required: true },
        { name: 'interestRate', label: 'Lãi suất (%/năm)', type: 'number', value: 0, step: 0.01 },
        { name: 'interestMethod', label: 'Cách tính lãi', type: 'select', options: Utils.INTEREST_METHODS },
        { name: 'startDate', label: 'Ngày cho vay', type: 'date', value: Utils.today() },
        { name: 'dueDate', label: 'Ngày đến hạn', type: 'date' },
        { name: 'source', label: 'Trừ từ nguồn', type: 'select', options: [
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
        ], required: true },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ], async (data, close) => {
        const src = UI.parseSource(data.source);
        await Services.createLoanGiven({
          borrowerName: data.borrowerName,
          amount: Utils.parseNumber(data.amount),
          interestRate: Utils.parseNumber(data.interestRate),
          interestMethod: data.interestMethod,
          startDate: data.startDate,
          dueDate: data.dueDate || null,
          note: data.note,
          sourceType: src.sourceType,
          sourceId: src.sourceId
        });
        UI.toast('Đã ghi nhận cho vay', 'success');
        close();
        this.render(container);
      });
    });

    container.querySelectorAll('.btn-pay-loan-recv').forEach(btn => {
      btn.addEventListener('click', async () => {
        const loan = received.find(l => l.id === Number(btn.dataset.id));
        if (!loan) return;
        const remainP = Math.max(0, loan.amount - (loan.paidPrincipal || 0));
        const remainI = Math.max(0, (loan.accruedInterest || 0) - (loan.paidInterest || 0));
        await UI.promptForm(`Trả vay: ${loan.lenderName}`, [
          { name: 'amount', label: 'Tổng trả', type: 'number', min: 1, required: true, value: remainP + remainI },
          { name: 'payInterest', label: 'Trả lãi', type: 'number', value: remainI, min: 0 },
          { name: 'payPrincipal', label: 'Trả gốc', type: 'number', value: remainP, min: 0 },
          { name: 'source', label: 'Nguồn tiền', type: 'select', options: [
            { value: 'cash', label: 'Tiền mặt' },
            ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
          ], required: true },
          { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
          { name: 'note', label: 'Ghi chú' }
        ], async (data, close) => {
          const src = UI.parseSource(data.source);
          await Services.payLoanReceived(loan.id, {
            amount: Utils.parseNumber(data.amount),
            payPrincipal: Utils.parseNumber(data.payPrincipal),
            payInterest: Utils.parseNumber(data.payInterest),
            sourceType: src.sourceType,
            sourceId: src.sourceId,
            note: data.note,
            date: data.date
          });
          UI.toast('Đã trả vay', 'success');
          close();
          this.render(container);
        });
      });
    });

    container.querySelectorAll('.btn-recover-loan').forEach(btn => {
      btn.addEventListener('click', async () => {
        const loan = given.find(l => l.id === Number(btn.dataset.id));
        if (!loan) return;
        const remainP = Math.max(0, loan.amount - (loan.recoveredPrincipal || 0));
        const remainI = Math.max(0, (loan.accruedInterest || 0) - (loan.receivedInterest || 0));
        await UI.promptForm(`Thu hồi: ${loan.borrowerName}`, [
          { name: 'amount', label: 'Tổng nhận', type: 'number', min: 1, required: true, value: remainP + remainI },
          { name: 'receiveInterest', label: 'Nhận lãi', type: 'number', value: remainI, min: 0 },
          { name: 'recoverPrincipal', label: 'Thu gốc', type: 'number', value: remainP, min: 0 },
          { name: 'target', label: 'Nhận vào', type: 'select', options: [
            { value: 'cash', label: 'Tiền mặt' },
            ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
          ], required: true },
          { name: 'date', label: 'Ngày', type: 'date', value: Utils.today() },
          { name: 'note', label: 'Ghi chú' }
        ], async (data, close) => {
          const tgt = UI.parseSource(data.target);
          await Services.recoverLoanGiven(loan.id, {
            amount: Utils.parseNumber(data.amount),
            recoverPrincipal: Utils.parseNumber(data.recoverPrincipal),
            receiveInterest: Utils.parseNumber(data.receiveInterest),
            targetType: tgt.sourceType,
            targetId: tgt.sourceId,
            note: data.note,
            date: data.date
          });
          UI.toast('Đã thu hồi', 'success');
          close();
          this.render(container);
        });
      });
    });
  }
};

window.LoansPage = LoansPage;
