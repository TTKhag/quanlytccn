/**
 * Projections (Dự kiến)
 */
const ProjectionsPage = {
  async render(container) {
    const from = Utils.today();
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const to = d.toISOString().slice(0, 10);
    const list = await Services.getProjections({ from, to });

    container.innerHTML = `
      <div class="section-header">
        <h2>Dự kiến</h2>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-sm" id="btn-add-proj-income">+ Thu dự kiến</button>
          <button class="btn btn-secondary btn-sm" id="btn-add-proj-expense">+ Chi dự kiến</button>
        </div>
      </div>

      <div class="filters">
        <input type="date" class="form-control" id="proj-from" value="${from}" />
        <span class="text-muted">→</span>
        <input type="date" class="form-control" id="proj-to" value="${to}" />
        <button class="btn btn-secondary btn-sm" id="btn-proj-filter">Lọc</button>
      </div>

      <div class="card">
        <p class="text-secondary mb-2" style="font-size:0.85rem">
          Dữ liệu dự kiến <strong>không</strong> ảnh hưởng đến số dư thực tế. Chỉ khi bạn xác nhận và tạo giao dịch thật thì mới cập nhật.
        </p>
        <div id="proj-list">${this._renderList(list)}</div>
      </div>
    `;

    this._bind(container);
  },

  _renderList(list) {
    if (!list.length) {
      return `<div class="empty-state"><div class="icon">◷</div><p>Chưa có khoản dự kiến</p></div>`;
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
              <th>Trạng thái</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td>${Utils.formatDate(p.date)}</td>
                <td><span class="badge badge-${p.type === 'income' ? 'success' : 'danger'}">${p.type === 'income' ? 'Thu' : 'Chi'}</span></td>
                <td>${p.category || '—'}</td>
                <td class="amount">${Utils.formatMoney(p.amount)}</td>
                <td><span class="badge badge-${p.status === 'planned' ? 'info' : 'success'}">${p.status === 'planned' ? 'Dự kiến' : 'Đã xác nhận'}</span></td>
                <td class="text-secondary">${p.note || '—'}</td>
                <td>
                  ${p.status === 'planned' ? `<button class="btn btn-ghost btn-sm btn-confirm-proj" data-id="${p.id}">Xác nhận</button>` : ''}
                  <button class="btn btn-ghost btn-sm btn-del-proj" data-id="${p.id}">Xóa</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _bind(container) {
    const refresh = async () => {
      const from = document.getElementById('proj-from').value;
      const to = document.getElementById('proj-to').value;
      const list = await Services.getProjections({ from, to });
      document.getElementById('proj-list').innerHTML = this._renderList(list);
      this._bindActions(container);
    };

    document.getElementById('btn-proj-filter')?.addEventListener('click', refresh);

    document.getElementById('btn-add-proj-income')?.addEventListener('click', async () => {
      await UI.promptForm('Thu dự kiến', [
        { name: 'category', label: 'Nội dung', required: true },
        { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true },
        { name: 'date', label: 'Ngày dự kiến', type: 'date', value: Utils.today(), required: true },
        { name: 'note', label: 'Ghi chú' }
      ], async (data, close) => {
        await Services.addProjection({
          type: 'income',
          category: data.category,
          amount: Utils.parseNumber(data.amount),
          date: data.date,
          note: data.note
        });
        UI.toast('Đã thêm thu dự kiến', 'success');
        close();
        this.render(container);
      });
    });

    document.getElementById('btn-add-proj-expense')?.addEventListener('click', async () => {
      await UI.promptForm('Chi dự kiến', [
        { name: 'category', label: 'Nội dung', required: true },
        { name: 'amount', label: 'Số tiền', type: 'number', min: 1, required: true },
        { name: 'date', label: 'Ngày dự kiến', type: 'date', value: Utils.today(), required: true },
        { name: 'note', label: 'Ghi chú' }
      ], async (data, close) => {
        await Services.addProjection({
          type: 'expense',
          category: data.category,
          amount: Utils.parseNumber(data.amount),
          date: data.date,
          note: data.note
        });
        UI.toast('Đã thêm chi dự kiến', 'success');
        close();
        this.render(container);
      });
    });

    this._bindActions(container);
  },

  _bindActions(container) {
    container.querySelectorAll('.btn-confirm-proj').forEach(btn => {
      btn.addEventListener('click', async () => {
        await Services.confirmProjection(btn.dataset.id);
        UI.toast('Đã đánh dấu xác nhận. Hãy tạo giao dịch thật trong Thu Chi nếu cần.', 'info');
        this.render(container);
      });
    });
    container.querySelectorAll('.btn-del-proj').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirm('Xóa khoản dự kiến này?');
        if (!ok) return;
        await Services.deleteProjection(btn.dataset.id);
        UI.toast('Đã xóa', 'success');
        this.render(container);
      });
    });
  }
};

window.ProjectionsPage = ProjectionsPage;
