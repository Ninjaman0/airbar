import { supabase, testSupabaseConnection } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, Item, Shift, Supply, Payment, DailySummary, MonthlySummary, 
  SupplementDebt, Category, Customer, CustomerPurchase, Expense, ShiftEdit, AdminLog 
} from '../types';
import { realtimeService } from './realtime';

class DatabaseService {
  private isInitialized = false;
  private isOnlineMode = false;
  private localData: { [key: string]: any } = {};

  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing database service...');
    
    try {
      // Test Supabase connection with timeout
      this.isOnlineMode = await testSupabaseConnection();
      
      if (this.isOnlineMode) {
        console.log('Database service initialized in ONLINE mode with Supabase');
      } else {
        console.log('Database service initialized in OFFLINE mode - using local storage');
        this.initializeLocalStorage();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('Database initialization warning:', error);
      // Fall back to offline mode
      this.isOnlineMode = false;
      this.initializeLocalStorage();
      this.isInitialized = true;
    }
  }

  private initializeLocalStorage(): void {
    try {
      const stored = localStorage.getItem('localDatabaseData');
      if (stored) {
        this.localData = JSON.parse(stored);
      } else {
        this.localData = {
          users: [],
          items: [],
          categories: [],
          customers: [],
          shifts: [],
          supplies: [],
          expenses: [],
          customerPurchases: [],
          adminLogs: [],
          shiftEdits: [],
          supplementDebt: null,
          settings: {}
        };
        this.saveLocalData();
      }
    } catch (error) {
      console.error('Failed to initialize local storage:', error);
      this.localData = {
        users: [],
        items: [],
        categories: [],
        customers: [],
        shifts: [],
        supplies: [],
        expenses: [],
        customerPurchases: [],
        adminLogs: [],
        shiftEdits: [],
        supplementDebt: null,
        settings: {}
      };
    }
  }

  private saveLocalData(): void {
    try {
      localStorage.setItem('localDatabaseData', JSON.stringify(this.localData));
    } catch (error) {
      console.error('Failed to save local data:', error);
    }
  }

  // Helper function to handle Supabase errors
  private handleError(error: any, operation: string) {
    console.error(`Error in ${operation}:`, error);
    if (error?.code === 'PGRST116') {
      return null; // No rows found
    }
    throw error;
  }

  // User operations
  async createUser(user: User): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('users').upsert({
          id: user.id,
          username: user.username,
          password: user.password,
          role: user.role,
          created_at: user.createdAt.toISOString(),
        });

