// IndexedDB Database Layer for Debt Collector PWA
const DB_NAME = 'DebtCollectorDB';
const DB_VERSION = 1;

class DebtDB {
  constructor() {
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('debtors')) {
          const debtors = db.createObjectStore('debtors', { keyPath: 'id', autoIncrement: true });
          debtors.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('debts')) {
          const debts = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
          debts.createIndex('debtor_id', 'debtor_id', { unique: false });
          debts.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('payments')) {
          const payments = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
          payments.createIndex('debt_id', 'debt_id', { unique: false });
          payments.createIndex('instalment_id', 'instalment_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('instalments')) {
          const instalments = db.createObjectStore('instalments', { keyPath: 'id', autoIncrement: true });
          instalments.createIndex('debt_id', 'debt_id', { unique: false });
          instalments.createIndex('status', 'status', { unique: false });
        }
      };
      req.onsuccess = e => { this.db = e.target.result; resolve(this.db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  _tx(store, mode = 'readonly') {
    const tx = this.db.transaction(store, mode);
    return tx.objectStore(store);
  }

  _req(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Debtors ---
  addDebtor(debtor) {
    debtor.created_at = new Date().toISOString();
    return this._req(this._tx('debtors', 'readwrite').add(debtor));
  }

  updateDebtor(debtor) {
    return this._req(this._tx('debtors', 'readwrite').put(debtor));
  }

  deleteDebtor(id) {
    return new Promise(async (resolve) => {
      // Delete related debts, payments, instalments
      const debts = await this.getDebtsByDebtor(id);
      for (const debt of debts) {
        await this.deleteDebt(debt.id);
      }
      await this._req(this._tx('debtors', 'readwrite').delete(id));
      resolve();
    });
  }

  getDebtor(id) {
    return this._req(this._tx('debtors').get(id));
  }

  getAllDebtors() {
    return this._req(this._tx('debtors').getAll());
  }

  // --- Debts ---
  addDebt(debt) {
    debt.created_at = new Date().toISOString();
    if (!debt.status) debt.status = 'Unpaid';
    return this._req(this._tx('debts', 'readwrite').add(debt));
  }

  updateDebt(debt) {
    return this._req(this._tx('debts', 'readwrite').put(debt));
  }

  async deleteDebt(id) {
    const payments = await this.getPaymentsByDebt(id);
    for (const p of payments) {
      await this._req(this._tx('payments', 'readwrite').delete(p.id));
    }
    const instalments = await this.getInstalmentsByDebt(id);
    for (const i of instalments) {
      await this._req(this._tx('instalments', 'readwrite').delete(i.id));
    }
    return this._req(this._tx('debts', 'readwrite').delete(id));
  }

  getDebt(id) {
    return this._req(this._tx('debts').get(id));
  }

  getAllDebts() {
    return this._req(this._tx('debts').getAll());
  }

  getDebtsByDebtor(debtorId) {
    return this._req(this._tx('debts').index('debtor_id').getAll(debtorId));
  }

  // --- Payments ---
  addPayment(payment) {
    payment.paid_at = new Date().toISOString();
    return this._req(this._tx('payments', 'readwrite').add(payment));
  }

  deletePayment(id) {
    return this._req(this._tx('payments', 'readwrite').delete(id));
  }

  getPaymentsByDebt(debtId) {
    return this._req(this._tx('payments').index('debt_id').getAll(debtId));
  }

  getAllPayments() {
    return this._req(this._tx('payments').getAll());
  }

  // --- Instalments ---
  addInstalment(inst) {
    return this._req(this._tx('instalments', 'readwrite').add(inst));
  }

  updateInstalment(inst) {
    return this._req(this._tx('instalments', 'readwrite').put(inst));
  }

  deleteInstalment(id) {
    return this._req(this._tx('instalments', 'readwrite').delete(id));
  }

  getInstalmentsByDebt(debtId) {
    return this._req(this._tx('instalments').index('debt_id').getAll(debtId));
  }

  getAllInstalments() {
    return this._req(this._tx('instalments').getAll());
  }

  // --- Stats ---
  async getStats() {
    const debtors = await this.getAllDebtors();
    const debts = await this.getAllDebts();
    const payments = await this.getAllPayments();

    const totalLent = debts.reduce((s, d) => s + d.amount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = totalLent - totalPaid;
    const unpaidDebts = debts.filter(d => d.status === 'Unpaid').length;
    const paidDebts = debts.filter(d => d.status === 'Paid').length;
    const overdueDebts = debts.filter(d => d.status === 'Unpaid' && d.due_date && new Date(d.due_date) < new Date()).length;

    return {
      totalDebtors: debtors.length,
      totalDebts: debts.length,
      totalLent,
      totalPaid,
      outstanding,
      unpaidDebts,
      paidDebts,
      overdueDebts
    };
  }
}

const db = new DebtDB();
