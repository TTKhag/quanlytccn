/**
 * Dark Finance - IndexedDB Schema (Dexie)
 */
const db = new Dexie('DarkFinanceDB');

db.version(1).stores({
  // Core balances
  settings: 'key',                          // key-value settings (cashBalance, etc.)
  
  // Bank accounts
  bankAccounts: '++id, bankName, accountNumber, isActive',
  
  // Transactions (income, expense, transfer, interest, etc.)
  transactions: '++id, type, category, date, accountId, relatedId, createdAt',
  
  // Categories
  categories: '++id, type, name',
  
  // Debts (nợ phải trả)
  debts: '++id, type, name, bankName, status, createdAt',  // type: bank | cash
  
  // Debt payments / adjustments
  debtPayments: '++id, debtId, date, type',
  
  // Loans received (vay tiền)
  loansReceived: '++id, lenderName, status, startDate, dueDate',
  
  // Loans given (cho vay)
  loansGiven: '++id, borrowerName, status, startDate, dueDate',
  
  // Loan payments
  loanPayments: '++id, loanId, loanType, date, type', // loanType: received | given
  
  // Funds
  funds: '++id, name, status, startDate',
  
  // Fund movements
  fundMovements: '++id, fundId, date, type',
  
  // Projections
  projections: '++id, type, date, status',
  
  // Audit log
  auditLogs: '++id, module, action, entityId, timestamp'
});

// Seed default categories on first open
db.on('ready', async () => {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd([
      // Income
      { type: 'income', name: 'Lương' },
      { type: 'income', name: 'Thưởng' },
      { type: 'income', name: 'Được tặng' },
      { type: 'income', name: 'Thu nhập khác' },
      { type: 'income', name: 'Lãi cho vay' },
      { type: 'income', name: 'Lãi quỹ' },
      // Expense
      { type: 'expense', name: 'Ăn uống' },
      { type: 'expense', name: 'Sinh hoạt' },
      { type: 'expense', name: 'Xăng xe / Di chuyển' },
      { type: 'expense', name: 'Mua sắm' },
      { type: 'expense', name: 'Sửa chữa' },
      { type: 'expense', name: 'Y tế' },
      { type: 'expense', name: 'Giải trí' },
      { type: 'expense', name: 'Học tập' },
      { type: 'expense', name: 'Lãi vay' },
      { type: 'expense', name: 'Chi khác' },
    ]);
  }

  const cash = await db.settings.get('cashBalance');
  if (cash === undefined) {
    await db.settings.put({ key: 'cashBalance', value: 0 });
  }
});

window.db = db;
