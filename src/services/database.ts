import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../lib/db';
import * as schema from '../lib/db/schema';
import { 
  User, Item, Shift, Supply, Payment, DailySummary, MonthlySummary, 
  SupplementDebt, Category, Customer, CustomerPurchase, Expense, ShiftEdit, AdminLog 
} from '../types';
import { realtimeService } from './realtime';

class DatabaseService {
  async init(): Promise<void> {
    console.log('Database service initialized with Neon');
  }

  // User operations
  async createUser(user: User): Promise<void> {
    await db.insert(schema.users).values({
      id: user.id,
      username: user.username,
      password: user.password,
      role: user.role,
      createdAt: user.createdAt,
    });
    console.log('User created successfully:', user.username);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0] || null;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  async updateUser(user: User): Promise<void> {
    await db.update(schema.users)
      .set({
        username: user.username,
        password: user.password,
        role: user.role,
      })
      .where(eq(schema.users.id, user.id));
    
    console.log('User updated successfully:', user.username);
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
    console.log('User deleted successfully:', id);
  }

  // Admin log operations
  async saveAdminLog(log: AdminLog): Promise<void> {
    await db.insert(schema.adminLogs).values({
      id: log.id,
      actionType: log.actionType,
      itemOrShiftAffected: log.itemOrShiftAffected,
      changeDetails: log.changeDetails,
      timestamp: log.timestamp,
      adminName: log.adminName,
      section: log.section,
    });

    realtimeService.broadcast('ITEM_UPDATED', { type: 'admin_log', log }, log.section);
  }

  async getAllAdminLogs(): Promise<AdminLog[]> {
    return await db.select().from(schema.adminLogs).orderBy(desc(schema.adminLogs.timestamp));
  }

  // Category operations
  async saveCategory(category: Category): Promise<void> {
    await db.insert(schema.categories).values({
      id: category.id,
      name: category.name,
      section: category.section,
      createdAt: category.createdAt,
    }).onConflictDoUpdate({
      target: schema.categories.id,
      set: {
        name: category.name,
      }
    });

    realtimeService.broadcast('ITEM_UPDATED', { type: 'category', category }, category.section);
  }

  async getCategoriesBySection(section: 'store' | 'supplement'): Promise<Category[]> {
    return await db.select().from(schema.categories).where(eq(schema.categories.section, section));
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1);
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
    
