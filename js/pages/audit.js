/**
 * Audit Log Page
 */
const AuditPage = {
  async render(container) {
    const logs = await Services.getAuditLogs();
    const limited = logs.slice(0, 200);

    container.innerHTML = `
      <div class="section-header">
        <h2>Lịch sử biến động</h2>
      </div>

      <div class="filters">
        <select class="form-control" id="audit-module">
          <option value="">Tất cả module</option>
          <option value="accounts">Tài khoản</option>
          <option value="transactions">Giao dịch</option>
          <option value="debts">Nợ</option>
          <option value="loans">Vay/Cho vay</option>
          <option value="funds">Quỹ</option>
          <option value="projections">Dự kiến</option>
          <option value="settings">Cài đặt</option>
        </select>
        <input type="date" class="form-control" id="audit-from" />
        <input type="date" class="form-control" id="audit-to" />
        <button class="btn btn-secondary btn-sm" id="btn-audit-filter">Lọc</button>
      </div>

      <div class="card">
        <p class="text-muted mb-1" style="font-size:0.8rem">Hiển thị tối đa 200 bản ghi gần nhất. Lịch sử không thể chỉnh sửa.</p>
        <div id="audit-list">${this._renderList(limited)}</div>
      </div>
    `;

    document.getElementById('btn-audit-filter').addEventListener('click', async () => {
      const module = document.getElementById('audit-module').value || undefined;
      const from = document.getElementById('audit-from').value || undefined;
      const to = document.getElementById('audit-to').value || undefined;
      const filtered = await Services.getAuditLogs({ module, from, to });
      document.getElementById('audit-list').innerHTML = this._renderList(filtered.slice(0, 200));
    });
  },

  _renderList(logs) {
    if (!logs.length) {
      return `<div class="empty-state"><p>Chưa có lịch sử</p></div>`;
    }
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Module</th>
              <th>Thao tác</th>
              <th>Nội dung</th>
              <th>Số tiền</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td style="white-space:nowrap">${Utils.formatDateTime(l.timestamp)}</td>
                <td><span class="badge badge-muted">${l.module}</span></td>
                <td>${l.action}</td>
                <td>${l.content || '—'}</td>
                <td class="amount ${l.amount > 0 ? 'positive' : l.amount < 0 ? 'negative' : ''}">${
                  l.amount != null ? Utils.formatMoney(l.amount, true) : '—'
                }</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
};

window.AuditPage = AuditPage;
