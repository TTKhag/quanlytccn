/**
 * Business Services - All financial operations
 * Every mutation goes through here and writes audit log.
 */
const Services = {
  // ========== SETTINGS / CASH ==========
  async getCashBalance() {
    const row = await db.settings.get('cashBalance');
    return row ? Number(row.value) : 0;
  },

  async setCashBalance(amount, reason = 'Điều chỉnh số dư tiền mặt') {
    const old = await this.getCashBalance();
    await db.settings.put({ key: 'cashBalance', value: Number(amount) });
    await this._audit('settings', 'update', 'cashBalance', {
      content: reason,
      before: old,
      after: amount,
      amount: amount - old
    });
    return amount;
  },

  async adjustCash(delta, reason) {
    const current = await this.getCashBalance();
    const next = current + delta;
    if (next < -0.01) throw new Error('Số dư tiền mặt không đủ');
    await this.setCashBalance(next, reason);
    return next;
  },

  // ========== BANK ACCOUNTS ==========
  async getBankAccounts(activeOnly = true) {
    let list = await db.bankAccounts.toArray();
    if (activeOnly) list = list.filter(a => a.isActive !== false);
    return list;
  },

  async getBankAccount(id) {
    return db.bankAccounts.get(Number(id));
  },

  async createBankAccount(data) {
    const id = await db.bankAccounts.add({
      bankName: data.bankName,
      accountNumber: data.accountNumber || '',
      ownerName: data.ownerName || '',
      balance: Number(data.balance) || 0,
      isActive: true,
      note: data.note || '',
      createdAt: new Date().toISOString()
    });
    await this._audit('accounts', 'create', id, {
      content: `Tạo tài khoản ${data.bankName} - ${data.accountNumber}`,
      after: data.balance || 0
    });
    return id;
  },

  async updateBankAccount(id, data) {
    const old = await db.bankAccounts.get(Number(id));
    if (!old) throw new Error('Không tìm thấy tài khoản');
    await db.bankAccounts.update(Number(id), {
      bankName: data.bankName ?? old.bankName,
      accountNumber: data.accountNumber ?? old.accountNumber,
      ownerName: data.ownerName ?? old.ownerName,
      note: data.note ?? old.note
    });
    await this._audit('accounts', 'update', id, {
      content: `Cập nhật tài khoản ${old.bankName}`,
      before: old,
      after: data
    });
  },

  async deleteBankAccount(id) {
    const acc = await db.bankAccounts.get(Number(id));
    if (!acc) throw new Error('Không tìm thấy');
    if (acc.balance !== 0) throw new Error('Số dư tài khoản phải bằng 0 trước khi xóa');
    await db.bankAccounts.update(Number(id), { isActive: false });
    await this._audit('accounts', 'delete', id, {
      content: `Xóa (ẩn) tài khoản ${acc.bankName}`
    });
  },

  async adjustBankBalance(id, delta, reason) {
    const acc = await db.bankAccounts.get(Number(id));
    if (!acc) throw new Error('Không tìm thấy tài khoản');
    const next = (acc.balance || 0) + delta;
    if (next < -0.01) throw new Error('Số dư tài khoản không đủ');
    await db.bankAccounts.update(Number(id), { balance: next });
    await this._audit('accounts', 'adjust', id, {
      content: reason,
      before: acc.balance,
      after: next,
      amount: delta
    });
    return next;
  },

  async getTotalBankBalance() {
    const accounts = await this.getBankAccounts();
    return accounts.reduce((s, a) => s + (a.balance || 0), 0);
  },

  // ========== TRANSFERS ==========
  async transfer({ fromType, fromId, toType, toId, amount, note, date }) {
    amount = Number(amount);
    if (amount <= 0) throw new Error('Số tiền phải lớn hơn 0');
    date = date || Utils.today();

    // Validate source
    if (fromType === 'cash') {
      const cash = await this.getCashBalance();
      if (cash < amount) throw new Error('Tiền mặt không đủ');
    } else if (fromType === 'bank') {
      const acc = await this.getBankAccount(fromId);
      if (!acc || acc.balance < amount) throw new Error('Số dư tài khoản nguồn không đủ');
    }

    // Execute
    if (fromType === 'cash') {
      await this.adjustCash(-amount, `Chuyển tiền: ${note || 'Nội bộ'}`);
    } else {
      await this.adjustBankBalance(fromId, -amount, `Chuyển đi: ${note || ''}`);
    }

    if (toType === 'cash') {
      await this.adjustCash(amount, `Nhận chuyển: ${note || 'Nội bộ'}`);
    } else {
      await this.adjustBankBalance(toId, amount, `Nhận chuyển: ${note || ''}`);
    }

    const txId = await db.transactions.add({
      type: 'transfer',
      category: 'Chuyển nội bộ',
      amount,
      date,
      fromType, fromId: fromId || null,
      toType, toId: toId || null,
      note: note || '',
      createdAt: new Date().toISOString()
    });

    await this._audit('transactions', 'create', txId, {
      content: `Chuyển ${Utils.formatMoney(amount)} từ ${fromType} → ${toType}`,
      amount
    });
    return txId;
  },

  // ========== TRANSACTIONS (Income / Expense) ==========
  async addTransaction(data) {
    const amount = Number(data.amount);
    if (amount <= 0) throw new Error('Số tiền phải lớn hơn 0');
    const date = data.date || Utils.today();
    const type = data.type; // income | expense

    // Update balances
    if (type === 'income') {
      if (data.sourceType === 'cash') {
        await this.adjustCash(amount, `Thu: ${data.category}`);
      } else if (data.sourceType === 'bank') {
        await this.adjustBankBalance(data.sourceId, amount, `Thu: ${data.category}`);
      }
    } else if (type === 'expense') {
      if (data.sourceType === 'cash') {
        await this.adjustCash(-amount, `Chi: ${data.category}`);
      } else if (data.sourceType === 'bank') {
        await this.adjustBankBalance(data.sourceId, -amount, `Chi: ${data.category}`);
      } else if (data.sourceType === 'debt') {
        // Spending from debt increases debt principal
        await this._increaseDebtPrincipal(data.sourceId, amount, `Chi từ nợ: ${data.category}`);
      }
    }

    const id = await db.transactions.add({
      type,
      category: data.category,
      amount,
      date,
      sourceType: data.sourceType,
      sourceId: data.sourceId || null,
      note: data.note || '',
      isRecurring: !!data.isRecurring,
      createdAt: new Date().toISOString()
    });

    await this._audit('transactions', 'create', id, {
      content: `${type === 'income' ? 'Thu' : 'Chi'} ${data.category}: ${Utils.formatMoney(amount)}`,
      amount: type === 'income' ? amount : -amount
    });
    return id;
  },

  async updateTransaction(id, data) {
    const old = await db.transactions.get(Number(id));
    if (!old) throw new Error('Không tìm thấy giao dịch');
    if (old.type === 'transfer') throw new Error('Không hỗ trợ sửa chuyển khoản qua form này');

    // Reverse old effect
    await this._reverseTransactionEffect(old);

    // Apply new
    const amount = Number(data.amount);
    const type = data.type || old.type;
    if (type === 'income') {
      if (data.sourceType === 'cash') await this.adjustCash(amount, `Sửa thu`);
      else if (data.sourceType === 'bank') await this.adjustBankBalance(data.sourceId, amount, `Sửa thu`);
    } else {
      if (data.sourceType === 'cash') await this.adjustCash(-amount, `Sửa chi`);
      else if (data.sourceType === 'bank') await this.adjustBankBalance(data.sourceId, -amount, `Sửa chi`);
      else if (data.sourceType === 'debt') await this._increaseDebtPrincipal(data.sourceId, amount, `Sửa chi từ nợ`);
    }

    await db.transactions.update(Number(id), {
      type,
      category: data.category,
      amount,
      date: data.date,
      sourceType: data.sourceType,
      sourceId: data.sourceId || null,
      note: data.note || '',
      updatedAt: new Date().toISOString()
    });

    await this._audit('transactions', 'update', id, {
      content: `Sửa giao dịch #${id}`,
      before: old,
      after: data
    });
  },

  async deleteTransaction(id) {
    const old = await db.transactions.get(Number(id));
    if (!old) throw new Error('Không tìm thấy');
    await this._reverseTransactionEffect(old);
    await db.transactions.delete(Number(id));
    await this._audit('transactions', 'delete', id, {
      content: `Xóa giao dịch ${old.type} ${old.category}`,
      amount: old.type === 'income' ? -old.amount : old.amount
    });
  },

  async _reverseTransactionEffect(tx) {
    if (tx.type === 'income') {
      if (tx.sourceType === 'cash') await this.adjustCash(-tx.amount, 'Hoàn tác thu');
      else if (tx.sourceType === 'bank') await this.adjustBankBalance(tx.sourceId, -tx.amount, 'Hoàn tác thu');
    } else if (tx.type === 'expense') {
      if (tx.sourceType === 'cash') await this.adjustCash(tx.amount, 'Hoàn tác chi');
      else if (tx.sourceType === 'bank') await this.adjustBankBalance(tx.sourceId, tx.amount, 'Hoàn tác chi');
      else if (tx.sourceType === 'debt') await this._decreaseDebtPrincipal(tx.sourceId, tx.amount, 'Hoàn tác chi từ nợ');
    } else if (tx.type === 'transfer') {
      // Reverse transfer
      if (tx.fromType === 'cash') await this.adjustCash(tx.amount, 'Hoàn tác chuyển');
      else await this.adjustBankBalance(tx.fromId, tx.amount, 'Hoàn tác chuyển');
      if (tx.toType === 'cash') await this.adjustCash(-tx.amount, 'Hoàn tác nhận');
      else await this.adjustBankBalance(tx.toId, -tx.amount, 'Hoàn tác nhận');
    }
  },

  async getTransactions(filters = {}) {
    let list = await db.transactions.orderBy('date').reverse().toArray();
    if (filters.type) list = list.filter(t => t.type === filters.type);
    if (filters.from) list = list.filter(t => t.date >= filters.from);
    if (filters.to) list = list.filter(t => t.date <= filters.to);
    if (filters.category) list = list.filter(t => t.category === filters.category);
    return list;
  },

  // ========== DEBTS ==========
  async getDebts(status = 'active') {
    let list = await db.debts.toArray();
    if (status) list = list.filter(d => d.status === status);
    return list;
  },

  async createDebt(data) {
    const principal = Number(data.principal) || 0;
    const id = await db.debts.add({
      type: data.type, // bank | cash
      name: data.name, // creditor name or description
      bankName: data.bankName || '',
      accountNumber: data.accountNumber || '',
      phone: data.phone || '',
      idNumber: data.idNumber || '',
      address: data.address || '',
      principal,
      paidPrincipal: 0,
      accruedInterest: 0,
      paidInterest: 0,
      interestRate: Number(data.interestRate) || 0,
      interestMethod: data.interestMethod || 'simple_daily',
      startDate: data.startDate || Utils.today(),
      dueDate: data.dueDate || null,
      note: data.note || '',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // If debt comes with cash received, increase cash/bank
    if (data.receiveTo && principal > 0) {
      if (data.receiveTo === 'cash') {
        await this.adjustCash(principal, `Nhận nợ: ${data.name}`);
      } else if (data.receiveTo === 'bank' && data.receiveAccountId) {
        await this.adjustBankBalance(data.receiveAccountId, principal, `Nhận nợ: ${data.name}`);
      }
    }

    await this._audit('debts', 'create', id, {
      content: `Tạo nợ ${data.type}: ${data.name} - ${Utils.formatMoney(principal)}`,
      amount: principal
    });
    return id;
  },

  async _increaseDebtPrincipal(debtId, amount, reason) {
    const d = await db.debts.get(Number(debtId));
    if (!d) throw new Error('Không tìm thấy khoản nợ');
    await db.debts.update(Number(debtId), {
      principal: (d.principal || 0) + amount
    });
    await this._audit('debts', 'adjust', debtId, { content: reason, amount });
  },

  async _decreaseDebtPrincipal(debtId, amount, reason) {
    const d = await db.debts.get(Number(debtId));
    if (!d) throw new Error('Không tìm thấy khoản nợ');
    const next = Math.max(0, (d.principal || 0) - amount);
    await db.debts.update(Number(debtId), { principal: next });
    await this._audit('debts', 'adjust', debtId, { content: reason, amount: -amount });
  },

  async payDebt(debtId, { amount, payPrincipal, payInterest, sourceType, sourceId, note, date }) {
    const d = await db.debts.get(Number(debtId));
    if (!d || d.status !== 'active') throw new Error('Khoản nợ không hợp lệ');
    amount = Number(amount);
    payPrincipal = Number(payPrincipal) || 0;
    payInterest = Number(payInterest) || 0;
    if (payPrincipal + payInterest !== amount) {
      // Auto split if not specified
      if (!payPrincipal && !payInterest) {
        const remainingInterest = Math.max(0, (d.accruedInterest || 0) - (d.paidInterest || 0));
        payInterest = Math.min(amount, remainingInterest);
        payPrincipal = amount - payInterest;
      }
    }

    // Check source balance
    if (sourceType === 'cash') {
      const cash = await this.getCashBalance();
      if (cash < amount) throw new Error('Tiền mặt không đủ');
      await this.adjustCash(-amount, `Trả nợ: ${d.name}`);
    } else if (sourceType === 'bank') {
      await this.adjustBankBalance(sourceId, -amount, `Trả nợ: ${d.name}`);
    }

    // Update debt
    const newPaidPrincipal = (d.paidPrincipal || 0) + payPrincipal;
    const newPaidInterest = (d.paidInterest || 0) + payInterest;
    const remainingPrincipal = Math.max(0, (d.principal || 0) - newPaidPrincipal);
    const updates = {
      paidPrincipal: newPaidPrincipal,
      paidInterest: newPaidInterest
    };
    if (remainingPrincipal <= 0 && (d.accruedInterest || 0) - newPaidInterest <= 0) {
      updates.status = 'closed';
    }
    await db.debts.update(Number(debtId), updates);

    // Record payment
    await db.debtPayments.add({
      debtId: Number(debtId),
      date: date || Utils.today(),
      amount,
      payPrincipal,
      payInterest,
      sourceType,
      sourceId: sourceId || null,
      note: note || '',
      createdAt: new Date().toISOString()
    });

    // Interest paid is expense
    if (payInterest > 0) {
      await db.transactions.add({
        type: 'expense',
        category: 'Lãi vay',
        amount: payInterest,
        date: date || Utils.today(),
        sourceType,
        sourceId: sourceId || null,
        relatedId: debtId,
        note: `Lãi trả cho ${d.name}`,
        createdAt: new Date().toISOString()
      });
    }

    await this._audit('debts', 'pay', debtId, {
      content: `Trả nợ ${d.name}: gốc ${Utils.formatMoney(payPrincipal)}, lãi ${Utils.formatMoney(payInterest)}`,
      amount: -amount
    });
  },

  async updateDebtAccruedInterest(debtId) {
    const d = await db.debts.get(Number(debtId));
    if (!d || d.status !== 'active') return;
    const remainingPrincipal = Math.max(0, (d.principal || 0) - (d.paidPrincipal || 0));
    const accrued = Interest.calculateAccrued(
      remainingPrincipal,
      d.interestRate,
      d.interestMethod,
      d.startDate,
      Utils.today()
    );
    await db.debts.update(Number(debtId), { accruedInterest: accrued });
  },

  async refreshAllDebtInterest() {
    const debts = await this.getDebts('active');
    for (const d of debts) {
      await this.updateDebtAccruedInterest(d.id);
    }
  },

  // ========== LOANS RECEIVED (Vay) ==========
  async getLoansReceived(status = null) {
    let list = await db.loansReceived.toArray();
    if (status) list = list.filter(l => l.status === status);
    return list;
  },

  async createLoanReceived(data) {
    const amount = Number(data.amount);
    const id = await db.loansReceived.add({
      lenderName: data.lenderName,
      amount,
      paidPrincipal: 0,
      accruedInterest: 0,
      paidInterest: 0,
      interestRate: Number(data.interestRate) || 0,
      interestMethod: data.interestMethod || 'simple_daily',
      startDate: data.startDate || Utils.today(),
      dueDate: data.dueDate || null,
      note: data.note || '',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // Money received increases cash/bank, increases liability (already tracked as loan)
    if (data.receiveTo === 'cash') {
      await this.adjustCash(amount, `Nhận vay từ ${data.lenderName}`);
    } else if (data.receiveTo === 'bank' && data.receiveAccountId) {
      await this.adjustBankBalance(data.receiveAccountId, amount, `Nhận vay từ ${data.lenderName}`);
    }

    await this._audit('loans', 'create', id, {
      content: `Vay từ ${data.lenderName}: ${Utils.formatMoney(amount)}`,
      amount
    });
    return id;
  },

  async payLoanReceived(loanId, { amount, payPrincipal, payInterest, sourceType, sourceId, note, date }) {
    const loan = await db.loansReceived.get(Number(loanId));
    if (!loan || loan.status !== 'active') throw new Error('Khoản vay không hợp lệ');
    amount = Number(amount);
    payPrincipal = Number(payPrincipal) || 0;
    payInterest = Number(payInterest) || 0;

    if (!payPrincipal && !payInterest) {
      const remainingInterest = Math.max(0, (loan.accruedInterest || 0) - (loan.paidInterest || 0));
      payInterest = Math.min(amount, remainingInterest);
      payPrincipal = amount - payInterest;
    }

    if (sourceType === 'cash') {
      await this.adjustCash(-amount, `Trả vay: ${loan.lenderName}`);
    } else {
      await this.adjustBankBalance(sourceId, -amount, `Trả vay: ${loan.lenderName}`);
    }

    const newPaidP = (loan.paidPrincipal || 0) + payPrincipal;
    const newPaidI = (loan.paidInterest || 0) + payInterest;
    const updates = { paidPrincipal: newPaidP, paidInterest: newPaidI };
    if (newPaidP >= loan.amount && newPaidI >= (loan.accruedInterest || 0)) {
      updates.status = 'closed';
    }
    await db.loansReceived.update(Number(loanId), updates);

    await db.loanPayments.add({
      loanId: Number(loanId),
      loanType: 'received',
      date: date || Utils.today(),
      amount, payPrincipal, payInterest,
      sourceType, sourceId: sourceId || null,
      note: note || '',
      createdAt: new Date().toISOString()
    });

    if (payInterest > 0) {
      await db.transactions.add({
        type: 'expense',
        category: 'Lãi vay',
        amount: payInterest,
        date: date || Utils.today(),
        sourceType, sourceId: sourceId || null,
        relatedId: loanId,
        note: `Lãi trả ${loan.lenderName}`,
        createdAt: new Date().toISOString()
      });
    }

    await this._audit('loans', 'pay', loanId, {
      content: `Trả vay ${loan.lenderName}: gốc ${Utils.formatMoney(payPrincipal)}, lãi ${Utils.formatMoney(payInterest)}`,
      amount: -amount
    });
  },

  // ========== LOANS GIVEN (Cho vay) ==========
  async getLoansGiven(status = null) {
    let list = await db.loansGiven.toArray();
    if (status) list = list.filter(l => l.status === status);
    return list;
  },

  async createLoanGiven(data) {
    const amount = Number(data.amount);
    // Deduct from source
    if (data.sourceType === 'cash') {
      await this.adjustCash(-amount, `Cho vay: ${data.borrowerName}`);
    } else if (data.sourceType === 'bank') {
      await this.adjustBankBalance(data.sourceId, -amount, `Cho vay: ${data.borrowerName}`);
    }

    const id = await db.loansGiven.add({
      borrowerName: data.borrowerName,
      amount,
      recoveredPrincipal: 0,
      accruedInterest: 0,
      receivedInterest: 0,
      interestRate: Number(data.interestRate) || 0,
      interestMethod: data.interestMethod || 'simple_daily',
      startDate: data.startDate || Utils.today(),
      dueDate: data.dueDate || null,
      note: data.note || '',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    await this._audit('loans', 'create', id, {
      content: `Cho vay ${data.borrowerName}: ${Utils.formatMoney(amount)}`,
      amount: -amount
    });
    return id;
  },

  async recoverLoanGiven(loanId, { amount, recoverPrincipal, receiveInterest, targetType, targetId, note, date }) {
    const loan = await db.loansGiven.get(Number(loanId));
    if (!loan || loan.status !== 'active') throw new Error('Khoản cho vay không hợp lệ');
    amount = Number(amount);
    recoverPrincipal = Number(recoverPrincipal) || 0;
    receiveInterest = Number(receiveInterest) || 0;

    if (!recoverPrincipal && !receiveInterest) {
      const remainingInterest = Math.max(0, (loan.accruedInterest || 0) - (loan.receivedInterest || 0));
      receiveInterest = Math.min(amount, remainingInterest);
      recoverPrincipal = amount - receiveInterest;
    }

    // Add money back
    if (targetType === 'cash') {
      await this.adjustCash(amount, `Thu hồi cho vay: ${loan.borrowerName}`);
    } else {
      await this.adjustBankBalance(targetId, amount, `Thu hồi cho vay: ${loan.borrowerName}`);
    }

    const newRecP = (loan.recoveredPrincipal || 0) + recoverPrincipal;
    const newRecI = (loan.receivedInterest || 0) + receiveInterest;
    const updates = { recoveredPrincipal: newRecP, receivedInterest: newRecI };
    if (newRecP >= loan.amount) updates.status = 'closed';
    await db.loansGiven.update(Number(loanId), updates);

    await db.loanPayments.add({
      loanId: Number(loanId),
      loanType: 'given',
      date: date || Utils.today(),
      amount, payPrincipal: recoverPrincipal, payInterest: receiveInterest,
      sourceType: targetType, sourceId: targetId || null,
      note: note || '',
      createdAt: new Date().toISOString()
    });

    // Interest received is income
    if (receiveInterest > 0) {
      await db.transactions.add({
        type: 'income',
        category: 'Lãi cho vay',
        amount: receiveInterest,
        date: date || Utils.today(),
        sourceType: targetType,
        sourceId: targetId || null,
        relatedId: loanId,
        note: `Lãi từ ${loan.borrowerName}`,
        createdAt: new Date().toISOString()
      });
    }

    await this._audit('loans', 'recover', loanId, {
      content: `Thu hồi cho vay ${loan.borrowerName}: gốc ${Utils.formatMoney(recoverPrincipal)}, lãi ${Utils.formatMoney(receiveInterest)}`,
      amount
    });
  },

  async refreshLoanInterest() {
    const received = await this.getLoansReceived('active');
    for (const l of received) {
      const remaining = Math.max(0, l.amount - (l.paidPrincipal || 0));
      const accrued = Interest.calculateAccrued(remaining, l.interestRate, l.interestMethod, l.startDate, Utils.today());
      await db.loansReceived.update(l.id, { accruedInterest: accrued });
    }
    const given = await this.getLoansGiven('active');
    for (const l of given) {
      const remaining = Math.max(0, l.amount - (l.recoveredPrincipal || 0));
      const accrued = Interest.calculateAccrued(remaining, l.interestRate, l.interestMethod, l.startDate, Utils.today());
      await db.loansGiven.update(l.id, { accruedInterest: accrued });
    }
  },

  // ========== FUNDS ==========
  async getFunds(status = 'active') {
    let list = await db.funds.toArray();
    if (status) list = list.filter(f => f.status === status);
    return list;
  },

  async createFund(data) {
    const initial = Number(data.initialAmount) || 0;
    if (initial > 0) {
      if (data.sourceType === 'cash') {
        await this.adjustCash(-initial, `Nạp quỹ: ${data.name}`);
      } else if (data.sourceType === 'bank') {
        await this.adjustBankBalance(data.sourceId, -initial, `Nạp quỹ: ${data.name}`);
      }
    }

    const id = await db.funds.add({
      name: data.name,
      purpose: data.purpose || '',
      principal: initial,
      accruedInterest: 0,
      receivedInterest: 0,
      interestRate: Number(data.interestRate) || 0,
      interestMethod: data.interestMethod || 'simple_daily',
      startDate: data.startDate || Utils.today(),
      note: data.note || '',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    if (initial > 0) {
      await db.fundMovements.add({
        fundId: id,
        type: 'deposit',
        amount: initial,
        date: data.startDate || Utils.today(),
        note: 'Nạp ban đầu',
        createdAt: new Date().toISOString()
      });
    }

    await this._audit('funds', 'create', id, {
      content: `Tạo quỹ ${data.name}: ${Utils.formatMoney(initial)}`,
      amount: -initial
    });
    return id;
  },

  async depositToFund(fundId, { amount, sourceType, sourceId, note, date }) {
    amount = Number(amount);
    if (sourceType === 'cash') await this.adjustCash(-amount, `Nạp quỹ`);
    else await this.adjustBankBalance(sourceId, -amount, `Nạp quỹ`);

    const f = await db.funds.get(Number(fundId));
    await db.funds.update(Number(fundId), { principal: (f.principal || 0) + amount });
    await db.fundMovements.add({
      fundId: Number(fundId), type: 'deposit', amount,
      date: date || Utils.today(), note: note || '',
      createdAt: new Date().toISOString()
    });
    await this._audit('funds', 'deposit', fundId, { content: `Nạp quỹ ${f.name}`, amount: -amount });
  },

  async withdrawFromFund(fundId, { amount, targetType, targetId, note, date }) {
    amount = Number(amount);
    const f = await db.funds.get(Number(fundId));
    if ((f.principal || 0) < amount) throw new Error('Số dư quỹ không đủ');

    await db.funds.update(Number(fundId), { principal: f.principal - amount });
    if (targetType === 'cash') await this.adjustCash(amount, `Rút quỹ`);
    else await this.adjustBankBalance(targetId, amount, `Rút quỹ`);

    await db.fundMovements.add({
      fundId: Number(fundId), type: 'withdraw', amount,
      date: date || Utils.today(), note: note || '',
      createdAt: new Date().toISOString()
    });
    await this._audit('funds', 'withdraw', fundId, { content: `Rút quỹ ${f.name}`, amount });
  },

  async receiveFundInterest(fundId, { amount, method, targetType, targetId, note, date }) {
    // method: add_to_fund | to_cash | to_bank
    amount = Number(amount);
    const f = await db.funds.get(Number(fundId));
    if (method === 'add_to_fund') {
      await db.funds.update(Number(fundId), {
        principal: (f.principal || 0) + amount,
        receivedInterest: (f.receivedInterest || 0) + amount
      });
    } else {
      await db.funds.update(Number(fundId), {
        receivedInterest: (f.receivedInterest || 0) + amount
      });
      if (method === 'to_cash' || targetType === 'cash') {
        await this.adjustCash(amount, `Lãi quỹ ${f.name}`);
      } else {
        await this.adjustBankBalance(targetId, amount, `Lãi quỹ ${f.name}`);
      }
    }

    // Record as income once
    await db.transactions.add({
      type: 'income',
      category: 'Lãi quỹ',
      amount,
      date: date || Utils.today(),
      relatedId: fundId,
      note: note || `Lãi quỹ ${f.name}`,
      createdAt: new Date().toISOString()
    });

    await db.fundMovements.add({
      fundId: Number(fundId), type: 'interest', amount,
      date: date || Utils.today(), note: note || '',
      createdAt: new Date().toISOString()
    });

    await this._audit('funds', 'interest', fundId, {
      content: `Nhận lãi quỹ ${f.name}: ${Utils.formatMoney(amount)}`,
      amount
    });
  },

  async refreshFundInterest() {
    const funds = await this.getFunds('active');
    for (const f of funds) {
      const accrued = Interest.calculateAccrued(
        f.principal, f.interestRate, f.interestMethod, f.startDate, Utils.today()
      );
      // Accrued is total calculated; received is already taken
      await db.funds.update(f.id, { accruedInterest: accrued });
    }
  },

  // ========== PROJECTIONS ==========
  async getProjections(filters = {}) {
    let list = await db.projections.orderBy('date').toArray();
    if (filters.type) list = list.filter(p => p.type === filters.type);
    if (filters.from) list = list.filter(p => p.date >= filters.from);
    if (filters.to) list = list.filter(p => p.date <= filters.to);
    if (filters.status) list = list.filter(p => p.status === filters.status);
    return list;
  },

  async addProjection(data) {
    const id = await db.projections.add({
      type: data.type, // income | expense | debt_payment
      category: data.category || '',
      amount: Number(data.amount),
      date: data.date,
      note: data.note || '',
      status: 'planned',
      createdAt: new Date().toISOString()
    });
    await this._audit('projections', 'create', id, {
      content: `Dự kiến ${data.type}: ${Utils.formatMoney(data.amount)} ngày ${data.date}`
    });
    return id;
  },

  async confirmProjection(id) {
    const p = await db.projections.get(Number(id));
    if (!p || p.status !== 'planned') throw new Error('Không hợp lệ');
    // User must still create the real transaction; we just mark as confirmed
    await db.projections.update(Number(id), { status: 'confirmed' });
    await this._audit('projections', 'confirm', id, { content: `Xác nhận dự kiến #${id}` });
  },

  async deleteProjection(id) {
    await db.projections.delete(Number(id));
    await this._audit('projections', 'delete', id, { content: `Xóa dự kiến #${id}` });
  },

  // ========== DASHBOARD AGGREGATES ==========
  async getDashboardSummary() {
    await this.refreshAllDebtInterest();
    await this.refreshLoanInterest();
    await this.refreshFundInterest();

    const cash = await this.getCashBalance();
    const bankTotal = await this.getTotalBankBalance();
    const accounts = await this.getBankAccounts();

    const debts = await this.getDebts('active');
    let totalDebtPrincipal = 0;
    let totalDebtInterest = 0;
    for (const d of debts) {
      const remainP = Math.max(0, (d.principal || 0) - (d.paidPrincipal || 0));
      const remainI = Math.max(0, (d.accruedInterest || 0) - (d.paidInterest || 0));
      totalDebtPrincipal += remainP;
      totalDebtInterest += remainI;
    }

    const loansRecv = await this.getLoansReceived('active');
    let totalLoanRecvP = 0, totalLoanRecvI = 0;
    for (const l of loansRecv) {
      totalLoanRecvP += Math.max(0, l.amount - (l.paidPrincipal || 0));
      totalLoanRecvI += Math.max(0, (l.accruedInterest || 0) - (l.paidInterest || 0));
    }

    const loansGiven = await this.getLoansGiven('active');
    let totalLoanGivenP = 0, totalLoanGivenI = 0;
    for (const l of loansGiven) {
      totalLoanGivenP += Math.max(0, l.amount - (l.recoveredPrincipal || 0));
      totalLoanGivenI += Math.max(0, (l.accruedInterest || 0) - (l.receivedInterest || 0));
    }

    const funds = await this.getFunds('active');
    let totalFundPrincipal = 0, totalFundAccrued = 0;
    for (const f of funds) {
      totalFundPrincipal += f.principal || 0;
      totalFundAccrued += Math.max(0, (f.accruedInterest || 0) - (f.receivedInterest || 0));
    }

    // Assets = cash + bank + receivables (loan given principal) + fund principal
    // Note: accrued interest not yet received is NOT added to assets
    const totalAssets = cash + bankTotal + totalLoanGivenP + totalFundPrincipal;
    const totalLiabilities = totalDebtPrincipal + totalDebtInterest + totalLoanRecvP + totalLoanRecvI;
    const netWorth = totalAssets - totalLiabilities;

    return {
      cash,
      bankTotal,
      accounts,
      totalAssets,
      totalLiabilities,
      netWorth,
      totalDebtPrincipal,
      totalDebtInterest,
      totalLoanRecvP,
      totalLoanRecvI,
      totalLoanGivenP,
      totalLoanGivenI,
      totalFundPrincipal,
      totalFundAccrued,
      debts,
      loansRecv,
      loansGiven,
      funds
    };
  },

  async getIncomeExpenseSummary(from, to) {
    const txs = await this.getTransactions({ from, to });
    let income = 0, expense = 0;
    const byCategory = {};
    for (const t of txs) {
      if (t.type === 'income') {
        income += t.amount;
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
      } else if (t.type === 'expense') {
        expense += t.amount;
        byCategory[t.category] = (byCategory[t.category] || 0) - t.amount;
      }
    }
    return { income, expense, net: income - expense, byCategory, transactions: txs };
  },

  // ========== AUDIT ==========
  async _audit(module, action, entityId, details = {}) {
    await db.auditLogs.add({
      module,
      action,
      entityId: entityId != null ? String(entityId) : null,
      content: details.content || '',
      before: details.before != null ? JSON.stringify(details.before) : null,
      after: details.after != null ? JSON.stringify(details.after) : null,
      amount: details.amount != null ? details.amount : null,
      timestamp: new Date().toISOString()
    });
  },

  async getAuditLogs(filters = {}) {
    let list = await db.auditLogs.orderBy('timestamp').reverse().toArray();
    if (filters.module) list = list.filter(l => l.module === filters.module);
    if (filters.from) list = list.filter(l => l.timestamp >= filters.from);
    if (filters.to) list = list.filter(l => l.timestamp <= filters.to + 'T23:59:59');
    return list;
  },

  // ========== BACKUP / RESTORE ==========
  async exportBackup() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: await db.settings.toArray(),
      bankAccounts: await db.bankAccounts.toArray(),
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      debts: await db.debts.toArray(),
      debtPayments: await db.debtPayments.toArray(),
      loansReceived: await db.loansReceived.toArray(),
      loansGiven: await db.loansGiven.toArray(),
      loanPayments: await db.loanPayments.toArray(),
      funds: await db.funds.toArray(),
      fundMovements: await db.fundMovements.toArray(),
      projections: await db.projections.toArray(),
      auditLogs: await db.auditLogs.toArray()
    };
    return data;
  },

  async importBackup(data, { mode = 'replace' } = {}) {
    if (!data || !data.version) throw new Error('File backup không hợp lệ');
    if (data.version !== 1) throw new Error('Phiên bản backup không hỗ trợ');

    if (mode === 'replace') {
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
        if (data.settings) await db.settings.bulkPut(data.settings);
        if (data.bankAccounts) await db.bankAccounts.bulkPut(data.bankAccounts);
        if (data.transactions) await db.transactions.bulkPut(data.transactions);
        if (data.categories) await db.categories.bulkPut(data.categories);
        if (data.debts) await db.debts.bulkPut(data.debts);
        if (data.debtPayments) await db.debtPayments.bulkPut(data.debtPayments);
        if (data.loansReceived) await db.loansReceived.bulkPut(data.loansReceived);
        if (data.loansGiven) await db.loansGiven.bulkPut(data.loansGiven);
        if (data.loanPayments) await db.loanPayments.bulkPut(data.loanPayments);
        if (data.funds) await db.funds.bulkPut(data.funds);
        if (data.fundMovements) await db.fundMovements.bulkPut(data.fundMovements);
        if (data.projections) await db.projections.bulkPut(data.projections);
        if (data.auditLogs) await db.auditLogs.bulkPut(data.auditLogs);
      });
    }
    await this._audit('settings', 'restore', null, {
      content: `Khôi phục backup từ ${data.exportedAt}`
    });
  },

  async getCategories(type) {
    let list = await db.categories.toArray();
    if (type) list = list.filter(c => c.type === type);
    return list;
  }
};

window.Services = Services;
