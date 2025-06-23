import { pgTable, text, integer, timestamp, boolean, decimal, jsonb, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['normal', 'admin'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sellPrice: decimal('sell_price', { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }).notNull(),
  currentAmount: integer('current_amount').notNull().default(0),
  image: text('image'),
  categoryId: uuid('category_id'),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  username: text('username').notNull(),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  status: text('status', { enum: ['active', 'closed'] }).notNull(),
  purchases: jsonb('purchases').notNull().default('[]'),
  expenses: jsonb('expenses').notNull().default('[]'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  finalInventory: jsonb('final_inventory'),
  finalCash: decimal('final_cash', { precision: 10, scale: 2 }),
  discrepancies: jsonb('discrepancies').default('[]'),
  closeReason: text('close_reason'),
  validationStatus: text('validation_status', { enum: ['balanced', 'discrepancy'] }).notNull().default('balanced'),
});

export const customerPurchases = pgTable('customer_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  items: jsonb('items').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  shiftId: uuid('shift_id'),
  isPaid: boolean('is_paid').notNull().default(false),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  shiftId: uuid('shift_id').notNull(),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
});

export const supplies = pgTable('supplies', {
  id: uuid('id').primaryKey().defaultRandom(),
  section: text('section', { enum: ['store', 'supplement'] }).notNull(),
  items: jsonb('items').notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
});

export const adminLogs = pgTable('admin_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionType: text('action_type').notNull(),
  itemOrShiftAffected: text('item_or_shift_affected').notNull(),
  changeDetails: text('change_details').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  adminName: text('admin_name').notNull(),
  section: text('section', { enum: ['store', 'supplement'] }),
});

export const shiftEdits = pgTable('shift_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').notNull(),
  field: text('field').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  reason: text('reason').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  editedBy: text('edited_by').notNull(),
});

export const supplementDebt = pgTable('supplement_debt', {
  id: uuid('id').primaryKey().defaultRandom(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

// Relations
export const itemsRelations = relations(items, ({ one }) => ({
  category: one(categories, {
    fields: [items.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(items),
}));

export const customerPurchasesRelations = relations(customerPurchases, ({ one }) => ({
  customer: one(customers, {
    fields: [customerPurchases.customerId],
    references: [customers.id],
  }),
  shift: one(shifts, {
    fields: [customerPurchases.shiftId],
    references: [shifts.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  shift: one(shifts, {
    fields: [expenses.shiftId],
    references: [shifts.id],
  }),
}));

export const shiftEditsRelations = relations(shiftEdits, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftEdits.shiftId],
    references: [shifts.id],
  }),
}));