    if (category[0]) {
      realtimeService.broadcast('ITEM_UPDATED', { type: 'category_deleted', id }, category[0].section);
    }
  }

  // Item operations
  async saveItem(item: Item): Promise<void> {
    await db.insert(schema.items).values({
      id: item.id,
      name: item.name,
      sellPrice: item.sellPrice.toString(),
      costPrice: item.costPrice.toString(),
      currentAmount: item.currentAmount,
      image: item.image,
      categoryId: item.categoryId,
      section: item.section,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }).onConflictDoUpdate({
      target: schema.items.id,
      set: {
        name: item.name,
        sellPrice: item.sellPrice.toString(),
        costPrice: item.costPrice.toString(),
        currentAmount: item.currentAmount,
        image: item.image,
        categoryId: item.categoryId,
        updatedAt: item.updatedAt,
      }
    });

    realtimeService.broadcast('ITEM_UPDATED', { type: 'item', item }, item.section);
  }

  async getItemsBySection(section: 'store' | 'supplement'): Promise<Item[]> {
    const result = await db.select().from(schema.items).where(eq(schema.items.section, section));
    return result.map(item => ({
      ...item,
      sellPrice: parseFloat(item.sellPrice),
      costPrice: parseFloat(item.costPrice),
    }));
  }

  async getItem(id: string): Promise<Item | null> {
    const result = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
    if (!result[0]) return null;
    
    return {
      ...result[0],
      sellPrice: parseFloat(result[0].sellPrice),
      costPrice: parseFloat(result[0].costPrice),
    };
  }

  async deleteItem(id: string): Promise<void> {
    const item = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
    await db.delete(schema.items).where(eq(schema.items.id, id));
    
    if (item[0]) {
      realtimeService.broadcast('ITEM_UPDATED', { type: 'item_deleted', id }, item[0].section);
    }
  }

  // Customer operations
  async saveCustomer(customer: Customer): Promise<void> {
    await db.insert(schema.customers).values({
      id: customer.id,
      name: customer.name,
      section: customer.section,
      createdAt: customer.createdAt,
    }).onConflictDoUpdate({
      target: schema.customers.id,
      set: {
        name: customer.name,
      }
    });

    realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer', customer }, customer.section);
  }

  async getCustomersBySection(section: 'store' | 'supplement'): Promise<Customer[]> {
    return await db.select().from(schema.customers).where(eq(schema.customers.section, section));
  }

  // Customer purchase operations
  async saveCustomerPurchase(purchase: CustomerPurchase): Promise<void> {
    await db.insert(schema.customerPurchases).values({
      id: purchase.id,
      customerId: purchase.customerId,
      customerName: purchase.customerName,
      items: purchase.items,
      totalAmount: purchase.totalAmount.toString(),
      section: purchase.section,
      shiftId: purchase.shiftId,
      isPaid: purchase.isPaid,
      timestamp: purchase.timestamp,
    }).onConflictDoUpdate({
      target: schema.customerPurchases.id,
      set: {
        isPaid: purchase.isPaid,
        totalAmount: purchase.totalAmount.toString(),
      }
    });

    realtimeService.broadcast('CUSTOMER_UPDATED', { type: 'customer_purchase', purchase }, purchase.section);
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    const result = await db.select().from(schema.customerPurchases).where(eq(schema.customerPurchases.customerId, customerId));
    return result.map(purchase => ({
      ...purchase,
      totalAmount: parseFloat(purchase.totalAmount),
    }));
  }

  async getUnpaidCustomerPurchases(section: 'store' | 'supplement'): Promise<CustomerPurchase[]> {
    const result = await db.select().from(schema.customerPurchases)
      .where(and(eq(schema.customerPurchases.section, section), eq(schema.customerPurchases.isPaid, false)));
    
    return result.map(purchase => ({
      ...purchase,
      totalAmount: parseFloat(purchase.totalAmount),
    }));
  }

  // Expense operations
  async saveExpense(expense: Expense): Promise<void> {
    await db.insert(schema.expenses).values({
      id: expense.id,
      amount: expense.amount.toString(),
      reason: expense.reason,
      shiftId: expense.shiftId,
      section: expense.section,
      timestamp: expense.timestamp,
      createdBy: expense.createdBy,
    });

    realtimeService.broadcast('EXPENSE_ADDED', { type: 'expense', expense }, expense.section);
  }

  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    const result = await db.select().from(schema.expenses).where(eq(schema.expenses.shiftId, shiftId));
    return result.map(expense => ({
      ...expense,
      amount: parseFloat(expense.amount),
    }));
  }

  // Shift edit operations
  async saveShiftEdit(edit: ShiftEdit): Promise<void> {
    await db.insert(schema.shiftEdits).values({
      id: edit.id,
      shiftId: edit.shiftId,
      field: edit.field,
      oldValue: edit.oldValue,
      newValue: edit.newValue,
      reason: edit.reason,
      timestamp: edit.timestamp,
      editedBy: edit.editedBy,
    });

    const shift = await this.getShift(edit.shiftId);
    if (shift) {
      realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift_edit', edit, shift }, shift.section);
    }
  }

  async getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
    return await db.select().from(schema.shiftEdits).where(eq(schema.shiftEdits.shiftId, shiftId));
  }

  // Shift operations
  async saveShift(shift: Shift): Promise<void> {
    await db.insert(schema.shifts).values({
      id: shift.id,
      userId: shift.userId,
      username: shift.username,
      section: shift.section,
      status: shift.status,
      purchases: shift.purchases,
      expenses: shift.expenses,
      totalAmount: shift.totalAmount.toString(),
      startTime: shift.startTime,
      endTime: shift.endTime,
      finalInventory: shift.finalInventory,
      finalCash: shift.finalCash?.toString(),
      discrepancies: shift.discrepancies,
      closeReason: shift.closeReason,
      validationStatus: shift.validationStatus,
    }).onConflictDoUpdate({
      target: schema.shifts.id,
      set: {
        status: shift.status,
        purchases: shift.purchases,
        expenses: shift.expenses,
        totalAmount: shift.totalAmount.toString(),
        endTime: shift.endTime,
        finalInventory: shift.finalInventory,
        finalCash: shift.finalCash?.toString(),
        discrepancies: shift.discrepancies,
        closeReason: shift.closeReason,
        validationStatus: shift.validationStatus,
      }
    });

    realtimeService.broadcast('SHIFT_UPDATED', { type: 'shift', shift }, shift.section);
  }

  async getActiveShift(section: 'store' | 'supplement'): Promise<Shift | null> {
    const result = await db.select().from(schema.shifts)
      .where(and(eq(schema.shifts.section, section), eq(schema.shifts.status, 'active')))
      .limit(1);
    
    if (!result[0]) return null;
    
    return {
      ...result[0],
      totalAmount: parseFloat(result[0].totalAmount),
      finalCash: result[0].finalCash ? parseFloat(result[0].finalCash) : undefined,
    };
  }

  async getShift(id: string): Promise<Shift | null> {
    const result = await db.select().from(schema.shifts).where(eq(schema.shifts.id, id)).limit(1);
    if (!result[0]) return null;
    
    return {
      ...result[0],
      totalAmount: parseFloat(result[0].totalAmount),
      finalCash: result[0].finalCash ? parseFloat(result[0].finalCash) : undefined,
    };
  }

  async getShiftsBySection(section: 'store' | 'supplement'): Promise<Shift[]> {
    const result = await db.select().from(schema.shifts)
      .where(eq(schema.shifts.section, section))
      .orderBy(desc(schema.shifts.startTime));
    
    return result.map(shift => ({
      ...shift,
      totalAmount: parseFloat(shift.totalAmount),
      finalCash: shift.finalCash ? parseFloat(shift.finalCash) : undefined,
    }));
  }

  // Supply operations
  async saveSupply(supply: Supply): Promise<void> {
    await db.insert(schema.supplies).values({
      id: supply.id,
      section: supply.section,
      items: supply.items,
      totalCost: supply.totalCost.toString(),
      timestamp: supply.timestamp,
      createdBy: supply.createdBy,
    });

    realtimeService.broadcast('SUPPLY_ADDED', { type: 'supply', supply }, supply.section);
  }

  async getSuppliesBySection(section: 'store' | 'supplement'): Promise<Supply[]> {
    const result = await db.select().from(schema.supplies).where(eq(schema.supplies.section, section));
    return result.map(supply => ({
      ...supply,
      totalCost: parseFloat(supply.totalCost),
    }));
  }

  // Payment operations (keeping for compatibility)
  async savePayment(payment: Payment): Promise<void> {
    // This might need to be implemented based on your payment structure
    console.log('Payment saved:', payment);
  }

  async getAllPayments(): Promise<Payment[]> {
    // This might need to be implemented based on your payment structure
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
    await db.insert(schema.supplementDebt).values({
      amount: debt.amount.toString(),
      lastUpdated: debt.lastUpdated,
      updatedBy: debt.updatedBy,
    }).onConflictDoUpdate({
      target: schema.supplementDebt.id,
      set: {
        amount: debt.amount.toString(),
        lastUpdated: debt.lastUpdated,
        updatedBy: debt.updatedBy,
      }
    });

    realtimeService.broadcast('ITEM_UPDATED', { type: 'supplement_debt', debt }, 'supplement');
  }

  async getSupplementDebt(): Promise<SupplementDebt | null> {
    const result = await db.select().from(schema.supplementDebt).limit(1);
    if (!result[0]) return null;
    
    return {
      amount: parseFloat(result[0].amount),
      lastUpdated: result[0].lastUpdated,
      updatedBy: result[0].updatedBy,
    };
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    await db.insert(schema.settings).values({
      key,
      value,
    }).onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        value,
      }
    });
  }

  async getSetting(key: string): Promise<any> {
    const result = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
    return result[0]?.value;
  }
}

export const db_service = new DatabaseService();