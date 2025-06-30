import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, Item, Shift, Supply, Payment, DailySummary, MonthlySummary, 
  SupplementDebt, Category, Customer, CustomerPurchase, Expense, ShiftEdit, AdminLog, ExternalMoney, SupplementDebtTransaction, MonthlyArchive, CustomerDebtDetails 
} from '../types';
import { realtimeService } from './realtime';

class DatabaseService {
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing database service with Supabase...');
    
    try {
      // Test connection
      const { data, error } = await supabase.from('users').select('count').limit(1);
      if (error) {
        console.error('Database connection test failed:', error);
        throw new Error(`Database connection failed: ${error.message}`);
      }
      
      console.log('Database connection successful');
      this.isInitialized = true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
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

  // Enhanced broadcast function for better realtime updates
  private broadcastUpdate(type: string, data: any, section?: 'store' | 'supplement') {
    // Broadcast via realtime service
    realtimeService.broadcast(type as any, data, section);
    
    // Also log the update for debugging
    console.log(`Broadcasting ${type} update:`, data);
  }

  // Monthly archive operations
  async saveMonthlyArchive(archive: MonthlyArchive): Promise<void> {
    try {
      const { error } = await supabase.from('monthly_archives').insert({
        id: archive.id,
        month: archive.month,
        year: archive.year,
        section: archive.section,
        total_profit: archive.totalProfit.toString(),
        total_cost: archive.totalCost.toString(),
        total_revenue: archive.totalRevenue.toString(),
        items_sold: archive.itemsSold,
        shifts_count: archive.shiftsCount,
        archived_at: archive.archivedAt.toISOString(),
        archived_by: archive.archivedBy,
      });

      if (error) throw error;
      this.broadcastUpdate('ITEM_UPDATED', { type: 'monthly_archive', archive }, archive.section);
    } catch (error) {
      this.handleError(error, 'saveMonthlyArchive');
    }
  }

  async getMonthlyArchives(section: 'store' | 'supplement'): Promise<MonthlyArchive[]> {
    try {
      const { data, error } = await supabase
        .from('monthly_archives')
        .select('*')
        .eq('section', section)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;

      return (data || []).map(archive => ({
        id: archive.id,
        month: archive.month,
        year: archive.year,
        section: archive.section,
        totalProfit: parseFloat(archive.total_profit),
        totalCost: parseFloat(archive.total_cost),
        totalRevenue: parseFloat(archive.total_revenue),
        itemsSold: archive.items_sold as any,
        shiftsCount: archive.shifts_count,
        archivedAt: new Date(archive.archived_at),
        archivedBy: archive.archived_by,
      }));
    } catch (error) {
      this.handleError(error, 'getMonthlyArchives');
      return [];
    }
  }

  // Reset month functionality with proper foreign key handling
  async resetMonth(section: 'store' | 'supplement', adminName: string): Promise<void> {
    try {
      // Get all shifts for the current month
      const shifts = await this.getShiftsBySection(section);
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
      const currentYear = currentDate.getFullYear();

      // Calculate totals
      let totalProfit = 0;
      let totalCost = 0;
      let totalRevenue = 0;
      const itemsSold: Record<string, { quantity: number; revenue: number; name: string }> = {};

      // Get all items to calculate costs
      const allItems = await this.getItemsBySection(section);

      for (const shift of shifts) {
        for (const purchase of shift.purchases) {
          const item = allItems.find(i => i.id === purchase.itemId);
          if (item) {
            const revenue = purchase.price * purchase.quantity;
            const cost = item.costPrice * purchase.quantity;
            const profit = revenue - cost;

            totalRevenue += revenue;
            totalCost += cost;
            totalProfit += profit;

            if (!itemsSold[purchase.itemId]) {
              itemsSold[purchase.itemId] = {
                quantity: 0,
                revenue: 0,
                name: purchase.name
              };
            }

            itemsSold[purchase.itemId].quantity += purchase.quantity;
            itemsSold[purchase.itemId].revenue += revenue;
          }
        }
      }

      // Create monthly archive
      const archive: MonthlyArchive = {
        id: uuidv4(),
        month: currentMonth,
        year: currentYear,
        section,
        totalProfit,
        totalCost,
        totalRevenue,
        itemsSold,
        shiftsCount: shifts.length,
        archivedAt: new Date(),
        archivedBy: adminName
      };

      await this.saveMonthlyArchive(archive);

      // Delete records in the correct order to respect foreign key constraints
      
      // 1. Delete shift edits first (they reference shifts)
      const { error: deleteShiftEditsError } = await supabase
        .from('shift_edits')
        .delete()
        .in('shift_id', shifts.map(s => s.id));

      if (deleteShiftEditsError) throw deleteShiftEditsError;

      // 2. Delete customer purchases (they reference shifts)
      const { error: deletePurchasesError } = await supabase
        .from('customer_purchases')
        .delete()
        .eq('section', section);

      if (deletePurchasesError) throw deletePurchasesError;

      // 3. Delete expenses (they reference shifts)
      const { error: deleteExpensesError } = await supabase
        .from('expenses')
        .delete()
        .eq('section', section);

      if (deleteExpensesError) throw deleteExpensesError;

      // 4. Delete external money (they reference shifts)
      const { error: deleteExternalError } = await supabase
        .from('external_money')
        .delete()
        .eq('section', section);

      if (deleteExternalError) throw deleteExternalError;

      // 5. Finally delete shifts (now that all references are removed)
      const { error: deleteShiftsError } = await supabase
        .from('shifts')
        .delete()
        .eq('section', section);

      if (deleteShiftsError) throw deleteShiftsError;

      // Log the reset action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'month_reset',
        itemOrShiftAffected: `${section} section`,
        changeDetails: `Month reset for ${currentMonth} ${currentYear}. Archived ${shifts.length} shifts with total profit: ${totalProfit.toFixed(2)} EGP`,
        timestamp: new Date(),
        adminName,
        section
      };

      await this.saveAdminLog(log);

      this.broadcastUpdate('ITEM_UPDATED', { type: 'month_reset', section }, section);
    } catch (error) {
      this.handleError(error, 'resetMonth');
    }
  }

