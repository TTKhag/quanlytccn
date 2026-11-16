/**
 * Income & Expense Page
 */
const TransactionsPage = {
  async render(container) {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const to = Utils.today();
    const txs = await Services.getTransactions({ from, to });
    const accounts = await Services.getBankAccounts();
    const debts = await Services.getDebts('active');
    const incomeCats = await Services.getCategories('income');
    const expenseCats = await Services.getCategories('expense');

    container.innerHTML = `
      <div class="section-header">
        <h2>Thu Chi</h2>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-sm" id="btn-add-income">+ Thu nhập</button>
          <button class="btn btn-secondary btn-sm" id="btn-add-expense">+ Chi tiêu</button>
        </div>
      </div>

      <div class="filters">
        <input type="date" class="form-control" id="filter-from" value="${from}" />
        <span class="text-muted">→</span>
        <input type="date" class="form-control" id="filter-to" value="${to}" />
        <select class="form-control" id="filter-type">
          <option value="">Tất cả loại</option>
          <option value="income">Thu nhập</option>
          <option value="expense">Chi tiêu</option>
          <option value="transfer">Chuyển khoản</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-filter">Lọc</button>
      </div>

      <div class="card">
        <div id="tx-list">
          ${this._renderTable(txs)}
        </div>
      </div>
    `;

    this._bind(container, accounts, debts, incomeCats, expenseCats);
  },

  _renderTable(txs) {
    if (!txs.length) {
      return `<div class="empty-state"><div class="icon">⇄</div><p>Chưa có giao dịch trong khoảng thời gian này</p></div>`;
    }
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Danh mục</th>
              <th>Số tiền</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${txs.map(t => `
              <tr>
                <td>${Utils.formatDate(t.date)}</td>
                <td><span class="badge badge-${t.type === 'income' ? 'success' : t.type === 'expense' ? 'danger' : 'info'}">${
                  t.type === 'income' ? 'Thu' : t.type === 'expense' ? 'Chi' : 'Chuyển'
                }</span></td>
                <td>${t.category || '—'}</td>
                <td class="amount ${t.type === 'income' ? 'positive' : t.type === 'expense' ? 'negative' : ''}">${
                  t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''
                }${Utils.formatMoney(t.amount)}</td>
                <td class="text-secondary">${t.note || '—'}</td>
                <td>
                  ${t.type !== 'transfer' ? `<button class="btn btn-ghost btn-sm btn-edit-tx" data-id="${t.id}">Sửa</button>` : ''}
                  <button class="btn btn-ghost btn-sm btn-del-tx" data-id="${t.id}">Xóa</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _bind(container, accounts, debts, incomeCats, expenseCats) {
    const refresh = async () => {
      const from = document.getElementById('filter-from').value;
      const to = document.getElementById('filter-to').value;
      const type = document.getElementById('filter-type').value;
      const txs = await Services.getTransactions({ from, to, type: type || undefined });
      document.getElementById('tx-list').innerHTML = this._renderTable(txs);
      this._bindTableActions(container, accounts, debts, incomeCats, expenseCats);
    };

    document.getElementById('btn-filter')?.addEventListener('click', refresh);

    document.getElementById('btn-add-income')?.addEventListener('click', async () => {
      const catOpts = incomeCats.map(c => c.name);
      await UI.promptForm('Thêm thu nhập', [
        { name: 'category', label: 'Danh mục', type: 'select', options: catOpts, required: true },
        { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true },
        { name: 'date', label: 'Ngày', type: 'date', value: Utils.today(), required: true },
        { name: 'source', label: 'Nhận vào', type: 'select', options: [
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: `${a.bankName}` }))
        ], required: true },
        { name: 'note', label: 'Ghi chú', type: 'text' }
      ], async (data, close) => {
        const src = UI.parseSource(data.source);
        await Services.addTransaction({
          type: 'income',
          category: data.category,
          amount: Utils.parseNumber(data.amount),
          date: data.date,
          sourceType: src.sourceType,
          sourceId: src.sourceId,
          note: data.note
        });
        UI.toast('Đã ghi nhận thu nhập', 'success');
        close();
        this.render(container);
      });
    });

    document.getElementById('btn-add-expense')?.addEventListener('click', async () => {
      const catOpts = expenseCats.map(c => c.name);
      const sourceOpts = [
        { value: 'cash', label: 'Tiền mặt' },
        ...accounts.map(a => ({ value: `bank:${a.id}`, label: `${a.bankName}` })),
        ...debts.map(d => ({ value: `debt:${d.id}`, label: `Từ nợ: ${d.name}` }))
      ];
      await UI.promptForm('Thêm chi tiêu', [
        { name: 'category', label: 'Danh mục', type: 'select', options: catOpts, required: true },
        { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true },
        { name: 'date', label: 'Ngày', type: 'date', value: Utils.today(), required: true },
        { name: 'source', label: 'Chi từ', type: 'select', options: sourceOpts, required: true },
        { name: 'note', label: 'Lý do / Ghi chú', type: 'text' }
      ], async (data, close) => {
        const src = UI.parseSource(data.source);
        await Services.addTransaction({
          type: 'expense',
          category: data.category,
          amount: Utils.parseNumber(data.amount),
          date: data.date,
          sourceType: src.sourceType,
          sourceId: src.sourceId,
          note: data.note
        });
        UI.toast('Đã ghi nhận chi tiêu', 'success');
        close();
        this.render(container);
      });
    });

    this._bindTableActions(container, accounts, debts, incomeCats, expenseCats);
  },

  _bindTableActions(container, accounts, debts, incomeCats, expenseCats) {
    container.querySelectorAll('.btn-del-tx').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirm('Xóa giao dịch này? Số dư sẽ được hoàn tác.');
        if (!ok) return;
        try {
          await Services.deleteTransaction(btn.dataset.id);
          UI.toast('Đã xóa', 'success');
          this.render(container);
        } catch (e) {
          UI.toast(e.message, 'error');
        }
      });
    });

    container.querySelectorAll('.btn-edit-tx').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tx = await db.transactions.get(Number(btn.dataset.id));
        if (!tx) return;
        const cats = tx.type === 'income' ? incomeCats : expenseCats;
        const sourceOpts = [
          { value: 'cash', label: 'Tiền mặt' },
          ...accounts.map(a => ({ value: `bank:${a.id}`, label: a.bankName }))
        ];
        if (tx.type === 'expense') {
          debts.forEach(d => sourceOpts.push({ value: `debt:${d.id}`, label: `Từ nợ: ${d.name}` }));
        }
        const currentSource = tx.sourceType === 'bank' ? `bank:${tx.sourceId}` :
          tx.sourceType === 'debt' ? `debt:${tx.sourceId}` : 'cash';

        await UI.promptForm('Sửa giao dịch', [
          { name: 'category', label: 'Danh mục', type: 'select', options: cats.map(c => c.name), value: tx.category, required: true },
          { name: 'amount', label: 'Số tiền', type: 'number', value: tx.amount, min: 1, required: true },
          { name: 'date', label: 'Ngày', type: 'date', value: tx.date, required: true },
          { name: 'source', label: 'Nguồn', type: 'select', options: sourceOpts, value: currentSource, required: true },
          { name: 'note', label: 'Ghi chú', type: 'text', value: tx.note || '' }
        ], async (data, close) => {
          const src = UI.parseSource(data.source);
          await Services.updateTransaction(tx.id, {
            type: tx.type,
            category: data.category,
            amount: Utils.parseNumber(data.amount),
            date: data.date,
            sourceType: src.sourceType,
            sourceId: src.sourceId,
            note: data.note
          });
          UI.toast('Đã cập nhật', 'success');
          close();
          this.render(container);
        });
      });
    });
  }
};

window.TransactionsPage = TransactionsPage;
