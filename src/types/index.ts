export interface User {
  id: string;
  username: string;
  password: string;
  role: 'normal' | 'admin';
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  section: 'store' | 'supplement';
  createdAt: Date;
}

export interface Item {
  id: string;
  name: string;
  sellPrice: number;
  costPrice: number;
  currentAmount: number;
  image?: string;
  categoryId?: string;
  section: 'store' | 'supplement';
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseItem {
  itemId: string;
  quantity: number;
  price: number;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  section: 'store' | 'supplement';
  createdAt: Date;
}

export interface CustomerPurchase {
  id: string;
  customerId: string;
  customerName: string;
  items: PurchaseItem[];
  totalAmount: number;
  section: 'store' | 'supplement';
  shiftId?: string;
  isPaid: boolean;
  timestamp: Date;
}

export interface CustomerDebtDetails {
  id: string;
  customerId: string;
  customerName: string;
  section: 'store' | 'supplement';
  totalDebt: number;
  lastUpdated: Date;
  updatedBy: string;
}

export interface Expense {
  id: string;
  amount: number;
  reason: string;
  shiftId: string;
  section: 'store' | 'supplement';
  timestamp: Date;
  createdBy: string;
}

export interface ExternalMoney {
  id: string;
  amount: number;
  reason: string;
  shiftId: string;
  section: 'store' | 'supplement';
  timestamp: Date;
  createdBy: string;
}

export interface SupplementDebtTransaction {
  id: string;
  type: 'payment' | 'debt';
  amount: number;
  note: string;
  timestamp: Date;
  createdBy: string;
}

export interface ShiftEdit {
  id: string;
  shiftId: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
  timestamp: Date;
  editedBy: string;
}

export interface AdminLog {
  id: string;
  actionType: string;
  itemOrShiftAffected: string;
  changeDetails: string;
  timestamp: Date;
  adminName: string;
  section?: 'store' | 'supplement';
}

export interface MonthlyArchive {
  id: string;
  month: string;
  year: number;
  section: 'store' | 'supplement';
  totalProfit: number;
  totalCost: number;
  totalRevenue: number;
  itemsSold: Record<string, { quantity: number; revenue: number; name: string }>;
  shiftsCount: number;
  archivedAt: Date;
  archivedBy: string;
}

export interface Shift {
  id: string;
  userId: string;
  username: string;
  section: 'store' | 'supplement';
  status: 'active' | 'closed';
  purchases: PurchaseItem[];
  expenses: Expense[];
  externalMoney: ExternalMoney[];
  totalAmount: number;
  startTime: Date;
  endTime?: Date;
  finalInventory?: Record<string, number>;
  finalCash?: number;
  discrepancies?: string[];
  closeReason?: string;
  validationStatus: 'balanced' | 'discrepancy';
  edits?: ShiftEdit[];
}

export interface Supply {
  id: string;
  section: 'store' | 'supplement';
  items: Record<string, number>; // itemId -> quantity
  totalCost: number;
  timestamp: Date;
  createdBy: string;
}

export interface Payment {
  id: string;
  amount: number;
  paidBy: string;
  timestamp: Date;
  createdBy: string;
}

export interface DailySummary {
  date: string;
  section: 'store' | 'supplement';
  soldItems: Record<string, { quantity: number; cost: number; profit: number; name: string }>;
  totalCost: number;
  totalProfit: number;
  totalExpenses: number;
}

export interface MonthlySummary {
  month: string;
  year: number;
  section: 'store' | 'supplement';
  totalCost: number;
  totalProfit: number;
  totalExpenses: number;
  totalRevenue: number;
  shifts: Array<{
    id: string;
    startTime: Date;
    endTime?: Date;
    userOpened: string;
    userClosed?: string;
    totalCash: number;
    expenses: number;
    validationStatus: string;
  }>;
  soldItems: Record<string, {
    totalSold: number;
    totalCost: number;
    totalProfit: number;
    totalRevenue: number;
    name: string;
  }>;
}

export interface SupplementDebt {
  amount: number;
  lastUpdated: Date;
  updatedBy: string;
}

export interface DashboardStats {
  todayProfit: number;
  activeShift: boolean;
  topSellingItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  monthlyRevenue: number;
  totalCustomers: number;
  pendingCustomerDebt: number;
}

export interface CustomerDebt {
  customerId: string;
  customerName: string;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  items: CustomerPurchase[];
}