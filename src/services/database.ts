import { 
  User, Item, Shift, Supply, Payment, DailySummary, MonthlySummary, 
  SupplementDebt, Category, Customer, CustomerPurchase, Expense, ShiftEdit 
} from '../types';

class DatabaseService {
  private dbName = 'StoreInventoryDB';
  private version = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Users store
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('section', 'section');
        }

        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('section', 'section');
          itemStore.createIndex('categoryId', 'categoryId');
        }

        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
          customerStore.createIndex('section', 'section');
        }

        // Customer purchases store
        if (!db.objectStoreNames.contains('customerPurchases')) {
          const customerPurchaseStore = db.createObjectStore('customerPurchases', { keyPath: 'id' });
          customerPurchaseStore.createIndex('customerId', 'customerId');
          customerPurchaseStore.createIndex('section', 'section');
          customerPurchaseStore.createIndex('isPaid', 'isPaid');
        }

        // Expenses store
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expenseStore.createIndex('shiftId', 'shiftId');
          expenseStore.createIndex('section', 'section');
        }

        // Shift edits store
        if (!db.objectStoreNames.contains('shiftEdits')) {
          const shiftEditStore = db.createObjectStore('shiftEdits', { keyPath: 'id' });
          shiftEditStore.createIndex('shiftId', 'shiftId');
        }

        // Shifts store
        if (!db.objectStoreNames.contains('shifts')) {
          const shiftStore = db.createObjectStore('shifts', { keyPath: 'id' });
          shiftStore.createIndex('status', 'status');
          shiftStore.createIndex('section', 'section');
          shiftStore.createIndex('startTime', 'startTime');
        }

        // Supplies store
        if (!db.objectStoreNames.contains('supplies')) {
          const supplyStore = db.createObjectStore('supplies', { keyPath: 'id' });
          supplyStore.createIndex('section', 'section');
        }

        // Payments store
        if (!db.objectStoreNames.contains('payments')) {
          db.createObjectStore('payments', { keyPath: 'id' });
        }

        // Daily summaries store
        if (!db.objectStoreNames.contains('dailySummaries')) {
          const dailyStore = db.createObjectStore('dailySummaries', { keyPath: 'date' });
          dailyStore.createIndex('section', 'section');
        }

        // Monthly summaries store
        if (!db.objectStoreNames.contains('monthlySummaries')) {
          const monthlyStore = db.createObjectStore('monthlySummaries', { keyPath: 'month' });
          monthlyStore.createIndex('section', 'section');
        }

        // Supplement debt store
        if (!db.objectStoreNames.contains('supplementDebt')) {
          db.createObjectStore('supplementDebt', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // User operations
  async createUser(user: User): Promise<void> {
    const store = await this.getStore('users', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(user);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const store = await this.getStore('users');
    const index = store.index('username');
    return new Promise((resolve, reject) => {
      const request = index.get(username);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Category operations
  async saveCategory(category: Category): Promise<void> {
    const store = await this.getStore('categories', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(category);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCategoriesBySection(section: 'store' | 'supplement'): Promise<Category[]> {
    const store = await this.getStore('categories');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const store = await this.getStore('categories', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Item operations
  async saveItem(item: Item): Promise<void> {
    const store = await this.getStore('items', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getItemsBySection(section: 'store' | 'supplement'): Promise<Item[]> {
    const store = await this.getStore('items');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getItem(id: string): Promise<Item | null> {
    const store = await this.getStore('items');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(id: string): Promise<void> {
    const store = await this.getStore('items', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Customer operations
  async saveCustomer(customer: Customer): Promise<void> {
    const store = await this.getStore('customers', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(customer);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCustomersBySection(section: 'store' | 'supplement'): Promise<Customer[]> {
    const store = await this.getStore('customers');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Customer purchase operations
  async saveCustomerPurchase(purchase: CustomerPurchase): Promise<void> {
    const store = await this.getStore('customerPurchases', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(purchase);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    const store = await this.getStore('customerPurchases');
    const index = store.index('customerId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(customerId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnpaidCustomerPurchases(section: 'store' | 'supplement'): Promise<CustomerPurchase[]> {
    const store = await this.getStore('customerPurchases');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const purchases = request.result.filter(p => p.section === section && !p.isPaid);
        resolve(purchases);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Expense operations
  async saveExpense(expense: Expense): Promise<void> {
    const store = await this.getStore('expenses', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(expense);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    const store = await this.getStore('expenses');
    const index = store.index('shiftId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(shiftId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Shift edit operations
  async saveShiftEdit(edit: ShiftEdit): Promise<void> {
    const store = await this.getStore('shiftEdits', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(edit);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
    const store = await this.getStore('shiftEdits');
    const index = store.index('shiftId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(shiftId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Shift operations
  async saveShift(shift: Shift): Promise<void> {
    const store = await this.getStore('shifts', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(shift);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getActiveShift(section: 'store' | 'supplement'): Promise<Shift | null> {
    const store = await this.getStore('shifts');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const shifts = request.result;
        const activeShift = shifts.find(s => s.status === 'active' && s.section === section);
        resolve(activeShift || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getShiftsBySection(section: 'store' | 'supplement'): Promise<Shift[]> {
    const store = await this.getStore('shifts');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ));
      request.onerror = () => reject(request.error);
    });
  }

  // Supply operations
  async saveSupply(supply: Supply): Promise<void> {
    const store = await this.getStore('supplies', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(supply);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSuppliesBySection(section: 'store' | 'supplement'): Promise<Supply[]> {
    const store = await this.getStore('supplies');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Payment operations
  async savePayment(payment: Payment): Promise<void> {
    const store = await this.getStore('payments', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(payment);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPayments(): Promise<Payment[]> {
    const store = await this.getStore('payments');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Daily summary operations
  async saveDailySummary(summary: DailySummary): Promise<void> {
    const store = await this.getStore('dailySummaries', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(summary);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDailySummary(date: string, section: 'store' | 'supplement'): Promise<DailySummary | null> {
    const store = await this.getStore('dailySummaries');
    return new Promise((resolve, reject) => {
      const request = store.get(`${date}-${section}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Monthly summary operations
  async saveMonthlySummary(summary: MonthlySummary): Promise<void> {
    const store = await this.getStore('monthlySummaries', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(summary);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMonthlySummary(month: string, section: 'store' | 'supplement'): Promise<MonthlySummary | null> {
    const store = await this.getStore('monthlySummaries');
    return new Promise((resolve, reject) => {
      const request = store.get(`${month}-${section}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getMonthlySummariesBySection(section: 'store' | 'supplement'): Promise<MonthlySummary[]> {
    const store = await this.getStore('monthlySummaries');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Supplement debt operations
  async saveSupplementDebt(debt: SupplementDebt): Promise<void> {
    const store = await this.getStore('supplementDebt', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put({ id: 'current', ...debt });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSupplementDebt(): Promise<SupplementDebt | null> {
    const store = await this.getStore('supplementDebt');
    return new Promise((resolve, reject) => {
      const request = store.get('current');
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { id, ...debt } = result;
          resolve(debt);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    const store = await this.getStore('settings', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    const store = await this.getStore('settings');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new DatabaseService();
