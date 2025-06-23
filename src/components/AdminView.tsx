import React, { useState, useEffect } from 'react';
import { 
  Package, Users, FileText, Settings, Plus, Edit, Trash2, 
  Save, X, DollarSign, TrendingUp, Calendar, Clock,
  ShoppingCart, AlertCircle, CheckCircle, XCircle, Eye,
  Store, Pill, CreditCard, History, BarChart3, User,
  PlayCircle, StopCircle, Calculator, Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/database';
import { 
  Item, User as UserType, Category, Customer, CustomerPurchase, 
  Shift, Supply, Expense, AdminLog, SupplementDebt, PurchaseItem 
} from '../types';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('current-shift');
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [showAddSupplyForm, setShowAddSupplyForm] = useState(false);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const [showShiftDetails, setShowShiftDetails] = useState<string | null>(null);

  // New item form
  const [newItem, setNewItem] = useState({
    name: '',
    sellPrice: 0,
    costPrice: 0,
    currentAmount: 0,
    categoryId: ''
  });

  // New user form
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });

  // New category form
  const [newCategory, setNewCategory] = useState({
    name: ''
  });

  // Supply form
  const [supplyItems, setSupplyItems] = useState<Record<string, number>>({});
  const [supplyTotalCost, setSupplyTotalCost] = useState(0);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paidBy: ''
  });

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    amount: 0,
    reason: ''
  });

  // Purchase form for current shift
  const [purchaseForm, setPurchaseForm] = useState({
    itemId: '',
    quantity: 1,
    customPrice: 0
  });

  // Load data
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000); // Real-time updates every 2 seconds
    return () => clearInterval(interval);
  }, [section]);

  const loadData = async () => {
    try {
      const [
        itemsData,
        usersData,
        categoriesData,
        customersData,
        customerPurchasesData,
        shiftsData,
        currentShiftData,
        adminLogsData,
        supplementDebtData
      ] = await Promise.all([
        db.getItemsBySection(section),
        db.getAllUsers(),
        db.getCategoriesBySection(section),
        db.getCustomersBySection(section),
        db.getUnpaidCustomerPurchases(section),
        db.getShiftsBySection(section),
        db.getActiveShift(section),
        db.getAllAdminLogs(),
        section === 'supplement' ? db.getSupplementDebt() : Promise.resolve(null)
      ]);

      setItems(itemsData);
      setUsers(usersData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setCustomerPurchases(customerPurchasesData);
      setShifts(shiftsData);
      setCurrentShift(currentShiftData);
      setAdminLogs(adminLogsData.filter(log => !log.section || log.section === section));
      setSupplementDebt(supplementDebtData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const logAdminAction = async (actionType: string, itemOrShiftAffected: string, changeDetails: string) => {
    const log: AdminLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType,
      itemOrShiftAffected,
      changeDetails,
      timestamp: new Date(),
      adminName: user?.username || 'Unknown',
      section
    };
    
    await db.saveAdminLog(log);
    loadData();
  };

  // Item operations
  const handleSaveItem = async (item: Item) => {
    try {
      const oldItem = items.find(i => i.id === item.id);
      await db.saveItem({ ...item, updatedAt: new Date() });
      
      if (oldItem) {
        const changes = [];
        if (oldItem.name !== item.name) changes.push(`الاسم: ${oldItem.name} → ${item.name}`);
        if (oldItem.sellPrice !== item.sellPrice) changes.push(`سعر البيع: ${oldItem.sellPrice} → ${item.sellPrice}`);
        if (oldItem.costPrice !== item.costPrice) changes.push(`سعر التكلفة: ${oldItem.costPrice} → ${item.costPrice}`);
        if (oldItem.currentAmount !== item.currentAmount) changes.push(`الكمية: ${oldItem.currentAmount} → ${item.currentAmount}`);
        
        await logAdminAction('تعديل صنف', item.name, changes.join(', '));
      }
      
      setEditingItem(null);
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleDeleteItem = async (item: Item) => {
    if (confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) {
      try {
        await db.deleteItem(item.id);
        await logAdminAction('حذف صنف', item.name, `تم حذف الصنف نهائياً`);
        loadData();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) return;
    
    try {
      const item: Item = {
        id: `${section}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newItem.name.trim(),
        sellPrice: Math.floor(newItem.sellPrice),
        costPrice: Math.floor(newItem.costPrice),
        currentAmount: Math.floor(newItem.currentAmount),
        categoryId: newItem.categoryId || undefined,
        section,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.saveItem(item);
      await logAdminAction('إضافة صنف', item.name, `سعر البيع: ${item.sellPrice}, سعر التكلفة: ${item.costPrice}, الكمية: ${item.currentAmount}`);
      
      setNewItem({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, categoryId: '' });
      setShowAddItemForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  // Supply operations
  const handleAddSupply = async () => {
    try {
      const supply: Supply = {
        id: `supply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        section,
        items: supplyItems,
        totalCost: Math.floor(supplyTotalCost),
        timestamp: new Date(),
        createdBy: user?.username || 'Unknown'
      };

      await db.saveSupply(supply);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyItems)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          const updatedItem = {
            ...item,
            currentAmount: item.currentAmount + Math.floor(quantity),
            updatedAt: new Date()
          };
          await db.saveItem(updatedItem);
        }
      }

      // Update supplement debt if applicable
      if (section === 'supplement') {
        const currentDebt = supplementDebt?.amount || 0;
        const newDebt: SupplementDebt = {
          amount: currentDebt + Math.floor(supplyTotalCost),
          lastUpdated: new Date(),
          updatedBy: user?.username || 'Unknown'
        };
        await db.saveSupplementDebt(newDebt);
      }

      const itemNames = Object.entries(supplyItems)
        .map(([itemId, qty]) => {
          const item = items.find(i => i.id === itemId);
          return `${item?.name}: ${qty}`;
        })
        .join(', ');

      await logAdminAction('إضافة توريد', 'متعدد', `الأصناف: ${itemNames}, التكلفة الإجمالية: ${supplyTotalCost}`);

      setSupplyItems({});
      setSupplyTotalCost(0);
      setShowAddSupplyForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding supply:', error);
    }
  };

  // User operations
  const handleSaveUser = async (userToSave: UserType) => {
    try {
      await db.updateUser(userToSave);
      await logAdminAction('تعديل مستخدم', userToSave.username, 'تم تعديل بيانات المستخدم');
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleDeleteUser = async (userToDelete: UserType) => {
    if (userToDelete.id === user?.id) {
      alert('لا يمكنك حذف حسابك الخاص');
      return;
    }
    
    if (confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) {
      try {
        await db.deleteUser(userToDelete.id);
        await logAdminAction('حذف مستخدم', userToDelete.username, 'تم حذف المستخدم نهائياً');
        loadData();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) return;
    
    try {
      const userExists = users.some(u => u.username === newUser.username.trim());
      if (userExists) {
        alert('اسم المستخدم موجود بالفعل');
        return;
      }

      const userToAdd: UserType = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        username: newUser.username.trim(),
        password: newUser.password.trim(),
        role: newUser.role,
        createdAt: new Date()
      };
      
      await db.createUser(userToAdd);
      await logAdminAction('إضافة مستخدم', userToAdd.username, `الدور: ${userToAdd.role}`);
      
      setNewUser({ username: '', password: '', role: 'normal' });
      setShowAddUserForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  // Supplement debt operations
  const handleAddPayment = async () => {
    if (!paymentForm.paidBy.trim() || paymentForm.amount <= 0) return;
    
    try {
      const currentDebt = supplementDebt?.amount || 0;
      const newDebt: SupplementDebt = {
        amount: Math.max(0, currentDebt - Math.floor(paymentForm.amount)),
        lastUpdated: new Date(),
        updatedBy: user?.username || 'Unknown'
      };
      
      await db.saveSupplementDebt(newDebt);
      await logAdminAction('دفع دين المكملات', paymentForm.paidBy, `المبلغ: ${paymentForm.amount}`);
      
      setPaymentForm({ amount: 0, paidBy: '' });
      setShowAddPaymentForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding payment:', error);
    }
  };

  // Current shift operations
  const handleStartShift = async () => {
    if (currentShift) {
      alert('يوجد وردية نشطة بالفعل');
      return;
    }

    try {
      const newShift: Shift = {
        id: `shift-${section}-${Date.now()}`,
        userId: user?.id || '',
        username: user?.username || '',
        section,
        status: 'active',
        purchases: [],
        expenses: [],
        totalAmount: 0,
        startTime: new Date(),
        validationStatus: 'balanced'
      };

      await db.saveShift(newShift);
      await logAdminAction('بدء وردية', newShift.id, 'تم بدء وردية جديدة');
      loadData();
    } catch (error) {
      console.error('Error starting shift:', error);
    }
  };

  const handleAddPurchase = async () => {
    if (!currentShift || !purchaseForm.itemId || purchaseForm.quantity <= 0) return;

    try {
      const item = items.find(i => i.id === purchaseForm.itemId);
      if (!item) return;

      if (item.currentAmount < purchaseForm.quantity) {
        alert('الكمية المطلوبة غير متوفرة في المخزون');
        return;
      }

      const price = purchaseForm.customPrice > 0 ? Math.floor(purchaseForm.customPrice) : item.sellPrice;
      const purchase: PurchaseItem = {
        itemId: item.id,
        quantity: Math.floor(purchaseForm.quantity),
        price,
        name: item.name
      };

      const updatedShift = {
        ...currentShift,
        purchases: [...currentShift.purchases, purchase],
        totalAmount: currentShift.totalAmount + (price * purchase.quantity)
      };

      const updatedItem = {
        ...item,
        currentAmount: item.currentAmount - purchase.quantity,
        updatedAt: new Date()
      };

      await db.saveShift(updatedShift);
      await db.saveItem(updatedItem);

      setPurchaseForm({ itemId: '', quantity: 1, customPrice: 0 });
      loadData();
    } catch (error) {
      console.error('Error adding purchase:', error);
    }
  };

  const handleAddExpense = async () => {
    if (!currentShift || !expenseForm.reason.trim() || expenseForm.amount <= 0) return;

    try {
      const expense: Expense = {
        id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.floor(expenseForm.amount),
        reason: expenseForm.reason.trim(),
        shiftId: currentShift.id,
        section,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      const updatedShift = {
        ...currentShift,
        expenses: [...currentShift.expenses, expense],
        totalAmount: currentShift.totalAmount - expense.amount
      };

      await db.saveExpense(expense);
      await db.saveShift(updatedShift);

      setExpenseForm({ amount: 0, reason: '' });
      setShowAddExpenseForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const handleRemoveExpense = async (expense: Expense) => {
    if (!currentShift) return;

    if (confirm(`هل أنت متأكد من حذف المصروف: ${expense.reason}؟`)) {
      try {
        const updatedExpenses = currentShift.expenses.filter(e => e.id !== expense.id);
        const updatedShift = {
          ...currentShift,
          expenses: updatedExpenses,
          totalAmount: currentShift.totalAmount + expense.amount
        };

        await db.saveShift(updatedShift);
        loadData();
      } catch (error) {
        console.error('Error removing expense:', error);
      }
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;

    const finalCash = prompt('أدخل المبلغ النهائي في الصندوق:');
    if (finalCash === null) return;

    const finalCashAmount = Math.floor(Number(finalCash) || 0);
    const expectedCash = currentShift.totalAmount;
    const discrepancy = finalCashAmount - expectedCash;

    let closeReason = '';
    if (discrepancy !== 0) {
      closeReason = prompt(`يوجد فرق ${Math.abs(discrepancy)} جنيه. أدخل سبب الفرق:`) || '';
    }

    try {
      const closedShift = {
        ...currentShift,
        status: 'closed' as const,
        endTime: new Date(),
        finalCash: finalCashAmount,
        closeReason,
        validationStatus: discrepancy === 0 ? 'balanced' as const : 'discrepancy' as const,
        discrepancies: discrepancy !== 0 ? [`فرق في الصندوق: ${discrepancy} جنيه`] : []
      };

      await db.saveShift(closedShift);
      await logAdminAction('إغلاق وردية', closedShift.id, `المبلغ النهائي: ${finalCashAmount}, الفرق: ${discrepancy}`);
      loadData();
    } catch (error) {
      console.error('Error closing shift:', error);
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const todayShifts = shifts.filter(s => {
      const today = new Date().toDateString();
      return new Date(s.startTime).toDateString() === today;
    });

    const todayProfit = todayShifts.reduce((total, shift) => {
      return total + shift.purchases.reduce((shiftTotal, purchase) => {
        const item = items.find(i => i.id === purchase.itemId);
        const profit = item ? (purchase.price - item.costPrice) * purchase.quantity : 0;
        return shiftTotal + profit;
      }, 0);
    }, 0);

    const monthlyRevenue = shifts
      .filter(s => {
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const shiftDate = new Date(s.startTime);
        return shiftDate.getMonth() === thisMonth && shiftDate.getFullYear() === thisYear;
      })
      .reduce((total, shift) => total + shift.totalAmount, 0);

    const totalCustomers = customers.length;
    const pendingDebt = customerPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);

    return {
      todayProfit: Math.floor(todayProfit),
      monthlyRevenue: Math.floor(monthlyRevenue),
      totalCustomers,
      pendingDebt: Math.floor(pendingDebt),
      currentShiftCash: currentShift ? Math.floor(currentShift.totalAmount) : 0
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'current-shift', label: 'الوردية الحالية', icon: PlayCircle },
    { id: 'inventory', label: 'المخزون', icon: Package },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'shifts', label: 'تاريخ الورديات', icon: History },
    { id: 'profits', label: 'الأرباح', icon: TrendingUp },
    { id: 'users', label: 'المستخدمين', icon: User },
    { id: 'admin-log', label: 'سجل الإدارة', icon: FileText },
    ...(section === 'supplement' ? [{ id: 'debts', label: 'الديون', icon: CreditCard }] : [])
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            {section === 'store' ? <Store className="h-6 w-6 ml-2" /> : <Pill className="h-6 w-6 ml-2" />}
            لوحة تحكم {section === 'store' ? 'البار' : 'المكملات'}
          </h1>
          <div className="flex items-center space-x-4 space-x-reverse">
            <span className="text-sm text-gray-500">آخر تحديث: {new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div className="mr-3">
                <p className="text-sm font-medium text-blue-600">ربح اليوم</p>
                <p className="text-2xl font-bold text-blue-900">{stats.todayProfit} ج.م</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="mr-3">
                <p className="text-sm font-medium text-green-600">إيرادات الشهر</p>
                <p className="text-2xl font-bold text-green-900">{stats.monthlyRevenue} ج.م</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="mr-3">
                <p className="text-sm font-medium text-purple-600">إجمالي العملاء</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalCustomers}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Calculator className="h-8 w-8 text-orange-600" />
              <div className="mr-3">
                <p className="text-sm font-medium text-orange-600">
                  {currentShift ? 'صندوق الوردية' : 'ديون العملاء'}
                </p>
                <p className="text-2xl font-bold text-orange-900">
                  {currentShift ? stats.currentShiftCash : stats.pendingDebt} ج.م
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 space-x-reverse px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-4 w-4 ml-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Current Shift Tab */}
          {activeTab === 'current-shift' && (
            <div className="space-y-6">
              {currentShift ? (
                <>
                  {/* Shift Info */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-green-800">الوردية النشطة</h3>
                        <p className="text-green-600">
                          بدأت في: {new Date(currentShift.startTime).toLocaleString('ar-EG')}
                        </p>
                        <p className="text-green-600">المستخدم: {currentShift.username}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-bold text-green-800">{currentShift.totalAmount} ج.م</p>
                        <p className="text-sm text-green-600">إجمالي الصندوق</p>
                      </div>
                    </div>
                  </div>

                  {/* Add Purchase */}
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-lg font-semibold mb-4">إضافة عملية بيع</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <select
                        value={purchaseForm.itemId}
                        onChange={(e) => setPurchaseForm({...purchaseForm, itemId: e.target.value})}
                        className="border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">اختر الصنف</option>
                        {items.filter(item => item.currentAmount > 0).map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} (متوفر: {item.currentAmount})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="الكمية"
                        value={purchaseForm.quantity}
                        onChange={(e) => setPurchaseForm({...purchaseForm, quantity: Math.floor(Number(e.target.value))})}
                        className="border border-gray-300 rounded-md px-3 py-2"
                        min="1"
                      />
                      <input
                        type="number"
                        placeholder="سعر مخصص (اختياري)"
                        value={purchaseForm.customPrice}
                        onChange={(e) => setPurchaseForm({...purchaseForm, customPrice: Math.floor(Number(e.target.value))})}
                        className="border border-gray-300 rounded-md px-3 py-2"
                        min="0"
                      />
                      <button
                        onClick={handleAddPurchase}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  {/* Current Purchases */}
                  {currentShift.purchases.length > 0 && (
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="text-lg font-semibold mb-4">المبيعات الحالية</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الصنف</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الكمية</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السعر</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {currentShift.purchases.map((purchase, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.quantity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.price} ج.م</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{purchase.price * purchase.quantity} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Current Expenses */}
                  <div className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold">مصروفات الوردية</h4>
                      <button
                        onClick={() => setShowAddExpenseForm(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة مصروف
                      </button>
                    </div>

                    {currentShift.expenses.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السبب</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الوقت</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {currentShift.expenses.map((expense) => (
                              <tr key={expense.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{expense.amount} ج.م</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{expense.reason}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(expense.timestamp).toLocaleString('ar-EG')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <button
                                    onClick={() => handleRemoveExpense(expense)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">لا توجد مصروفات</p>
                    )}
                  </div>

                  {/* Close Shift */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleCloseShift}
                      className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 flex items-center"
                    >
                      <StopCircle className="h-4 w-4 ml-2" />
                      إغلاق الوردية
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <PlayCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">لا توجد وردية نشطة</h3>
                  <p className="text-gray-500 mb-6">ابدأ وردية جديدة لبدء العمل</p>
                  <button
                    onClick={handleStartShift}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 flex items-center mx-auto"
                  >
                    <PlayCircle className="h-5 w-5 ml-2" />
                    بدء وردية جديدة
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">إدارة المخزون</h2>
                <div className="flex space-x-2 space-x-reverse">
                  <button
                    onClick={() => setShowAddSupplyForm(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <Package className="h-4 w-4 ml-1" />
                    إضافة توريد
                  </button>
                  <button
                    onClick={() => setShowAddItemForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة صنف
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم الصنف</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سعر البيع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سعر التكلفة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الكمية الحالية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الربح لكل وحدة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingItem?.id === item.id ? (
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                              className="border border-gray-300 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingItem?.id === item.id ? (
                            <input
                              type="number"
                              value={editingItem.sellPrice}
                              onChange={(e) => setEditingItem({...editingItem, sellPrice: Math.floor(Number(e.target.value))})}
                              className="border border-gray-300 rounded px-2 py-1 w-20"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{item.sellPrice} ج.م</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingItem?.id === item.id ? (
                            <input
                              type="number"
                              value={editingItem.costPrice}
                              onChange={(e) => setEditingItem({...editingItem, costPrice: Math.floor(Number(e.target.value))})}
                              className="border border-gray-300 rounded px-2 py-1 w-20"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{item.costPrice} ج.م</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingItem?.id === item.id ? (
                            <input
                              type="number"
                              value={editingItem.currentAmount}
                              onChange={(e) => setEditingItem({...editingItem, currentAmount: Math.floor(Number(e.target.value))})}
                              className="border border-gray-300 rounded px-2 py-1 w-20"
                            />
                          ) : (
                            <span className={`text-sm ${item.currentAmount <= 5 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                              {item.currentAmount}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-green-600 font-semibold">
                            {item.sellPrice - item.costPrice} ج.م
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingItem?.id === item.id ? (
                            <div className="flex space-x-2 space-x-reverse">
                              <button
                                onClick={() => handleSaveItem(editingItem)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-2 space-x-reverse">
                              <button
                                onClick={() => setEditingItem(item)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">إدارة العملاء</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Items */}
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">أصناف اليوم</h3>
                  {customerPurchases.filter(p => {
                    const today = new Date().toDateString();
                    return new Date(p.timestamp).toDateString() === today;
                  }).length > 0 ? (
                    <div className="space-y-3">
                      {customerPurchases
                        .filter(p => {
                          const today = new Date().toDateString();
                          return new Date(p.timestamp).toDateString() === today;
                        })
                        .map(purchase => (
                          <div key={purchase.id} className="border rounded p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{purchase.customerName}</h4>
                                <p className="text-sm text-gray-600">
                                  {purchase.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(purchase.timestamp).toLocaleString('ar-EG')}
                                </p>
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-red-600">{purchase.totalAmount} ج.م</p>
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  غير مدفوع
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">لا توجد أصناف لليوم</p>
                  )}
                </div>

                {/* All-Time Items */}
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">جميع الأصناف</h3>
                  {customerPurchases.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {customerPurchases.map(purchase => (
                        <div key={purchase.id} className="border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{purchase.customerName}</h4>
                              <p className="text-sm text-gray-600">
                                {purchase.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(purchase.timestamp).toLocaleString('ar-EG')}
                              </p>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-red-600">{purchase.totalAmount} ج.م</p>
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                غير مدفوع
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">لا توجد أصناف</p>
                  )}
                </div>
              </div>

              {/* Customers List */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">قائمة العملاء</h3>
                {customers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم العميل</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإنشاء</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي الدين</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customers.map(customer => {
                          const customerDebt = customerPurchases
                            .filter(p => p.customerId === customer.id)
                            .reduce((total, p) => total + p.totalAmount, 0);
                          
                          return (
                            <tr key={customer.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {customer.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(customer.createdAt).toLocaleDateString('ar-EG')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                                {customerDebt} ج.م
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من حذف العميل "${customer.name}" وجميع بياناته؟`)) {
                                      // Delete customer and all associated purchases
                                      // This would need to be implemented
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">لا يوجد عملاء</p>
                )}
              </div>
            </div>
          )}

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">تاريخ الورديات</h2>
                <button
                  onClick={() => generateShiftsPDF(shifts, section)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Receipt className="h-4 w-4 ml-1" />
                  تصدير PDF
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم الوردية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ البداية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ النهاية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي الصندوق</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {shift.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(shift.startTime).toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.endTime ? new Date(shift.endTime).toLocaleString('ar-EG') : 'نشطة'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.totalAmount} ج.م
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            shift.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : shift.validationStatus === 'balanced'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {shift.status === 'active' ? 'نشطة' : 
                             shift.validationStatus === 'balanced' ? 'متوازنة' : 'بها فروق'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setShowShiftDetails(shift.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Profits Tab */}
          {activeTab === 'profits' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">تقارير الأرباح</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">ربح اليوم</h3>
                  <p className="text-3xl font-bold text-blue-900">{stats.todayProfit} ج.م</p>
                </div>
                
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">إيرادات الشهر</h3>
                  <p className="text-3xl font-bold text-green-900">{stats.monthlyRevenue} ج.م</p>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-800 mb-2">ديون العملاء</h3>
                  <p className="text-3xl font-bold text-purple-900">{stats.pendingDebt} ج.م</p>
                </div>
              </div>

              {/* Monthly Summary Button */}
              <div className="flex justify-center">
                <button
                  onClick={() => generateMonthlySummaryPDF(shifts, items, section, new Date().toISOString().slice(0, 7))}
                  className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 flex items-center"
                >
                  <BarChart3 className="h-5 w-5 ml-2" />
                  تصدير الملخص الشهري
                </button>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">إدارة المستخدمين</h2>
                <button
                  onClick={() => setShowAddUserForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة مستخدم
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">كلمة المرور</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الدور</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإنشاء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((userItem) => (
                      <tr key={userItem.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingUser?.id === userItem.id ? (
                            <input
                              type="text"
                              value={editingUser.username}
                              onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                              className="border border-gray-300 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{userItem.username}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingUser?.id === userItem.id ? (
                            <input
                              type="text"
                              value={editingUser.password}
                              onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                              className="border border-gray-300 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">••••••••</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingUser?.id === userItem.id ? (
                            <select
                              value={editingUser.role}
                              onChange={(e) => setEditingUser({...editingUser, role: e.target.value as 'normal' | 'admin'})}
                              className="border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="normal">مستخدم عادي</option>
                              <option value="admin">مدير</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              userItem.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(userItem.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingUser?.id === userItem.id ? (
                            <div className="flex space-x-2 space-x-reverse">
                              <button
                                onClick={() => handleSaveUser(editingUser)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-2 space-x-reverse">
                              <button
                                onClick={() => setEditingUser(userItem)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(userItem)}
                                className="text-red-600 hover:text-red-900"
                                disabled={userItem.id === user?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Log Tab */}
          {activeTab === 'admin-log' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">سجل الإدارة</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع الإجراء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الصنف/الوردية المتأثرة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تفاصيل التغيير</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الوقت</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم المدير</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {adminLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.actionType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.itemOrShiftAffected}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {log.changeDetails}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.adminName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Debts Tab (Supplement only) */}
          {activeTab === 'debts' && section === 'supplement' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">إدارة ديون المكملات</h2>
                <button
                  onClick={() => setShowAddPaymentForm(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  <DollarSign className="h-4 w-4 ml-1" />
                  إضافة دفعة
                </button>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">إجمالي الدين الحالي</h3>
                  <p className="text-4xl font-bold text-red-600">
                    {supplementDebt?.amount || 0} ج.م
                  </p>
                  {supplementDebt && (
                    <p className="text-sm text-gray-500 mt-2">
                      آخر تحديث: {new Date(supplementDebt.lastUpdated).toLocaleString('ar-EG')} 
                      بواسطة {supplementDebt.updatedBy}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">تاريخ المدفوعات والتوريدات</h3>
                <div className="space-y-3">
                  {/* This would show payment history - needs to be implemented */}
                  <p className="text-gray-500 text-center py-8">سيتم عرض تاريخ المدفوعات والتوريدات هنا</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      
      {/* Add Item Modal */}
      {showAddItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة صنف جديد</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="اسم الصنف"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="number"
                placeholder="سعر البيع"
                value={newItem.sellPrice}
                onChange={(e) => setNewItem({...newItem, sellPrice: Math.floor(Number(e.target.value))})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="number"
                placeholder="سعر التكلفة"
                value={newItem.costPrice}
                onChange={(e) => setNewItem({...newItem, costPrice: Math.floor(Number(e.target.value))})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="number"
                placeholder="الكمية الحالية"
                value={newItem.currentAmount}
                onChange={(e) => setNewItem({...newItem, currentAmount: Math.floor(Number(e.target.value))})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse mt-6">
              <button
                onClick={() => setShowAddItemForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supply Modal */}
      {showAddSupplyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">إضافة توريد</h3>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex items-center space-x-4 space-x-reverse">
                  <span className="flex-1 text-sm">{item.name}</span>
                  <input
                    type="number"
                    placeholder="الكمية"
                    value={supplyItems[item.id] || ''}
                    onChange={(e) => {
                      const quantity = Math.floor(Number(e.target.value)) || 0;
                      setSupplyItems({...supplyItems, [item.id]: quantity});
                    }}
                    className="w-24 border border-gray-300 rounded-md px-2 py-1"
                    min="0"
                  />
                </div>
              ))}
              <input
                type="number"
                placeholder="التكلفة الإجمالية"
                value={supplyTotalCost}
                onChange={(e) => setSupplyTotalCost(Math.floor(Number(e.target.value)))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse mt-6">
              <button
                onClick={() => {
                  setShowAddSupplyForm(false);
                  setSupplyItems({});
                  setSupplyTotalCost(0);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddSupply}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                إضافة التوريد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة مستخدم جديد</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="اسم المستخدم"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="password"
                placeholder="كلمة المرور"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value as 'normal' | 'admin'})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="normal">مستخدم عادي</option>
                <option value="admin">مدير</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse mt-6">
              <button
                onClick={() => setShowAddUserForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة دفعة</h3>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="المبلغ"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({...paymentForm, amount: Math.floor(Number(e.target.value))})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="text"
                placeholder="اسم الدافع"
                value={paymentForm.paidBy}
                onChange={(e) => setPaymentForm({...paymentForm, paidBy: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse mt-6">
              <button
                onClick={() => setShowAddPaymentForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddPayment}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                إضافة الدفعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة مصروف</h3>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="المبلغ"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({...expenseForm, amount: Math.floor(Number(e.target.value))})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="text"
                placeholder="السبب"
                value={expenseForm.reason}
                onChange={(e) => setExpenseForm({...expenseForm, reason: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse mt-6">
              <button
                onClick={() => setShowAddExpenseForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddExpense}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                إضافة المصروف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {(() => {
              const shift = shifts.find(s => s.id === showShiftDetails);
              if (!shift) return null;
              
              return (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">تفاصيل الوردية: {shift.id}</h3>
                    <button
                      onClick={() => setShowShiftDetails(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Shift Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold mb-3">ملخص الوردية</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p><strong>تاريخ البداية:</strong> {new Date(shift.startTime).toLocaleString('ar-EG')}</p>
                        <p><strong>تاريخ النهاية:</strong> {shift.endTime ? new Date(shift.endTime).toLocaleString('ar-EG') : 'نشطة'}</p>
                        <p><strong>المستخدم الذي فتح:</strong> {shift.username}</p>
                      </div>
                      <div>
                        <p><strong>إجمالي الصندوق:</strong> {shift.totalAmount} ج.م</p>
                        <p><strong>عدد الأصناف المباعة:</strong> {shift.purchases.reduce((total, p) => total + p.quantity, 0)}</p>
                        <p><strong>حالة التوازن:</strong> {shift.validationStatus === 'balanced' ? 'متوازنة' : 'بها فروق'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Purchases */}
                  {shift.purchases.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3">المبيعات</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الصنف</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الكمية</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">السعر</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {shift.purchases.map((purchase, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm">{purchase.name}</td>
                                <td className="px-4 py-2 text-sm">{purchase.quantity}</td>
                                <td className="px-4 py-2 text-sm">{purchase.price} ج.م</td>
                                <td className="px-4 py-2 text-sm">{purchase.price * purchase.quantity} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Expenses */}
                  {shift.expenses.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3">المصروفات</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">المبلغ</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">السبب</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الوقت</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {shift.expenses.map((expense) => (
                              <tr key={expense.id}>
                                <td className="px-4 py-2 text-sm">{expense.amount} ج.م</td>
                                <td className="px-4 py-2 text-sm">{expense.reason}</td>
                                <td className="px-4 py-2 text-sm">{new Date(expense.timestamp).toLocaleString('ar-EG')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Discrepancies */}
                  {shift.discrepancies && shift.discrepancies.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3 text-red-600">الفروقات</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        {shift.discrepancies.map((discrepancy, index) => (
                          <p key={index} className="text-red-700">• {discrepancy}</p>
                        ))}
                        {shift.closeReason && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-red-700"><strong>ملاحظة الإغلاق:</strong> {shift.closeReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;