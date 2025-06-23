import { 
  User, Item, Shift, Supply, Payment, DailySummary, MonthlySummary, 
  SupplementDebt, Category, Customer, CustomerPurchase, Expense, ShiftEdit, AdminLog 
} from '../types';

class DatabaseService {
  private dbName = 'StoreInventoryDB';
  private version = 4; // Incremented version for schema updates
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Database failed to open:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('Database upgrade needed, current version:', event.oldVersion);

        // Users store
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
          console.log('Created users store');
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('section', 'section');
          console.log('Created categories store');
        }

        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('section', 'section');
          itemStore.createIndex('categoryId', 'categoryId');
          console.log('Created items store');
        }

        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
          customerStore.createIndex('section', 'section');
          console.log('Created customers store');
        }

        // Customer purchases store
        if (!db.objectStoreNames.contains('customerPurchases')) {
          const customerPurchaseStore = db.createObjectStore('customerPurchases', { keyPath: 'id' });
          customerPurchaseStore.createIndex('customerId', 'customerId');
          customerPurchaseStore.createIndex('section', 'section');
          customerPurchaseStore.createIndex('isPaid', 'isPaid');
          console.log('Created customerPurchases store');
        }

        // Expenses store
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expenseStore.createIndex('shiftId', 'shiftId');
          expenseStore.createIndex('section', 'section');
          console.log('Created expenses store');
        }

        // Shift edits store
        if (!db.objectStoreNames.contains('shiftEdits')) {
          const shiftEditStore = db.createObjectStore('shiftEdits', { keyPath: 'id' });
          shiftEditStore.createIndex('shiftId', 'shiftId');
          console.log('Created shiftEdits store');
        }

        // Admin logs store
        if (!db.objectStoreNames.contains('adminLogs')) {
          const adminLogStore = db.createObjectStore('adminLogs', { keyPath: 'id' });
          adminLogStore.createIndex('timestamp', 'timestamp');
          adminLogStore.createIndex('adminName', 'adminName');
          adminLogStore.createIndex('section', 'section');
          console.log('Created adminLogs store');
        }

        // Shifts store
        if (!db.objectStoreNames.contains('shifts')) {
          const shiftStore = db.createObjectStore('shifts', { keyPath: 'id' });
          shiftStore.createIndex('status', 'status');
          shiftStore.createIndex('section', 'section');
          shiftStore.createIndex('startTime', 'startTime');
          console.log('Created shifts store');
        }

        // Supplies store
        if (!db.objectStoreNames.contains('supplies')) {
          const supplyStore = db.createObjectStore('supplies', { keyPath: 'id' });
          supplyStore.createIndex('section', 'section');
          console.log('Created supplies store');
        }

        // Payments store
        if (!db.objectStoreNames.contains('payments')) {
          db.createObjectStore('payments', { keyPath: 'id' });
          console.log('Created payments store');
        }

        // Daily summaries store
        if (!db.objectStoreNames.contains('dailySummaries')) {
          const dailyStore = db.createObjectStore('dailySummaries', { keyPath: 'date' });
          dailyStore.createIndex('section', 'section');
          console.log('Created dailySummaries store');
        }

        // Monthly summaries store
        if (!db.objectStoreNames.contains('monthlySummaries')) {
          const monthlyStore = db.createObjectStore('monthlySummaries', { keyPath: 'month' });
          monthlyStore.createIndex('section', 'section');
          console.log('Created monthlySummaries store');
        }

        // Supplement debt store
        if (!db.objectStoreNames.contains('supplementDebt')) {
          db.createObjectStore('supplementDebt', { keyPath: 'id' });
          console.log('Created supplementDebt store');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
          console.log('Created settings store');
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    
    try {
      const transaction = this.db.transaction([storeName], mode);
      return transaction.objectStore(storeName);
    } catch (error) {
      console.error(`Failed to get store ${storeName}:`, error);
      throw error;
    }
  }

  // User operations
  async createUser(user: User): Promise<void> {
    const store = await this.getStore('users', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(user);
      request.onsuccess = () => {
        console.log('User created successfully:', user.username);
        resolve();
      };
      request.onerror = () => {
        console.error('Failed to create user:', request.error);
        reject(request.error);
      };
    });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    const store = await this.getStore('users');
    const index = store.index('username');
    return new Promise((resolve, reject) => {
      const request = index.get(username);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('Failed to get user by username:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllUsers(): Promise<User[]> {
    const store = await this.getStore('users');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error('Failed to get all users:', request.error);
        reject(request.error);
      };
    });
  }

  async updateUser(user: User): Promise<void> {
    const store = await this.getStore('users', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(user);
      request.onsuccess = () => {
        console.log('User updated successfully:', user.username);
        resolve();
      };
      request.onerror = () => {
        console.error('Failed to update user:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteUser(id: string): Promise<void> {
    const store = await this.getStore('users', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        console.log('User deleted successfully:', id);
        resolve();
      };
      request.onerror = () => {
        console.error('Failed to delete user:', request.error);
        reject(request.error);
      };
    });
  }

  // Admin log operations
  async saveAdminLog(log: AdminLog): Promise<void> {
    const store = await this.getStore('adminLogs', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    const store = await this.getStore('adminLogs');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const logs = request.result.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(logs);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Category operations
  async saveCategory(category: Category): Promise<void> {
    const store = await this.getStore('categories', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(category);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCategoriesBySection(section: 'store' | 'supplement'): Promise<Category[]> {
    const store = await this.getStore('categories');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const store = await this.getStore('categories', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Item operations
  async saveItem(item: Item): Promise<void> {
    const store = await this.getStore('items', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getItemsBySection(section: 'store' | 'supplement'): Promise<Item[]> {
    const store = await this.getStore('items');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result || []);
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
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Customer operations
  async saveCustomer(customer: Customer): Promise<void> {
    const store = await this.getStore('customers', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(customer);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCustomersBySection(section: 'store' | 'supplement'): Promise<Customer[]> {
    const store = await this.getStore('customers');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Customer purchase operations
  async saveCustomerPurchase(purchase: CustomerPurchase): Promise<void> {
    const store = await this.getStore('customerPurchases', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(purchase);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    const store = await this.getStore('customerPurchases');
    const index = store.index('customerId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(customerId);
      request.onsuccess = () => resolve(request.result || []);
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
    return new Promise((resolve, reject) => {
      const request = store.put(expense);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    const store = await this.getStore('expenses');
    const index = store.index('shiftId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(shiftId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Shift edit operations
  async saveShiftEdit(edit: ShiftEdit): Promise<void> {
    const store = await this.getStore('shiftEdits', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(edit);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
    const store = await this.getStore('shiftEdits');
    const index = store.index('shiftId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(shiftId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Shift operations
  async saveShift(shift: Shift): Promise<void> {
    const store = await this.getStore('shifts', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(shift);
      request.onsuccess = () => resolve();
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
    return new Promise((resolve, reject) => {
      const request = store.put(supply);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSuppliesBySection(section: 'store' | 'supplement'): Promise<Supply[]> {
    const store = await this.getStore('supplies');
    const index = store.index('section');
    return new Promise((resolve, reject) => {
      const request = index.getAll(section);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Payment operations
  async savePayment(payment: Payment): Promise<void> {
    const store = await this.getStore('payments', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(payment);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPayments(): Promise<Payment[]> {
    const store = await this.getStore('payments');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Daily summary operations
  async saveDailySummary(summary: DailySummary): Promise<void> {
    const store = await this.getStore('dailySummaries', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(summary);
      request.onsuccess = () => resolve();
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
    return new Promise((resolve, reject) => {
      const request = store.put(summary);
      request.onsuccess = () => resolve();
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
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Supplement debt operations
  async saveSupplementDebt(debt: SupplementDebt): Promise<void> {
    const store = await this.getStore('supplementDebt', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'current', ...debt });
      request.onsuccess = () => resolve();
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
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
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