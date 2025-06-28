import { supabase } from '../lib/supabase';
import { 
  User, Item, Shift, Supply, Payment, DailySummary, MonthlySummary, 
  SupplementDebt, Category, Customer, CustomerPurchase, Expense, ShiftEdit, AdminLog 
} from '../types';
import { realtimeService } from './realtime';

class DatabaseService {
  async init(): Promise<void> {
    console.log('Database service initialized with Supabase');
    
    // Test connection
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      if (error) {
        console.error('Database connection test failed:', error);
      } else {
        console.log('Database connection successful');
      }
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  // User operations
  async createUser(user: User): Promise<void> {
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      username: user.username,
      password: user.password,
      role: user.role,
      created_at: user.createdAt.toISOString(),
    });

    if (error) {
      console.error('Error creating user:', error);
      throw error;
    }
    console.log('User created successfully:', user.username);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      username: data.username,
      password: data.password,
      role: data.role,
      createdAt: new Date(data.created_at),
    };
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*');
    
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return data.map(user => ({
      id: user.id,
      username: user.username,
      password: user.password,
      role: user.role,
      createdAt: new Date(user.created_at),
    }));
  }

  async updateUser(user: User): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        username: user.username,
        password: user.password,
        role: user.role,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }
    console.log('User updated successfully:', user.username);
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    
    if (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
    console.log('User deleted successfully:', id);
  }

  // Admin log operations
  async saveAdminLog(log: AdminLog): Promise<void> {
    const { error } = await supabase.from('admin_logs').insert({
      id: log.id,
      action_type: log.actionType,
      item_or_shift_affected: log.itemOrShiftAffected,
      change_details: log.changeDetails,
      timestamp: log.timestamp.toISOString(),
      admin_name: log.adminName,
      section: log.section,
    });

    if (error) {
      console.error('Error saving admin log:', error);
      throw error;
    }

    realtimeService.broadcast('ITEM_UPDATED', { type: 'admin_log', log }, log.section);
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    const { data, error } = await supabase
      .from('admin_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching admin logs:', error);
      return [];
    }

    return data.map(log => ({
      id: log.id,
      actionType: log.action_type,
      itemOrShiftAffected: log.item_or_shift_affected,
      changeDetails: log.change_details,
      timestamp: new Date(log.timestamp),
      adminName: log.admin_name,
      section: log.section,
    }));
  }

  // Category operations
  async saveCategory(category: Category): Promise<void> {
    const { error } = await supabase.from('categories').upsert({
      id: category.id,
      name: category.name,
      section: category.section,
      created_at: category.createdAt.toISOString(),
    });

    if (error) {
      console.error('Error saving category:', error);
      throw error;
    }

    realtimeService.broadcast('ITEM_UPDATED', { type: 'category', category }, category.section);
  }

  async getCategoriesBySection(section: 'store' | 'supplement'): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('section', section);

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    return data.map(category => ({
      id: category.id,
      name: category.name,
      section: category.section,
      createdAt: new Date(category.created_at),
    }));
  }

  async deleteCategory(id: string): Promise<void> {
    const { data: category } = await supabase
      .from('categories')
      .select('section')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('categories').delete().eq('id', id);
    
    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }

    if (category) {
      realtimeService.broadcast('ITEM_UPDATED', { type: 'category_deleted', id }, category.section);
    }
  }

  // Item operations
  async saveItem(item: Item): Promise<void> {
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

    if (error) {
      console.error('Error saving item:', error);
      throw error;
    }

    realtimeService.broadcast('ITEM_UPDATED', { type: 'item', item }, item.section);
  }

  async getItemsBySection(section: 'store' | 'supplement'): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('section', section);

    if (error) {
      console.error('Error fetching items:', error);
      return [];
    }

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
  }

  async getItem(id: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching item:', error);
      return null;
    }

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
  }

  async deleteItem(id: string): Promise<void> {
    const { data: item } = await supabase
      .from('items')
      .select('section')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('items').delete().eq('id', id);
    
    if (error) {
      console.error('Error deleting item:', error);
      throw error;
    }

    if (item) {
      realtimeService.broadcast('ITEM_UPDATED', { type: 'item_deleted', id }, item.section);
    }
  }

  // Customer operations
  async saveCustomer(customer: Customer): Promise<void> {
    const { error } = await supabase.from('customers').upsert({
      id: customer.id,
      name: customer.name,
      section: customer.section,
      created_at: customer.createdAt.toISOString(),
    });

    if (error) {
      console.error('Error saving customer:', error);
      throw error;
    }

    realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer', customer }, customer.section);
  }

  async getCustomersBySection(section: 'store' | 'supplement'): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('section', section);

    if (error) {
      console.error('Error fetching customers:', error);
      return [];
    }

    return data.map(customer => ({
      id: customer.id,
      name: customer.name,
      section: customer.section,
      createdAt: new Date(customer.created_at),
    }));
  }

  // Customer purchase operations
  async saveCustomerPurchase(purchase: CustomerPurchase): Promise<void> {
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

    if (error) {
      console.error('Error saving customer purchase:', error);
      throw error;
    }

    realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer_purchase', purchase }, purchase.section);
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    const { data, error } = await supabase
      .from('customer_purchases')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching customer purchases:', error);
      return [];
    }

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
  }

  async getUnpaidCustomerPurchases(section: 'store' | 'supplement'): Promise<CustomerPurchase[]> {
    const { data, error } = await supabase
      .from('customer_purchases')
      .select('*')
      .eq('section', section)
      .eq('is_paid', false);

    if (error) {
      console.error('Error fetching unpaid purchases:', error);
      return [];
    }

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
  }

  // Expense operations
  async saveExpense(expense: Expense): Promise<void> {
    const { error } = await supabase.from('expenses').insert({
      id: expense.id,
      amount: expense.amount.toString(),
      reason: expense.reason,
      shift_id: expense.shiftId,
      section: expense.section,
      timestamp: expense.timestamp.toISOString(),
      created_by: expense.createdBy,
    });

    if (error) {
      console.error('Error saving expense:', error);
      throw error;
    }

    realtimeService.broadcast('EXPENSE_ADDED', { type: 'expense', expense }, expense.section);
  }

  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('shift_id', shiftId);

    if (error) {
      console.error('Error fetching expenses:', error);
      return [];
    }

    return data.map(expense => ({
      id: expense.id,
      amount: parseFloat(expense.amount),
      reason: expense.reason,
      shiftId: expense.shift_id,
      section: expense.section,
      timestamp: new Date(expense.timestamp),
      createdBy: expense.created_by,
    }));
  }

  // Shift edit operations
  async saveShiftEdit(edit: ShiftEdit): Promise<void> {
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

    if (error) {
      console.error('Error saving shift edit:', error);
      throw error;
    }

    const shift = await this.getShift(edit.shiftId);
    if (shift) {
      realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift_edit', edit, shift }, shift.section);
    }
  }

  async getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
    const { data, error } = await supabase
      .from('shift_edits')
      .select('*')
      .eq('shift_id', shiftId);

    if (error) {
      console.error('Error fetching shift edits:', error);
      return [];
    }

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
  }

  // Shift operations
  async saveShift(shift: Shift): Promise<void> {
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

    if (error) {
      console.error('Error saving shift:', error);
      throw error;
    }

    realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift', shift }, shift.section);
  }

  async getActiveShift(section: 'store' | 'supplement'): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('section', section)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching active shift:', error);
      return null;
    }

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
  }

  async getShift(id: string): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching shift:', error);
      return null;
    }

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
  }

  async getShiftsBySection(section: 'store' | 'supplement'): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('section', section)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching shifts:', error);
      return [];
    }

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
  }

  // Supply operations
  async saveSupply(supply: Supply): Promise<void> {
    const { error } = await supabase.from('supplies').insert({
      id: supply.id,
      section: supply.section,
      items: supply.items,
      total_cost: supply.totalCost.toString(),
      timestamp: supply.timestamp.toISOString(),
      created_by: supply.createdBy,
    });

    if (error) {
      console.error('Error saving supply:', error);
      throw error;
    }

    realtimeService.broadcast('SUPPLY_ADDED', { type: 'supply', supply }, supply.section);
  }

  async getSuppliesBySection(section: 'store' | 'supplement'): Promise<Supply[]> {
    const { data, error } = await supabase
      .from('supplies')
      .select('*')
      .eq('section', section);

    if (error) {
      console.error('Error fetching supplies:', error);
      return [];
    }

    return data.map(supply => ({
      id: supply.id,
      section: supply.section,
      items: supply.items as any,
      totalCost: parseFloat(supply.total_cost),
      timestamp: new Date(supply.timestamp),
      createdBy: supply.created_by,
    }));
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
    const { error } = await supabase.from('supplement_debt').upsert({
      amount: debt.amount.toString(),
      last_updated: debt.lastUpdated.toISOString(),
      updated_by: debt.updatedBy,
    });

    if (error) {
      console.error('Error saving supplement debt:', error);
      throw error;
    }

    realtimeService.broadcast('ITEM_UPDATED', { type: 'supplement_debt', debt }, 'supplement');
  }

  async getSupplementDebt(): Promise<SupplementDebt | null> {
    const { data, error } = await supabase
      .from('supplement_debt')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching supplement debt:', error);
      return null;
    }

    return {
      amount: parseFloat(data.amount),
      lastUpdated: new Date(data.last_updated),
      updatedBy: data.updated_by,
    };
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    const { error } = await supabase.from('settings').upsert({
      key,
      value,
    });

    if (error) {
      console.error('Error saving setting:', error);
      throw error;
    }
  }

  async getSetting(key: string): Promise<any> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching setting:', error);
      return null;
    }

    return data.value;
  }
}

export const db_service = new DatabaseService();