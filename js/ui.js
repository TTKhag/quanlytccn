/**
 * UI helpers: modal, toast, form rendering
 */
const UI = {
  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  openModal({ title, body, footer, size = '' }) {
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="icon-btn modal-close" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    root.appendChild(overlay);

    const close = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.querySelector('.modal-close').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    // Escape
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    return { overlay, close, body: overlay.querySelector('.modal-body') };
  },

  confirm(message, title = 'Xác nhận') {
    return new Promise((resolve) => {
      const { close } = this.openModal({
        title,
        body: `<p style="color:var(--text-secondary)">${message}</p>`,
        footer: `
          <button class="btn btn-ghost" id="cfm-cancel">Hủy</button>
          <button class="btn btn-primary" id="cfm-ok">Đồng ý</button>
        `
      });
      document.getElementById('cfm-cancel').onclick = () => { close(); resolve(false); };
      document.getElementById('cfm-ok').onclick = () => { close(); resolve(true); };
    });
  },

  async promptForm(title, fields, onSubmit) {
    // fields: [{name, label, type, value, options, required, fullWidth}]
    const bodyHtml = fields.map(f => {
      if (f.type === 'select') {
        const opts = (f.options || []).map(o => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return `<option value="${v}" ${f.value == v ? 'selected' : ''}>${l}</option>`;
        }).join('');
        return `<div class="form-group ${f.fullWidth ? '' : ''}">
          <label>${f.label}${f.required ? ' *' : ''}</label>
          <select class="form-control" name="${f.name}" ${f.required ? 'required' : ''}>${opts}</select>
        </div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="form-group">
          <label>${f.label}</label>
          <textarea class="form-control" name="${f.name}" rows="3">${f.value || ''}</textarea>
        </div>`;
      }
      return `<div class="form-group">
        <label>${f.label}${f.required ? ' *' : ''}</label>
        <input class="form-control" type="${f.type || 'text'}" name="${f.name}"
          value="${f.value ?? ''}" ${f.required ? 'required' : ''}
          ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''}
          ${f.placeholder ? `placeholder="${f.placeholder}"` : ''} />
      </div>`;
    }).join('');

    const { overlay, close, body } = this.openModal({
      title,
      body: `<form id="modal-form">${bodyHtml}</form>`,
      footer: `
        <button class="btn btn-ghost" type="button" id="form-cancel">Hủy</button>
        <button class="btn btn-primary" type="submit" form="modal-form">Lưu</button>
      `
    });

    document.getElementById('form-cancel').onclick = close;
    const form = document.getElementById('modal-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {};
      for (const [k, v] of fd.entries()) data[k] = v;
      try {
        await onSubmit(data, close);
      } catch (err) {
        UI.toast(err.message || 'Lỗi', 'error');
      }
    };
    return { close };
  },

  sourceOptionsHtml(accounts, includeDebt = false, debts = []) {
    let html = `<option value="cash">Tiền mặt</option>`;
    accounts.forEach(a => {
      html += `<option value="bank:${a.id}">${a.bankName} - ${a.accountNumber || 'TK'} (${Utils.formatMoney(a.balance)})</option>`;
    });
    if (includeDebt) {
      debts.forEach(d => {
        const remain = Math.max(0, (d.principal || 0) - (d.paidPrincipal || 0));
        html += `<option value="debt:${d.id}">Nợ: ${d.name} (còn ${Utils.formatMoney(remain)})</option>`;
      });
    }
    return html;
  },

  parseSource(value) {
    if (value === 'cash') return { sourceType: 'cash', sourceId: null };
    if (value.startsWith('bank:')) return { sourceType: 'bank', sourceId: Number(value.split(':')[1]) };
    if (value.startsWith('debt:')) return { sourceType: 'debt', sourceId: Number(value.split(':')[1]) };
    return { sourceType: 'cash', sourceId: null };
  }
};

window.UI = UI;