        if (error) throw error;
        console.log('User created successfully in database:', user.username);
        return;
      } catch (error) {
        console.warn('Failed to create user in database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.users) this.localData.users = [];
    const existingIndex = this.localData.users.findIndex((u: User) => u.id === user.id);
    if (existingIndex >= 0) {
      this.localData.users[existingIndex] = user;
    } else {
      this.localData.users.push(user);
    }
    this.saveLocalData();
    console.log('User created successfully in local storage:', user.username);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          return {
            id: data.id,
            username: data.username,
            password: data.password,
            role: data.role,
            createdAt: new Date(data.created_at),
          };
        }
      } catch (error) {
        console.warn('Failed to get user from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.users) return null;
    const user = this.localData.users.find((u: User) => u.username === username);
    return user || null;
  }

  async getAllUsers(): Promise<User[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*');
        
        if (error) throw error;

        return data.map(user => ({
          id: user.id,
          username: user.username,
          password: user.password,
          role: user.role,
          createdAt: new Date(user.created_at),
        }));
      } catch (error) {
        console.warn('Failed to get users from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return this.localData.users || [];
  }

  async updateUser(user: User): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase
          .from('users')
          .update({
            username: user.username,
            password: user.password,
            role: user.role,
          })
          .eq('id', user.id);

        if (error) throw error;
        console.log('User updated successfully in database:', user.username);
        return;
      } catch (error) {
        console.warn('Failed to update user in database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.users) this.localData.users = [];
    const index = this.localData.users.findIndex((u: User) => u.id === user.id);
    if (index >= 0) {
      this.localData.users[index] = user;
      this.saveLocalData();
      console.log('User updated successfully in local storage:', user.username);
    }
  }

  async deleteUser(id: string): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        
        if (error) throw error;
        console.log('User deleted successfully from database:', id);
        return;
      } catch (error) {
        console.warn('Failed to delete user from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.users) return;
    this.localData.users = this.localData.users.filter((u: User) => u.id !== id);
    this.saveLocalData();
    console.log('User deleted successfully from local storage:', id);
  }

  // Admin log operations
  async saveAdminLog(log: AdminLog): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('admin_logs').insert({
          id: log.id,
          action_type: log.actionType,
          item_or_shift_affected: log.itemOrShiftAffected,
          change_details: log.changeDetails,
          timestamp: log.timestamp.toISOString(),
          admin_name: log.adminName,
          section: log.section,
        });

        if (error) throw error;
        realtimeService.broadcast('ITEM_UPDATED', { type: 'admin_log', log }, log.section);
        return;
      } catch (error) {
        console.warn('Failed to save admin log to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.adminLogs) this.localData.adminLogs = [];
    this.localData.adminLogs.push(log);
    this.saveLocalData();
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (error) throw error;

        return data.map(log => ({
          id: log.id,
          actionType: log.action_type,
          itemOrShiftAffected: log.item_or_shift_affected,
          changeDetails: log.change_details,
          timestamp: new Date(log.timestamp),
          adminName: log.admin_name,
          section: log.section,
        }));
      } catch (error) {
        console.warn('Failed to get admin logs from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.adminLogs || []).sort((a: AdminLog, b: AdminLog) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  // Category operations
  async saveCategory(category: Category): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('categories').upsert({
          id: category.id,
          name: category.name,
          section: category.section,
          created_at: category.createdAt.toISOString(),
        });

        if (error) throw error;
        realtimeService.broadcast('ITEM_UPDATED', { type: 'category', category }, category.section);
        return;
      } catch (error) {
        console.warn('Failed to save category to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.categories) this.localData.categories = [];
    const existingIndex = this.localData.categories.findIndex((c: Category) => c.id === category.id);
    if (existingIndex >= 0) {
      this.localData.categories[existingIndex] = category;
    } else {
      this.localData.categories.push(category);
    }
    this.saveLocalData();
  }

  async getCategoriesBySection(section: 'store' | 'supplement'): Promise<Category[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('section', section);

        if (error) throw error;

        return data.map(category => ({
          id: category.id,
          name: category.name,
          section: category.section,
          createdAt: new Date(category.created_at),
        }));
      } catch (error) {
        console.warn('Failed to get categories from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.categories || []).filter((c: Category) => c.section === section);
  }

  async deleteCategory(id: string): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data: category } = await supabase
          .from('categories')
          .select('section')
          .eq('id', id)
          .single();

        const { error } = await supabase.from('categories').delete().eq('id', id);
        
        if (error) throw error;

        if (category) {
          realtimeService.broadcast('ITEM_UPDATED', { type: 'category_deleted', id }, category.section);
        }
        return;
      } catch (error) {
        console.warn('Failed to delete category from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.categories) return;
    const category = this.localData.categories.find((c: Category) => c.id === id);
    this.localData.categories = this.localData.categories.filter((c: Category) => c.id !== id);
    this.saveLocalData();
    
    if (category) {
      realtimeService.broadcast('ITEM_UPDATED', { type: 'category_deleted', id }, category.section);
    }
  }

  // Item operations
  async saveItem(item: Item): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('items').upsert({
          id: item.id,
          name: item.name,
          sell_price: item.sellPrice.toString(),
          cost_price: item.costPrice.toString(),
          current_amount: item.currentAmount,
          image: item.image,
          category_id: item.categoryId,
          section: item.section,
          created_at: item.createdAt.toISOString(),
          updated_at: item.updatedAt.toISOString(),
        });

        if (error) throw error;
        realtimeService.broadcast('ITEM_UPDATED', { type: 'item', item }, item.section);
        return;
      } catch (error) {
        console.warn('Failed to save item to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.items) this.localData.items = [];
    const existingIndex = this.localData.items.findIndex((i: Item) => i.id === item.id);
    if (existingIndex >= 0) {
      this.localData.items[existingIndex] = item;
    } else {
      this.localData.items.push(item);
    }
    this.saveLocalData();
    realtimeService.broadcast('ITEM_UPDATED', { type: 'item', item }, item.section);
  }

  async getItemsBySection(section: 'store' | 'supplement'): Promise<Item[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('section', section);

        if (error) throw error;

        return data.map(item => ({
          id: item.id,
          name: item.name,
          sellPrice: parseFloat(item.sell_price),
          costPrice: parseFloat(item.cost_price),
          currentAmount: item.current_amount,
          image: item.image,
          categoryId: item.category_id,
          section: item.section,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
        }));
      } catch (error) {
        console.warn('Failed to get items from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.items || []).filter((i: Item) => i.section === section);
  }

  async getItem(id: string): Promise<Item | null> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        return {
          id: data.id,
          name: data.name,
          sellPrice: parseFloat(data.sell_price),
          costPrice: parseFloat(data.cost_price),
          currentAmount: data.current_amount,
          image: data.image,
          categoryId: data.category_id,
          section: data.section,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        };
      } catch (error) {
        console.warn('Failed to get item from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.items || []).find((i: Item) => i.id === id) || null;
  }

  async deleteItem(id: string): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data: item } = await supabase
          .from('items')
          .select('section')
          .eq('id', id)
          .single();

        const { error } = await supabase.from('items').delete().eq('id', id);
        
        if (error) throw error;

        if (item) {
          realtimeService.broadcast('ITEM_UPDATED', { type: 'item_deleted', id }, item.section);
        }
        return;
      } catch (error) {
        console.warn('Failed to delete item from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.items) return;
    const item = this.localData.items.find((i: Item) => i.id === id);
    this.localData.items = this.localData.items.filter((i: Item) => i.id !== id);
    this.saveLocalData();
    
    if (item) {
      realtimeService.broadcast('ITEM_UPDATED', { type: 'item_deleted', id }, item.section);
    }
  }

  // Customer operations
  async saveCustomer(customer: Customer): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('customers').upsert({
          id: customer.id,
          name: customer.name,
          section: customer.section,
          created_at: customer.createdAt.toISOString(),
        });

        if (error) throw error;
        realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer', customer }, customer.section);
        return;
      } catch (error) {
        console.warn('Failed to save customer to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.customers) this.localData.customers = [];
    const existingIndex = this.localData.customers.findIndex((c: Customer) => c.id === customer.id);
    if (existingIndex >= 0) {
      this.localData.customers[existingIndex] = customer;
    } else {
      this.localData.customers.push(customer);
    }
    this.saveLocalData();
    realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer', customer }, customer.section);
  }

  async getCustomersBySection(section: 'store' | 'supplement'): Promise<Customer[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('section', section);

        if (error) throw error;

        return data.map(customer => ({
          id: customer.id,
          name: customer.name,
          section: customer.section,
          createdAt: new Date(customer.created_at),
        }));
      } catch (error) {
        console.warn('Failed to get customers from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.customers || []).filter((c: Customer) => c.section === section);
  }

  // Customer purchase operations
  async saveCustomerPurchase(purchase: CustomerPurchase): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('customer_purchases').upsert({
          id: purchase.id,
          customer_id: purchase.customerId,
          customer_name: purchase.customerName,
          items: purchase.items,
          total_amount: purchase.totalAmount.toString(),
          section: purchase.section,
          shift_id: purchase.shiftId,
          is_paid: purchase.isPaid,
          timestamp: purchase.timestamp.toISOString(),
        });

        if (error) throw error;
        realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer_purchase', purchase }, purchase.section);
        return;
      } catch (error) {
        console.warn('Failed to save customer purchase to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.customerPurchases) this.localData.customerPurchases = [];
    const existingIndex = this.localData.customerPurchases.findIndex((p: CustomerPurchase) => p.id === purchase.id);
    if (existingIndex >= 0) {
      this.localData.customerPurchases[existingIndex] = purchase;
    } else {
      this.localData.customerPurchases.push(purchase);
    }
    this.saveLocalData();
    realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer_purchase', purchase }, purchase.section);
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_purchases')
          .select('*')
          .eq('customer_id', customerId);

        if (error) throw error;

        return data.map(purchase => ({
          id: purchase.id,
          customerId: purchase.customer_id,
          customerName: purchase.customer_name,
          items: purchase.items as any,
          totalAmount: parseFloat(purchase.total_amount),
          section: purchase.section,
          shiftId: purchase.shift_id,
          isPaid: purchase.is_paid,
          timestamp: new Date(purchase.timestamp),
        }));
      } catch (error) {
        console.warn('Failed to get customer purchases from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.customerPurchases || []).filter((p: CustomerPurchase) => p.customerId === customerId);
  }

  async getUnpaidCustomerPurchases(section: 'store' | 'supplement'): Promise<CustomerPurchase[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_purchases')
          .select('*')
          .eq('section', section)
          .eq('is_paid', false);

        if (error) throw error;

        return data.map(purchase => ({
          id: purchase.id,
          customerId: purchase.customer_id,
          customerName: purchase.customer_name,
          items: purchase.items as any,
          totalAmount: parseFloat(purchase.total_amount),
          section: purchase.section,
          shiftId: purchase.shift_id,
          isPaid: purchase.is_paid,
          timestamp: new Date(purchase.timestamp),
        }));
      } catch (error) {
        console.warn('Failed to get unpaid customer purchases from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.customerPurchases || []).filter((p: CustomerPurchase) => 
      p.section === section && !p.isPaid
    );
  }

  // Expense operations
  async saveExpense(expense: Expense): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('expenses').insert({
          id: expense.id,
          amount: expense.amount.toString(),
          reason: expense.reason,
          shift_id: expense.shiftId,
          section: expense.section,
          timestamp: expense.timestamp.toISOString(),
          created_by: expense.createdBy,
        });

        if (error) throw error;
        realtimeService.broadcast('EXPENSE_ADDED', { type: 'expense', expense }, expense.section);
        return;
      } catch (error) {
        console.warn('Failed to save expense to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.expenses) this.localData.expenses = [];
    this.localData.expenses.push(expense);
    this.saveLocalData();
    realtimeService.broadcast('EXPENSE_ADDED', { type: 'expense', expense }, expense.section);
  }

  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('shift_id', shiftId);

        if (error) throw error;

        return data.map(expense => ({
          id: expense.id,
          amount: parseFloat(expense.amount),
          reason: expense.reason,
          shiftId: expense.shift_id,
          section: expense.section,
          timestamp: new Date(expense.timestamp),
          createdBy: expense.created_by,
        }));
      } catch (error) {
        console.warn('Failed to get expenses from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.expenses || []).filter((e: Expense) => e.shiftId === shiftId);
  }

  // Shift edit operations
  async saveShiftEdit(edit: ShiftEdit): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('shift_edits').insert({
          id: edit.id,
          shift_id: edit.shiftId,
          field: edit.field,
          old_value: edit.oldValue,
          new_value: edit.newValue,
          reason: edit.reason,
          timestamp: edit.timestamp.toISOString(),
          edited_by: edit.editedBy,
        });

        if (error) throw error;

        const shift = await this.getShift(edit.shiftId);
        if (shift) {
          realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift_edit', edit, shift }, shift.section);
        }
        return;
      } catch (error) {
        console.warn('Failed to save shift edit to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.shiftEdits) this.localData.shiftEdits = [];
    this.localData.shiftEdits.push(edit);
    this.saveLocalData();

    const shift = await this.getShift(edit.shiftId);
    if (shift) {
      realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift_edit', edit, shift }, shift.section);
    }
  }

  async getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('shift_edits')
          .select('*')
          .eq('shift_id', shiftId);

        if (error) throw error;

        return data.map(edit => ({
          id: edit.id,
          shiftId: edit.shift_id,
          field: edit.field,
          oldValue: edit.old_value,
          newValue: edit.new_value,
          reason: edit.reason,
          timestamp: new Date(edit.timestamp),
          editedBy: edit.edited_by,
        }));
      } catch (error) {
        console.warn('Failed to get shift edits from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.shiftEdits || []).filter((e: ShiftEdit) => e.shiftId === shiftId);
  }

  // Shift operations
  async saveShift(shift: Shift): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('shifts').upsert({
          id: shift.id,
          user_id: shift.userId,
          username: shift.username,
          section: shift.section,
          status: shift.status,
          purchases: shift.purchases,
          expenses: shift.expenses,
          total_amount: shift.totalAmount.toString(),
          start_time: shift.startTime.toISOString(),
          end_time: shift.endTime?.toISOString(),
          final_inventory: shift.finalInventory,
          final_cash: shift.finalCash?.toString(),
          discrepancies: shift.discrepancies,
          close_reason: shift.closeReason,
          validation_status: shift.validationStatus,
        });

        if (error) throw error;
        realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift', shift }, shift.section);
        return;
      } catch (error) {
        console.warn('Failed to save shift to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.shifts) this.localData.shifts = [];
    const existingIndex = this.localData.shifts.findIndex((s: Shift) => s.id === shift.id);
    if (existingIndex >= 0) {
      this.localData.shifts[existingIndex] = shift;
    } else {
      this.localData.shifts.push(shift);
    }
    this.saveLocalData();
    realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift', shift }, shift.section);
  }

  async getActiveShift(section: 'store' | 'supplement'): Promise<Shift | null> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('section', section)
          .eq('status', 'active')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        return {
          id: data.id,
          userId: data.user_id,
          username: data.username,
          section: data.section,
          status: data.status,
          purchases: data.purchases as any,
          expenses: data.expenses as any,
          totalAmount: parseFloat(data.total_amount),
          startTime: new Date(data.start_time),
          endTime: data.end_time ? new Date(data.end_time) : undefined,
          finalInventory: data.final_inventory as any,
          finalCash: data.final_cash ? parseFloat(data.final_cash) : undefined,
          discrepancies: data.discrepancies as any,
          closeReason: data.close_reason,
          validationStatus: data.validation_status,
        };
      } catch (error) {
        console.warn('Failed to get active shift from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.shifts || []).find((s: Shift) => 
      s.section === section && s.status === 'active'
    ) || null;
  }

  async getShift(id: string): Promise<Shift | null> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        return {
          id: data.id,
          userId: data.user_id,
          username: data.username,
          section: data.section,
          status: data.status,
          purchases: data.purchases as any,
          expenses: data.expenses as any,
          totalAmount: parseFloat(data.total_amount),
          startTime: new Date(data.start_time),
          endTime: data.end_time ? new Date(data.end_time) : undefined,
          finalInventory: data.final_inventory as any,
          finalCash: data.final_cash ? parseFloat(data.final_cash) : undefined,
          discrepancies: data.discrepancies as any,
          closeReason: data.close_reason,
          validationStatus: data.validation_status,
        };
      } catch (error) {
        console.warn('Failed to get shift from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.shifts || []).find((s: Shift) => s.id === id) || null;
  }

  async getShiftsBySection(section: 'store' | 'supplement'): Promise<Shift[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('section', section)
          .order('start_time', { ascending: false });

        if (error) throw error;

        return data.map(shift => ({
          id: shift.id,
          userId: shift.user_id,
          username: shift.username,
          section: shift.section,
          status: shift.status,
          purchases: shift.purchases as any,
          expenses: shift.expenses as any,
          totalAmount: parseFloat(shift.total_amount),
          startTime: new Date(shift.start_time),
          endTime: shift.end_time ? new Date(shift.end_time) : undefined,
          finalInventory: shift.final_inventory as any,
          finalCash: shift.final_cash ? parseFloat(shift.final_cash) : undefined,
          discrepancies: shift.discrepancies as any,
          closeReason: shift.close_reason,
          validationStatus: shift.validation_status,
        }));
      } catch (error) {
        console.warn('Failed to get shifts from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.shifts || [])
      .filter((s: Shift) => s.section === section)
      .sort((a: Shift, b: Shift) => b.startTime.getTime() - a.startTime.getTime());
  }

  // Supply operations
  async saveSupply(supply: Supply): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('supplies').insert({
          id: supply.id,
          section: supply.section,
          items: supply.items,
          total_cost: supply.totalCost.toString(),
          timestamp: supply.timestamp.toISOString(),
          created_by: supply.createdBy,
        });

        if (error) throw error;
        realtimeService.broadcast('SUPPLY_ADDED', { type: 'supply', supply }, supply.section);
        return;
      } catch (error) {
        console.warn('Failed to save supply to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.supplies) this.localData.supplies = [];
    this.localData.supplies.push(supply);
    this.saveLocalData();
    realtimeService.broadcast('SUPPLY_ADDED', { type: 'supply', supply }, supply.section);
  }

  async getSuppliesBySection(section: 'store' | 'supplement'): Promise<Supply[]> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('supplies')
          .select('*')
          .eq('section', section);

        if (error) throw error;

        return data.map(supply => ({
          id: supply.id,
          section: supply.section,
          items: supply.items as any,
          totalCost: parseFloat(supply.total_cost),
          timestamp: new Date(supply.timestamp),
          createdBy: supply.created_by,
        }));
      } catch (error) {
        console.warn('Failed to get supplies from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return (this.localData.supplies || []).filter((s: Supply) => s.section === section);
  }

  // Payment operations (keeping for compatibility)
  async savePayment(payment: Payment): Promise<void> {
    console.log('Payment saved:', payment);
  }

  async getAllPayments(): Promise<Payment[]> {
    return [];
  }

  // Daily summary operations (keeping for compatibility)
  async saveDailySummary(summary: DailySummary): Promise<void> {
    console.log('Daily summary saved:', summary);
  }

  async getDailySummary(date: string, section: 'store' | 'supplement'): Promise<DailySummary | null> {
    return null;
  }

  // Monthly summary operations (keeping for compatibility)
  async saveMonthlySummary(summary: MonthlySummary): Promise<void> {
    console.log('Monthly summary saved:', summary);
  }

  async getMonthlySummary(month: string, section: 'store' | 'supplement'): Promise<MonthlySummary | null> {
    return null;
  }

  async getMonthlySummariesBySection(section: 'store' | 'supplement'): Promise<MonthlySummary[]> {
    return [];
  }

  // Supplement debt operations
  async saveSupplementDebt(debt: SupplementDebt): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('supplement_debt').upsert({
          amount: debt.amount.toString(),
          last_updated: debt.lastUpdated.toISOString(),
          updated_by: debt.updatedBy,
        });

        if (error) throw error;
        realtimeService.broadcast('ITEM_UPDATED', { type: 'supplement_debt', debt }, 'supplement');
        return;
      } catch (error) {
        console.warn('Failed to save supplement debt to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    this.localData.supplementDebt = debt;
    this.saveLocalData();
    realtimeService.broadcast('ITEM_UPDATED', { type: 'supplement_debt', debt }, 'supplement');
  }

  async getSupplementDebt(): Promise<SupplementDebt | null> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('supplement_debt')
          .select('*')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        return {
          amount: parseFloat(data.amount),
          lastUpdated: new Date(data.last_updated),
          updatedBy: data.updated_by,
        };
      } catch (error) {
        console.warn('Failed to get supplement debt from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return this.localData.supplementDebt || null;
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    if (this.isOnlineMode && supabase) {
      try {
        const { error } = await supabase.from('settings').upsert({
          key,
          value,
        });

        if (error) throw error;
        return;
      } catch (error) {
        console.warn('Failed to save setting to database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    if (!this.localData.settings) this.localData.settings = {};
    this.localData.settings[key] = value;
    this.saveLocalData();
  }

  async getSetting(key: string): Promise<any> {
    if (this.isOnlineMode && supabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data?.value || null;
      } catch (error) {
        console.warn('Failed to get setting from database, falling back to local storage:', error);
        this.isOnlineMode = false;
      }
    }

    // Local storage fallback
    return this.localData.settings?.[key] || null;
  }

  // Utility method to check if we're in online mode
  isOnline(): boolean {
    return this.isOnlineMode;
  }
}

export const db_service = new DatabaseService();