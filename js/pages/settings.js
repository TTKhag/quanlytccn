/**
 * Settings & Backup
 */
const SettingsPage = {
  async render(container) {
    container.innerHTML = `
      <div class="section-header">
        <h2>Cài đặt</h2>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Sao lưu dữ liệu</h3>
          </div>
          <p class="text-secondary mb-2" style="font-size:0.9rem">
            Xuất toàn bộ dữ liệu ra file JSON để lưu trữ an toàn. Nên backup định kỳ.
          </p>
          <button class="btn btn-primary" id="btn-export">⇩ Xuất file Backup</button>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Khôi phục dữ liệu</h3>
          </div>
          <p class="text-secondary mb-2" style="font-size:0.9rem">
            Khôi phục từ file backup. <strong class="text-danger">Thao tác này sẽ ghi đè toàn bộ dữ liệu hiện tại.</strong>
          </p>
          <input type="file" id="import-file" accept=".json,application/json" class="form-control mb-1" />
          <button class="btn btn-danger" id="btn-import">Khôi phục từ file</button>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <h3 class="card-title">Thông tin ứng dụng</h3>
        </div>
        <div style="font-size:0.9rem;color:var(--text-secondary)">
          <p><strong>Dark Finance</strong> — Quản lý Tài chính Cá nhân</p>
          <p class="mt-1">Phiên bản 1.0.0 · Dữ liệu lưu trên trình duyệt (IndexedDB)</p>
          <p class="mt-1">Triển khai miễn phí trên GitHub Pages. Không cần máy chủ.</p>
          <p class="mt-1 text-muted">Nguyên tắc: Vay không phải thu nhập · Trả gốc không phải chi tiêu · Lãi chỉ ghi nhận khi thực nhận/trả.</p>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <h3 class="card-title">Xóa toàn bộ dữ liệu</h3>
        </div>
        <p class="text-secondary mb-2" style="font-size:0.9rem">
          Xóa sạch tất cả dữ liệu trên trình duyệt này. Không thể hoàn tác nếu chưa backup.
        </p>
        <button class="btn btn-danger" id="btn-reset">Xóa tất cả dữ liệu</button>
      </div>
    `;

    document.getElementById('btn-export').addEventListener('click', async () => {
      try {
        const data = await Services.exportBackup();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dark-finance-backup-${Utils.today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Đã xuất file backup', 'success');
      } catch (e) {
        UI.toast(e.message, 'error');
      }
    });

    document.getElementById('btn-import').addEventListener('click', async () => {
      const fileInput = document.getElementById('import-file');
      if (!fileInput.files?.length) {
        UI.toast('Vui lòng chọn file backup', 'error');
        return;
      }
      const ok = await UI.confirm(
        'Khôi phục sẽ XÓA toàn bộ dữ liệu hiện tại và thay bằng dữ liệu trong file. Bạn đã chắc chắn?',
        'Cảnh báo khôi phục'
      );
      if (!ok) return;

      try {
        const text = await fileInput.files[0].text();
        const data = JSON.parse(text);
        // Basic validation
        if (!data.version || !data.exportedAt) throw new Error('File không phải backup hợp lệ của Dark Finance');
        await Services.importBackup(data, { mode: 'replace' });
        UI.toast('Khôi phục thành công! Đang tải lại...', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch (e) {
        UI.toast(e.message || 'Lỗi khôi phục', 'error');
      }
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
      const ok = await UI.confirm(
        'Bạn sắp XÓA TOÀN BỘ dữ liệu. Hành động này không thể hoàn tác. Tiếp tục?',
        'Xóa dữ liệu'
      );
      if (!ok) return;
      const ok2 = await UI.confirm('Xác nhận lần cuối: Xóa hết?', 'Xác nhận');
      if (!ok2) return;
      await db.delete();
      UI.toast('Đã xóa. Đang tải lại...', 'info');
      setTimeout(() => location.reload(), 800);
    });
  }
};

window.SettingsPage = SettingsPage;