  // User operations
  async createUser(user: User): Promise<void> {
    try {
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role,
        created_at: user.createdAt.toISOString(),
      });

      if (error) throw error;
      console.log('User created successfully:', user.username);
      this.broadcastUpdate('ITEM_UPDATED', { type: 'user', user });
    } catch (error) {
      this.handleError(error, 'createUser');
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        username: data.username,
        password: data.password,
        role: data.role,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      return this.handleError(error, 'getUserByUsername');
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase.from('users').select('*');
      
      if (error) throw error;

      return (data || []).map(user => ({
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role,
        createdAt: new Date(user.created_at),
      }));
    } catch (error) {
      this.handleError(error, 'getAllUsers');
      return [];
    }
  }

  async updateUser(user: User): Promise<void> {
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
      console.log('User updated successfully:', user.username);
      this.broadcastUpdate('ITEM_UPDATED', { type: 'user_updated', user });
    } catch (error) {
      this.handleError(error, 'updateUser');
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      
      if (error) throw error;
      console.log('User deleted successfully:', id);
      this.broadcastUpdate('ITEM_UPDATED', { type: 'user_deleted', id });
    } catch (error) {
      this.handleError(error, 'deleteUser');
    }
  }

  // Admin log operations
  async saveAdminLog(log: AdminLog): Promise<void> {
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
      this.broadcastUpdate('ADMIN_LOG_ADDED', { type: 'admin_log', log }, log.section);
    } catch (error) {
      this.handleError(error, 'saveAdminLog');
    }
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(log => ({
        id: log.id,
        actionType: log.action_type,
        itemOrShiftAffected: log.item_or_shift_affected,
        changeDetails: log.change_details,
        timestamp: new Date(log.timestamp),
        adminName: log.admin_name,
        section: log.section,
      }));
    } catch (error) {
      this.handleError(error, 'getAllAdminLogs');
      return [];
    }
  }

  // Category operations
  async saveCategory(category: Category): Promise<void> {
    try {
      const { error } = await supabase.from('categories').upsert({
        id: category.id,
        name: category.name,
        section: category.section,
        created_at: category.createdAt.toISOString(),
      });

      if (error) throw error;
      this.broadcastUpdate('ITEM_UPDATED', { type: 'category', category }, category.section);
    } catch (error) {
      this.handleError(error, 'saveCategory');
    }
  }

  async getCategoriesBySection(section: 'store' | 'supplement'): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('section', section);

      if (error) throw error;

      return (data || []).map(category => ({
        id: category.id,
        name: category.name,
        section: category.section,
        createdAt: new Date(category.created_at),
      }));
    } catch (error) {
      this.handleError(error, 'getCategoriesBySection');
      return [];
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const { data: category } = await supabase
        .from('categories')
        .select('section')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('categories').delete().eq('id', id);
      
      if (error) throw error;

      if (category) {
        this.broadcastUpdate('ITEM_UPDATED', { type: 'category_deleted', id }, category.section);
      }
    } catch (error) {
      this.handleError(error, 'deleteCategory');
    }
  }

  // Item operations
  async saveItem(item: Item): Promise<void> {
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
      this.broadcastUpdate('ITEM_UPDATED', { type: 'item', item }, item.section);
    } catch (error) {
      this.handleError(error, 'saveItem');
    }
  }

  async getItemsBySection(section: 'store' | 'supplement'): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('section', section);

      if (error) throw error;

      return (data || []).map(item => ({
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
      this.handleError(error, 'getItemsBySection');
      return [];
    }
  }

  async getItem(id: string): Promise<Item | null> {
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
      return this.handleError(error, 'getItem');
    }
  }

  async deleteItem(id: string): Promise<void> {
    try {
      const { data: item } = await supabase
        .from('items')
        .select('section')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('items').delete().eq('id', id);
      
      if (error) throw error;

      if (item) {
        this.broadcastUpdate('ITEM_UPDATED', { type: 'item_deleted', id }, item.section);
      }
    } catch (error) {
      this.handleError(error, 'deleteItem');
    }
  }

  // Customer operations
  async saveCustomer(customer: Customer): Promise<void> {
    try {
      const { error } = await supabase.from('customers').upsert({
        id: customer.id,
        name: customer.name,
        section: customer.section,
        created_at: customer.createdAt.toISOString(),
      });

      if (error) throw error;
      this.broadcastUpdate('CUSTOMER_UPDATED', { type: 'customer', customer }, customer.section);
    } catch (error) {
      this.handleError(error, 'saveCustomer');
    }
  }

  async getCustomersBySection(section: 'store' | 'supplement'): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('section', section);

      if (error) throw error;

      return (data || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        section: customer.section,
        createdAt: new Date(customer.created_at),
      }));
    } catch (error) {
      this.handleError(error, 'getCustomersBySection');
      return [];
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('section')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('customers').delete().eq('id', id);
      
      if (error) throw error;

      if (customer) {
        this.broadcastUpdate('CUSTOMER_UPDATED', { type: 'customer_deleted', id }, customer.section);
      }
    } catch (error) {
      
      this.handleError(error, 'deleteCustomer');
    }
  }

  // Customer purchase operations
  async saveCustomerPurchase(purchase: CustomerPurchase): Promise<void> {
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
      this.broadcastUpdate('CUSTOMER_UPDATED', { type: 'customer_purchase', purchase }, purchase.section);
    } catch (error) {
      this.handleError(error, 'saveCustomerPurchase');
    }
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    try {
      const { data, error } = await supabase
        .from('customer_purchases')
        .select('*')
        .eq('customer_id', customerId);

      if (error) throw error;

      return (data || []).map(purchase => ({
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
      this.handleError(error, 'getCustomerPurchases');
      return [];
    }
  }

  async getUnpaidCustomerPurchases(section: 'store' | 'supplement'): Promise<CustomerPurchase[]> {
    try {
      const { data, error } = await supabase
        .from('customer_purchases')
        .select('*')
        .eq('section', section)
        .eq('is_paid', false);

      if (error) throw error;

      return (data || []).map(purchase => ({
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
      this.handleError(error, 'getUnpaidCustomerPurchases');
      return [];
    }
  }

  async deleteCustomerPurchase(id: string): Promise<void> {
    try {
      const { data: purchase } = await supabase
        .from('customer_purchases')
        .select('section')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('customer_purchases').delete().eq('id', id);
      
      if (error) throw error;

      if (purchase) {
        this.broadcastUpdate('CUSTOMER_UPDATED', { type: 'customer_purchase_deleted', id }, purchase.section);
      }
    } catch (error) {
      this.handleError(error, 'deleteCustomerPurchase');
    }
  }

  // Expense operations
  async saveExpense(expense: Expense): Promise<void> {
    try {
      const { error } = await supabase.from('expenses').upsert({
        id: expense.id,
        amount: expense.amount.toString(),
        reason: expense.reason,
        shift_id: expense.shiftId,
        section: expense.section,
        timestamp: expense.timestamp.toISOString(),
        created_by: expense.createdBy,
      });

      if (error) throw error;
      this.broadcastUpdate('EXPENSE_ADDED', { type: 'expense', expense }, expense.section);
    } catch (error) {
      this.handleError(error, 'saveExpense');
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      const { data: expense } = await supabase
        .from('expenses')
        .select('section')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('expenses').delete().eq('id', id);
      
      if (error) throw error;

      if (expense) {
        this.broadcastUpdate('EXPENSE_ADDED', { type: 'expense_deleted', id }, expense.section);
      }
    } catch (error) {
      this.handleError(error, 'deleteExpense');
    }
  }

  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('shift_id', shiftId);

      if (error) throw error;

      return (data || []).map(expense => ({
        id: expense.id,
        amount: parseFloat(expense.amount),
        reason: expense.reason,
        shiftId: expense.shift_id,
        section: expense.section,
        timestamp: new Date(expense.timestamp),
        createdBy: expense.created_by,
      }));
    } catch (error) {
      this.handleError(error, 'getExpensesByShift');
      return [];
    }
  }

  // External money operations
  async saveExternalMoney(externalMoney: ExternalMoney): Promise<void> {
    try {
      const { error } = await supabase.from('external_money').upsert({
        id: externalMoney.id,
        amount: externalMoney.amount.toString(),
        reason: externalMoney.reason,
        shift_id: externalMoney.shiftId,
        section: externalMoney.section,
        timestamp: externalMoney.timestamp.toISOString(),
        created_by: externalMoney.createdBy,
      });

      if (error) throw error;
      this.broadcastUpdate('EXTERNAL_MONEY_UPDATED', { type: 'external_money', externalMoney }, externalMoney.section);
    } catch (error) {
      this.handleError(error, 'saveExternalMoney');
    }
  }

  async deleteExternalMoney(id: string): Promise<void> {
    try {
      const { data: externalMoney } = await supabase
        .from('external_money')
        .select('section')
        .eq('id', id)
        .single();

      const { error } = await supabase.from('external_money').delete().eq('id', id);
      
      if (error) throw error;

      if (externalMoney) {
        this.broadcastUpdate('EXTERNAL_MONEY_UPDATED', { type: 'external_money_deleted', id }, externalMoney.section);
      }
    } catch (error) {
      this.handleError(error, 'deleteExternalMoney');
    }
  }

  async getExternalMoneyByShift(shiftId: string): Promise<ExternalMoney[]> {
    try {
      const { data, error } = await supabase
        .from('external_money')
        .select('*')
        .eq('shift_id', shiftId);

      if (error) throw error;

      return (data || []).map(money => ({
        id: money.id,
        amount: parseFloat(money.amount),
        reason: money.reason,
        shiftId: money.shift_id,
        section: money.section,
        timestamp: new Date(money.timestamp),
        createdBy: money.created_by,
      }));
    } catch (error) {
      this.handleError(error, 'getExternalMoneyByShift');
      return [];
    }
  }

  // Customer payment logging
  async logCustomerPayment(customerId: string, customerName: string, amount: number, paidPurchases: CustomerPurchase[], shiftId: string, section: 'store' | 'supplement'): Promise<void> {
    try {
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'customer_payment',
        itemOrShiftAffected: `Customer: ${customerName}`,
        changeDetails: `Payment of ${amount} EGP received. Paid purchases: ${paidPurchases.map(p => p.id).join(', ')}`,
        timestamp: new Date(),
        adminName: 'System',
        section
      };

      await this.saveAdminLog(log);
    } catch (error) {
      console.error('Error logging customer payment:', error);
    }
  }

  // Shift edit operations
  async saveShiftEdit(edit: ShiftEdit): Promise<void> {
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
        this.broadcastUpdate('SHIFT_UPDATED', { type: 'shift_edit', edit, shift }, shift.section);
      }
    } catch (error) {
      this.handleError(error, 'saveShiftEdit');
    }
  }

  async getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
    try {
      const { data, error } = await supabase
        .from('shift_edits')
        .select('*')
        .eq('shift_id', shiftId);

      if (error) throw error;

      return (data || []).map(edit => ({
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
      this.handleError(error, 'getShiftEdits');
      return [];
    }
  }

  // Shift operations
  async saveShift(shift: Shift): Promise<void> {
    try {
      const { error } = await supabase.from('shifts').upsert({
        id: shift.id,
        user_id: shift.userId,
        username: shift.username,
        section: shift.section,
        status: shift.status,
        purchases: shift.purchases,
        expenses: shift.expenses,
        external_money: shift.externalMoney || [],
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
      this.broadcastUpdate('SHIFT_UPDATED', { type: 'shift', shift }, shift.section);
    } catch (error) {
      this.handleError(error, 'saveShift');
    }
  }

  async getActiveShift(section: 'store' | 'supplement'): Promise<Shift | null> {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('section', section)
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      // Load expenses and external money
      const expenses = await this.getExpensesByShift(data.id);
      const externalMoney = await this.getExternalMoneyByShift(data.id);

      return {
        id: data.id,
        userId: data.user_id,
        username: data.username,
        section: data.section,
        status: data.status,
        purchases: data.purchases as any,
        expenses,
        externalMoney,
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
      return this.handleError(error, 'getActiveShift');
    }
  }

  async getShift(id: string): Promise<Shift | null> {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      // Load expenses and external money
      const expenses = await this.getExpensesByShift(data.id);
      const externalMoney = await this.getExternalMoneyByShift(data.id);

      return {
        id: data.id,
        userId: data.user_id,
        username: data.username,
        section: data.section,
        status: data.status,
        purchases: data.purchases as any,
        expenses,
        externalMoney,
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
      return this.handleError(error, 'getShift');
    }
  }

  async getShiftsBySection(section: 'store' | 'supplement'): Promise<Shift[]> {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('section', section)
        .order('start_time', { ascending: false });

      if (error) throw error;

      const shifts = await Promise.all((data || []).map(async (shift) => {
        const expenses = await this.getExpensesByShift(shift.id);
        const externalMoney = await this.getExternalMoneyByShift(shift.id);

        return {
          id: shift.id,
          userId: shift.user_id,
          username: shift.username,
          section: shift.section,
          status: shift.status,
          purchases: shift.purchases as any,
          expenses,
          externalMoney,
          totalAmount: parseFloat(shift.total_amount),
          startTime: new Date(shift.start_time),
          endTime: shift.end_time ? new Date(shift.end_time) : undefined,
          finalInventory: shift.final_inventory as any,
          finalCash: shift.final_cash ? parseFloat(shift.final_cash) : undefined,
          discrepancies: shift.discrepancies as any,
          closeReason: shift.close_reason,
          validationStatus: shift.validation_status,
        };
      }));

      return shifts;
    } catch (error) {
      this.handleError(error, 'getShiftsBySection');
      return [];
    }
  }

  // Supply operations with cash deduction
  async saveSupply(supply: Supply, activeShift?: Shift): Promise<void> {
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

      // If there's an active shift, deduct the cost as an expense
      if (activeShift) {
        const expense: Expense = {
          id: uuidv4(),
          amount: supply.totalCost,
          reason: 'توريد مخزون',
          shiftId: activeShift.id,
          section: supply.section,
          timestamp: new Date(),
          createdBy: supply.createdBy
        };

        await this.saveExpense(expense);
      }

      this.broadcastUpdate('SUPPLY_ADDED', { type: 'supply', supply }, supply.section);
    } catch (error) {
      this.handleError(error, 'saveSupply');
    }
  }

  async getSuppliesBySection(section: 'store' | 'supplement'): Promise<Supply[]> {
    try {
      const { data, error } = await supabase
        .from('supplies')
        .select('*')
        .eq('section', section);

      if (error) throw error;

      return (data || []).map(supply => ({
        id: supply.id,
        section: supply.section,
        items: supply.items as any,
        totalCost: parseFloat(supply.total_cost),
        timestamp: new Date(supply.timestamp),
        createdBy: supply.created_by,
      }));
    } catch (error) {
      this.handleError(error, 'getSuppliesBySection');
      return [];
    }
  }

  // Supplement debt operations
  async saveSupplementDebt(debt: SupplementDebt): Promise<void> {
    try {
      const { error } = await supabase.from('supplement_debt').upsert({
        amount: debt.amount.toString(),
        last_updated: debt.lastUpdated.toISOString(),
        updated_by: debt.updatedBy,
      });

      if (error) throw error;
      this.broadcastUpdate('DEBT_UPDATED', { type: 'supplement_debt', debt }, 'supplement');
    } catch (error) {
      this.handleError(error, 'saveSupplementDebt');
    }
  }

  async getSupplementDebt(): Promise<SupplementDebt | null> {
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
      return this.handleError(error, 'getSupplementDebt');
    }
  }

  // Supplement debt transaction operations
  async saveSupplementDebtTransaction(transaction: SupplementDebtTransaction): Promise<void> {
    try {
      const { error } = await supabase.from('supplement_debt_transactions').upsert({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        note: transaction.note,
        timestamp: transaction.timestamp.toISOString(),
        created_by: transaction.createdBy,
      });

      if (error) throw error;
      this.broadcastUpdate('DEBT_UPDATED', { type: 'supplement_debt_transaction', transaction }, 'supplement');
    } catch (error) {
      this.handleError(error, 'saveSupplementDebtTransaction');
    }
  }

  async getSupplementDebtTransactions(): Promise<SupplementDebtTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('supplement_debt_transactions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        note: transaction.note,
        timestamp: new Date(transaction.timestamp),
        createdBy: transaction.created_by,
      }));
    } catch (error) {
      this.handleError(error, 'getSupplementDebtTransactions');
      return [];
    }
  }

  // Delete supplement debt transaction
  async deleteSupplementDebtTransaction(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('supplement_debt_transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      this.broadcastUpdate('DEBT_UPDATED', { type: 'supplement_debt_transaction_deleted', id }, 'supplement');
    } catch (error) {
      this.handleError(error, 'deleteSupplementDebtTransaction');
    }
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    try {
      const { error } = await supabase.from('settings').upsert({
        key,
        value,
      });

      if (error) throw error;
      this.broadcastUpdate('ITEM_UPDATED', { type: 'setting', key, value });
    } catch (error) {
      this.handleError(error, 'saveSetting');
    }
  }

  async getSetting(key: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || null;
    } catch (error) {
      return this.handleError(error, 'getSetting');
    }
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
}

export const db_service = new DatabaseService();