import React, { useState, useEffect } from 'react';
import { 
  Package, Users, FileText, BarChart3, Plus, Edit, Trash2, 
  Search, Filter, Download, Eye, X, Save, AlertTriangle,
  DollarSign, TrendingUp, ShoppingCart, Clock, User,
  Calendar, CheckCircle, XCircle, RefreshCw, Upload, Image
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { 
  Item, User as UserType, AdminLog, Shift, Customer, 
  CustomerPurchase, Supply, SupplementDebt, PurchaseItem, Expense 
} from '../types';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

const AdminView: React.FC<{ section: 'store' | 'supplement' }> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  // Form states
  const [newItem, setNewItem] = useState({
    name: '',
    sellPrice: 0,
    costPrice: 0,
    currentAmount: 0,
    image: ''
  });
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });
  const [newCustomer, setNewCustomer] = useState({ name: '' });
  const [supplyItems, setSupplyItems] = useState<Record<string, number>>({});
  const [newPurchase, setNewPurchase] = useState({
    itemId: '',
    quantity: 1,
    price: 0
  });
  const [newExpense, setNewExpense] = useState({
    amount: 0,
    reason: ''
  });
  const [manualCash, setManualCash] = useState(0);
  const [debtPayment, setDebtPayment] = useState(0);

  // Auto-refresh data every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 2000);

    return () => clearInterval(interval);
  }, [section]);

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [
        itemsData,
        usersData,
        logsData,
        shiftsData,
        customersData,
        purchasesData,
        activeShift,
        debtData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getAllUsers(),
        db_service.getAllAdminLogs(),
        db_service.getShiftsBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getUnpaidCustomerPurchases(section),
        db_service.getActiveShift(section),
        section === 'supplement' ? db_service.getSupplementDebt() : Promise.resolve(null)
      ]);

      setItems(itemsData);
      setUsers(usersData);
      setAdminLogs(logsData.filter(log => !log.section || log.section === section));
      setShifts(shiftsData);
      setCustomers(customersData);
      setCustomerPurchases(purchasesData);
      setCurrentShift(activeShift);
      setSupplementDebt(debtData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const logAdminAction = async (actionType: string, itemOrShiftAffected: string, changeDetails: string) => {
    const log: AdminLog = {
      id: `log-${Date.now()}`,
      actionType,
      itemOrShiftAffected,
      changeDetails,
      timestamp: new Date(),
      adminName: user?.username || 'مجهول',
      section
    };
    await db_service.saveAdminLog(log);
  };

  // Image handling functions
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, isEditing: boolean = false) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        if (isEditing && editingItem) {
          setEditingItem({ ...editingItem, image: imageData });
        } else {
          setNewItem({ ...newItem, image: imageData });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (isEditing: boolean = false) => {
    if (isEditing && editingItem) {
      setEditingItem({ ...editingItem, image: '' });
    } else {
      setNewItem({ ...newItem, image: '' });
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) return;

    const item: Item = {
      id: `${section}-${Date.now()}`,
      name: newItem.name,
      sellPrice: Math.round(newItem.sellPrice),
      costPrice: Math.round(newItem.costPrice),
      currentAmount: Math.round(newItem.currentAmount),
      image: newItem.image,
      section,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db_service.saveItem(item);
    await logAdminAction('إضافة صنف', newItem.name, `تم إضافة صنف جديد: ${newItem.name}`);
    
    setNewItem({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, image: '' });
    setShowAddItem(false);
    loadData();
  };

  const handleEditItem = async () => {
    if (!editingItem) return;

    const updatedItem = {
      ...editingItem,
      sellPrice: Math.round(editingItem.sellPrice),
      costPrice: Math.round(editingItem.costPrice),
      currentAmount: Math.round(editingItem.currentAmount),
      updatedAt: new Date()
    };

    await db_service.saveItem(updatedItem);
    await logAdminAction('تعديل صنف', editingItem.name, `تم تعديل الصنف: ${editingItem.name}`);
    
    setEditingItem(null);
    loadData();
  };

  const handleDeleteItem = async (item: Item) => {
    if (window.confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) {
      await db_service.deleteItem(item.id);
      await logAdminAction('حذف صنف', item.name, `تم حذف الصنف: ${item.name}`);
      loadData();
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) return;

    const userObj: UserType = {
      id: `user-${Date.now()}`,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
      createdAt: new Date()
    };

    await db_service.createUser(userObj);
    await logAdminAction('إضافة مستخدم', newUser.username, `تم إضافة مستخدم جديد: ${newUser.username}`);
    
    setNewUser({ username: '', password: '', role: 'normal' });
    setShowAddUser(false);
    loadData();
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    await db_service.updateUser(editingUser);
    await logAdminAction('تعديل مستخدم', editingUser.username, `تم تعديل المستخدم: ${editingUser.username}`);
    
    setEditingUser(null);
    loadData();
  };

  const handleDeleteUser = async (userToDelete: UserType) => {
    if (userToDelete.id === user?.id) {
      alert('لا يمكنك حذف حسابك الخاص');
      return;
    }
    
    if (window.confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) {
      await db_service.deleteUser(userToDelete.id);
      await logAdminAction('حذف مستخدم', userToDelete.username, `تم حذف المستخدم: ${userToDelete.username}`);
      loadData();
    }
  };

  const handleAddSupply = async () => {
    const totalCost = Object.entries(supplyItems).reduce((total, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId);
      return total + (item ? item.costPrice * quantity : 0);
    }, 0);

    const supply: Supply = {
      id: `supply-${Date.now()}`,
      section,
      items: supplyItems,
      totalCost: Math.round(totalCost),
      timestamp: new Date(),
      createdBy: user?.username || 'مجهول'
    };

    await db_service.saveSupply(supply);

    // Update item quantities
    for (const [itemId, quantity] of Object.entries(supplyItems)) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        const updatedItem = {
          ...item,
          currentAmount: item.currentAmount + quantity,
          updatedAt: new Date()
        };
        await db_service.saveItem(updatedItem);
      }
    }

    await logAdminAction('إضافة مخزون', 'متعدد', `تم إضافة مخزون بقيمة ${totalCost} جنيه`);
    
    setSupplyItems({});
    setShowAddSupply(false);
    loadData();
  };

  const handleStartShift = async () => {
    if (currentShift) {
      alert('يوجد وردية نشطة بالفعل');
      return;
    }

    const shift: Shift = {
      id: `shift-${Date.now()}`,
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

    await db_service.saveShift(shift);
    await logAdminAction('بدء وردية', shift.id, `تم بدء وردية جديدة`);
    loadData();
  };

  const handleAddPurchase = async () => {
    if (!currentShift || !newPurchase.itemId) return;

    const item = items.find(i => i.id === newPurchase.itemId);
    if (!item || item.currentAmount < newPurchase.quantity) {
      alert('الكمية المطلوبة غير متوفرة');
      return;
    }

    const purchase: PurchaseItem = {
      itemId: newPurchase.itemId,
      quantity: newPurchase.quantity,
      price: Math.round(newPurchase.price),
      name: item.name
    };

    const updatedShift = {
      ...currentShift,
      purchases: [...currentShift.purchases, purchase],
      totalAmount: currentShift.totalAmount + (purchase.price * purchase.quantity)
    };

    const updatedItem = {
      ...item,
      currentAmount: item.currentAmount - newPurchase.quantity,
      updatedAt: new Date()
    };

    await db_service.saveShift(updatedShift);
    await db_service.saveItem(updatedItem);
    
    setNewPurchase({ itemId: '', quantity: 1, price: 0 });
    loadData();
  };

  const handleAddExpense = async () => {
    if (!currentShift || newExpense.amount <= 0) return;

    const expense: Expense = {
      id: `expense-${Date.now()}`,
      amount: Math.round(newExpense.amount),
      reason: newExpense.reason,
      shiftId: currentShift.id,
      section,
      timestamp: new Date(),
      createdBy: user?.username || 'مجهول'
    };

    const updatedShift = {
      ...currentShift,
      expenses: [...currentShift.expenses, expense],
      totalAmount: currentShift.totalAmount - expense.amount
    };

    await db_service.saveShift(updatedShift);
    await db_service.saveExpense(expense);
    
    setNewExpense({ amount: 0, reason: '' });
    loadData();
  };

  const handleRemoveExpense = async (expenseId: string) => {
    if (!currentShift) return;

    const expense = currentShift.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const updatedShift = {
      ...currentShift,
      expenses: currentShift.expenses.filter(e => e.id !== expenseId),
      totalAmount: currentShift.totalAmount + expense.amount
    };

    await db_service.saveShift(updatedShift);
    loadData();
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;

    const expectedCash = currentShift.totalAmount;
    const actualCash = Math.round(manualCash);
    const difference = actualCash - expectedCash;

    const updatedShift = {
      ...currentShift,
      status: 'closed' as const,
      endTime: new Date(),
      finalCash: actualCash,
      validationStatus: difference === 0 ? 'balanced' as const : 'discrepancy' as const,
      discrepancies: difference !== 0 ? [`فرق في النقدية: ${difference} جنيه`] : []
    };

    await db_service.saveShift(updatedShift);
    await logAdminAction('إغلاق وردية', currentShift.id, `تم إغلاق الوردية - النقدية المتوقعة: ${expectedCash}، الفعلية: ${actualCash}`);
    
    setManualCash(0);
    loadData();
  };

  const handleAddDebtPayment = async () => {
    if (debtPayment <= 0) return;

    const currentDebt = supplementDebt?.amount || 0;
    const newDebt = Math.max(0, currentDebt - Math.round(debtPayment));

    const updatedDebt: SupplementDebt = {
      amount: newDebt,
      lastUpdated: new Date(),
      updatedBy: user?.username || 'مجهول'
    };

    await db_service.saveSupplementDebt(updatedDebt);
    await logAdminAction('دفع دين المكملات', 'دين المكملات', `تم دفع ${debtPayment} جنيه - الدين المتبقي: ${newDebt} جنيه`);
    
    setDebtPayment(0);
    loadData();
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) return;

    const customer: Customer = {
      id: `customer-${Date.now()}`,
      name: newCustomer.name,
      section,
      createdAt: new Date()
    };

    await db_service.saveCustomer(customer);
    await logAdminAction('إضافة عميل', newCustomer.name, `تم إضافة عميل جديد: ${newCustomer.name}`);
    
    setNewCustomer({ name: '' });
    setShowAddCustomer(false);
    loadData();
  };

  // Statistics calculations
  const todayProfit = shifts
    .filter(s => {
      const today = new Date().toDateString();
      return new Date(s.startTime).toDateString() === today;
    })
    .reduce((total, shift) => {
      return total + shift.purchases.reduce((shiftTotal, purchase) => {
        const item = items.find(i => i.id === purchase.itemId);
        const cost = item ? item.costPrice * purchase.quantity : 0;
        const revenue = purchase.price * purchase.quantity;
        return shiftTotal + (revenue - cost);
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

  const lowStockItems = items.filter(item => item.currentAmount < 10);
  const totalCustomerDebt = customerPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredShifts = shifts.filter(shift =>
    shift.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shift.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex flex-wrap gap-1 p-1">
          {[
            { id: 'dashboard', label: 'لوحة التحكم', icon: BarChart3 },
            { id: 'inventory', label: 'المخزون', icon: Package },
            { id: 'current-shift', label: 'الوردية الحالية', icon: Clock },
            { id: 'shifts', label: 'الورديات', icon: Calendar },
            { id: 'customers', label: 'العملاء', icon: Users },
            { id: 'users', label: 'المستخدمين', icon: User },
            { id: 'admin-logs', label: 'سجل الإدارة', icon: FileText },
            ...(section === 'supplement' ? [{ id: 'debts', label: 'الديون', icon: DollarSign }] : [])
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 space-x-reverse px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">ربح اليوم</p>
                  <p className="text-2xl font-bold text-gray-900">{todayProfit} ج.م</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">إيرادات الشهر</p>
                  <p className="text-2xl font-bold text-gray-900">{monthlyRevenue} ج.م</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">مخزون منخفض</p>
                  <p className="text-2xl font-bold text-gray-900">{lowStockItems.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <div className="mr-4">
                  <p className="text-sm font-medium text-gray-600">ديون العملاء</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCustomerDebt} ج.م</p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Shift Status */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">حالة الوردية الحالية</h3>
            {currentShift ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">الوردية: {currentShift.id}</p>
                    <p className="text-sm text-gray-600">المستخدم: {currentShift.username}</p>
                    <p className="text-sm text-gray-600">بدأت في: {new Date(currentShift.startTime).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-green-600">{currentShift.totalAmount} ج.م</p>
                    <p className="text-sm text-gray-600">إجمالي النقدية</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">المبيعات</p>
                    <p className="text-lg font-semibold">{currentShift.purchases.length} عملية</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">المصروفات</p>
                    <p className="text-lg font-semibold">{currentShift.expenses.reduce((total, e) => total + e.amount, 0)} ج.م</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد وردية نشطة حالياً</p>
              </div>
            )}
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 ml-2" />
                <h3 className="text-sm font-medium text-yellow-800">تنبيه: مخزون منخفض</h3>
              </div>
              <div className="mt-2">
                <p className="text-sm text-yellow-700">
                  الأصناف التالية تحتاج إلى إعادة تموين:
                </p>
                <ul className="mt-1 text-sm text-yellow-700">
                  {lowStockItems.slice(0, 5).map(item => (
                    <li key={item.id}>• {item.name} ({item.currentAmount} متبقي)</li>
                  ))}
                  {lowStockItems.length > 5 && (
                    <li>• و {lowStockItems.length - 5} أصناف أخرى...</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">إدارة المخزون</h2>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => setShowAddSupply(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة مخزون</span>
              </button>
              <button
                onClick={() => setShowAddItem(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة صنف</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="flex items-center space-x-4 space-x-reverse">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="البحث في الأصناف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الصورة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم الصنف</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر البيع</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر التكلفة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الكمية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="h-12 w-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.sellPrice} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.costPrice} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.currentAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.currentAmount > 10
                            ? 'bg-green-100 text-green-800'
                            : item.currentAmount > 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.currentAmount > 10 ? 'متوفر' : item.currentAmount > 0 ? 'منخفض' : 'نفد'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Current Shift Tab */}
      {activeTab === 'current-shift' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">الوردية الحالية</h2>
            {!currentShift && (
              <button
                onClick={handleStartShift}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse"
              >
                <Plus className="h-4 w-4" />
                <span>بدء وردية جديدة</span>
              </button>
            )}
          </div>

          {currentShift ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shift Info */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">معلومات الوردية</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">رقم الوردية:</span>
                    <span className="font-medium">{currentShift.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="font-medium">{currentShift.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">وقت البداية:</span>
                    <span className="font-medium">{new Date(currentShift.startTime).toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي النقدية:</span>
                    <span className="font-bold text-green-600">{currentShift.totalAmount} ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">عدد المبيعات:</span>
                    <span className="font-medium">{currentShift.purchases.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي المصروفات:</span>
                    <span className="font-medium text-red-600">
                      {currentShift.expenses.reduce((total, e) => total + e.amount, 0)} ج.م
                    </span>
                  </div>
                </div>

                {/* Close Shift */}
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium text-gray-900 mb-3">إغلاق الوردية</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        النقدية الفعلية في الخزنة
                      </label>
                      <input
                        type="number"
                        value={manualCash}
                        onChange={(e) => setManualCash(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="أدخل المبلغ الفعلي"
                      />
                    </div>
                    <button
                      onClick={handleCloseShift}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                    >
                      إغلاق الوردية
                    </button>
                  </div>
                </div>
              </div>

              {/* Add Purchase/Expense */}
              <div className="space-y-6">
                {/* Add Purchase */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">إضافة مبيعة</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الصنف</label>
                      <select
                        value={newPurchase.itemId}
                        onChange={(e) => {
                          const item = items.find(i => i.id === e.target.value);
                          setNewPurchase({
                            ...newPurchase,
                            itemId: e.target.value,
                            price: item?.sellPrice || 0
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">اختر صنف</option>
                        {items.filter(item => item.currentAmount > 0).map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} (متوفر: {item.currentAmount})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                        <input
                          type="number"
                          min="1"
                          value={newPurchase.quantity}
                          onChange={(e) => setNewPurchase({...newPurchase, quantity: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">السعر</label>
                        <input
                          type="number"
                          value={newPurchase.price}
                          onChange={(e) => setNewPurchase({...newPurchase, price: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddPurchase}
                      disabled={!newPurchase.itemId}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                    >
                      إضافة مبيعة
                    </button>
                  </div>
                </div>

                {/* Add Expense */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">إضافة مصروف</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                      <input
                        type="number"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="أدخل المبلغ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                      <input
                        type="text"
                        value={newExpense.reason}
                        onChange={(e) => setNewExpense({...newExpense, reason: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="سبب المصروف"
                      />
                    </div>
                    <button
                      onClick={handleAddExpense}
                      disabled={newExpense.amount <= 0}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                    >
                      إضافة مصروف
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Purchases */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">المبيعات الأخيرة</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {currentShift.purchases.slice(-10).reverse().map((purchase, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <span className="font-medium">{purchase.name}</span>
                        <span className="text-gray-600 text-sm mr-2">x{purchase.quantity}</span>
                      </div>
                      <span className="font-medium text-green-600">{purchase.price * purchase.quantity} ج.م</span>
                    </div>
                  ))}
                  {currentShift.purchases.length === 0 && (
                    <p className="text-gray-500 text-center py-4">لا توجد مبيعات بعد</p>
                  )}
                </div>
              </div>

              {/* Recent Expenses */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">المصروفات الأخيرة</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {currentShift.expenses.slice(-10).reverse().map((expense) => (
                    <div key={expense.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <span className="font-medium">{expense.reason}</span>
                        <span className="text-gray-600 text-sm block">{new Date(expense.timestamp).toLocaleString('ar-EG')}</span>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <span className="font-medium text-red-600">{expense.amount} ج.م</span>
                        <button
                          onClick={() => handleRemoveExpense(expense.id)}
                          className="text-red-600 hover:text-red-800"
                          title="إلغاء المصروف"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {currentShift.expenses.length === 0 && (
                    <p className="text-gray-500 text-center py-4">لا توجد مصروفات بعد</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg shadow-sm border text-center">
              <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد وردية نشطة</h3>
              <p className="text-gray-600 mb-6">ابدأ وردية جديدة لتتمكن من إدارة المبيعات والمصروفات</p>
              <button
                onClick={handleStartShift}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 space-x-reverse mx-auto"
              >
                <Plus className="h-5 w-5" />
                <span>بدء وردية جديدة</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">سجل الورديات</h2>
            <button
              onClick={() => generateShiftsPDF(shifts, section)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse"
            >
              <Download className="h-4 w-4" />
              <span>تصدير PDF</span>
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="البحث في الورديات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم الوردية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">بداية الوردية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نهاية الوردية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجمالي النقدية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {shift.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(shift.startTime).toLocaleString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.endTime ? new Date(shift.endTime).toLocaleString('ar-EG') : 'نشطة'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.totalAmount} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          shift.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : shift.validationStatus === 'balanced'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {shift.status === 'active' ? 'نشطة' : 
                           shift.validationStatus === 'balanced' ? 'متوازنة' : 'بها اختلاف'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedShift(shift);
                            setShowShiftDetails(true);
                          }}
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
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">إدارة العملاء</h2>
            <button
              onClick={() => setShowAddCustomer(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة عميل</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customers List */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">قائمة العملاء</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {customers.map(customer => (
                    <div key={customer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-600">
                          تاريخ الإضافة: {new Date(customer.createdAt).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <p className="text-gray-500 text-center py-8">لا يوجد عملاء مسجلين</p>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Debts */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">ديون العملاء</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {customerPurchases.map(purchase => (
                    <div key={purchase.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{purchase.customerName}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(purchase.timestamp).toLocaleDateString('ar-EG')}
                          </p>
                          <p className="text-sm text-gray-600">
                            الأصناف: {purchase.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-red-600">{purchase.totalAmount} ج.م</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customerPurchases.length === 0 && (
                    <p className="text-gray-500 text-center py-8">لا توجد ديون للعملاء</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">إدارة المستخدمين</h2>
            <button
              onClick={() => setShowAddUser(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة مستخدم</span>
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="البحث في المستخدمين..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم المستخدم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الدور</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((userItem) => (
                    <tr key={userItem.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{userItem.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userItem.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(userItem.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2 space-x-reverse">
                          <button
                            onClick={() => setEditingUser(userItem)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {userItem.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(userItem)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Logs Tab */}
      {activeTab === 'admin-logs' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">سجل الإدارة</h2>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RefreshCw 
                className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" 
                onClick={loadData}
              />
              <span className="text-sm text-gray-500">تحديث تلقائي</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نوع الإجراء</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الصنف/الوردية المتأثرة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تفاصيل التغيير</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوقت</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم المدير</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {adminLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.itemOrShiftAffected}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {log.changeDetails}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
        </div>
      )}

      {/* Debts Tab (Supplements only) */}
      {activeTab === 'debts' && section === 'supplement' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">إدارة الديون</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Debt */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">دين المكملات الحالي</h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">
                  {supplementDebt?.amount || 0} ج.م
                </div>
                <p className="text-gray-600 mb-4">
                  آخر تحديث: {supplementDebt?.lastUpdated ? 
                    new Date(supplementDebt.lastUpdated).toLocaleString('ar-EG') : 
                    'لم يتم التحديث بعد'
                  }
                </p>
                <p className="text-sm text-gray-500">
                  بواسطة: {supplementDebt?.updatedBy || 'غير محدد'}
                </p>
              </div>
            </div>

            {/* Add Payment */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">إضافة دفعة</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    مبلغ الدفعة
                  </label>
                  <input
                    type="number"
                    value={debtPayment}
                    onChange={(e) => setDebtPayment(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أدخل مبلغ الدفعة"
                  />
                </div>
                <button
                  onClick={handleAddDebtPayment}
                  disabled={debtPayment <= 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                >
                  إضافة دفعة
                </button>
              </div>
            </div>
          </div>

          {/* Payment History Placeholder */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">سجل المدفوعات</h3>
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">سيتم إضافة سجل المدفوعات قريباً</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إضافة صنف جديد</h3>
              <button
                onClick={() => setShowAddItem(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل اسم الصنف"
                />
              </div>
              
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">صورة الصنف</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {newItem.image && (
                    <div className="relative">
                      <img 
                        src={newItem.image} 
                        alt="معاينة الصورة"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage()}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                  <input
                    type="number"
                    value={newItem.sellPrice}
                    onChange={(e) => setNewItem({...newItem, sellPrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
                  <input
                    type="number"
                    value={newItem.costPrice}
                    onChange={(e) => setNewItem({...newItem, costPrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الأولية</label>
                <input
                  type="number"
                  value={newItem.currentAmount}
                  onChange={(e) => setNewItem({...newItem, currentAmount: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={handleAddItem}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  إضافة
                </button>
                <button
                  onClick={() => setShowAddItem(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">تعديل الصنف</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Image Upload for Edit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">صورة الصنف</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {editingItem.image && (
                    <div className="relative">
                      <img 
                        src={editingItem.image} 
                        alt="معاينة الصورة"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(true)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                  <input
                    type="number"
                    value={editingItem.sellPrice}
                    onChange={(e) => setEditingItem({...editingItem, sellPrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
                  <input
                    type="number"
                    value={editingItem.costPrice}
                    onChange={(e) => setEditingItem({...editingItem, costPrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الحالية</label>
                <input
                  type="number"
                  value={editingItem.currentAmount}
                  onChange={(e) => setEditingItem({...editingItem, currentAmount: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={handleEditItem}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  حفظ التغييرات
                </button>
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إضافة مستخدم جديد</h3>
              <button
                onClick={() => setShowAddUser(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل اسم المستخدم"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as 'normal' | 'admin'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">مستخدم عادي</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={handleAddUser}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  إضافة
                </button>
                <button
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">تعديل المستخدم</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="اتركها فارغة للاحتفاظ بكلمة المرور الحالية"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as 'normal' | 'admin'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">مستخدم عادي</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={handleEditUser}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  حفظ التغييرات
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supply Modal */}
      {showAddSupply && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إضافة مخزون</h3>
              <button
                onClick={() => setShowAddSupply(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">اختر الأصناف والكميات المراد إضافتها للمخزون:</p>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3 space-x-reverse">
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="h-10 w-10 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">متوفر حالياً: {item.currentAmount}</p>
                        <p className="text-sm text-gray-600">سعر التكلفة: {item.costPrice} ج.م</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="number"
                        min="0"
                        value={supplyItems[item.id] || 0}
                        onChange={(e) => setSupplyItems({
                          ...supplyItems,
                          [item.id]: Number(e.target.value)
                        })}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600">قطعة</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium text-gray-900">إجمالي التكلفة:</span>
                  <span className="font-bold text-blue-600">
                    {Object.entries(supplyItems).reduce((total, [itemId, quantity]) => {
                      const item = items.find(i => i.id === itemId);
                      return total + (item ? item.costPrice * quantity : 0);
                    }, 0)} ج.م
                  </span>
                </div>
                
                <div className="flex space-x-3 space-x-reverse">
                  <button
                    onClick={handleAddSupply}
                    disabled={Object.values(supplyItems).every(qty => qty === 0)}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                  >
                    إضافة المخزون
                  </button>
                  <button
                    onClick={() => setShowAddSupply(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إضافة عميل جديد</h3>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="أدخل اسم العميل"
                />
              </div>
              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={handleAddCustomer}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  إضافة
                </button>
                <button
                  onClick={() => setShowAddCustomer(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetails && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">تفاصيل الوردية {selectedShift.id}</h3>
              <button
                onClick={() => setShowShiftDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shift Info */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">معلومات الوردية</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">المستخدم:</span>
                      <span>{selectedShift.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">بداية الوردية:</span>
                      <span>{new Date(selectedShift.startTime).toLocaleString('ar-EG')}</span>
                    </div>
                    {selectedShift.endTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">نهاية الوردية:</span>
                        <span>{new Date(selectedShift.endTime).toLocaleString('ar-EG')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">إجمالي النقدية:</span>
                      <span className="font-bold text-green-600">{selectedShift.totalAmount} ج.م</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">الحالة:</span>
                      <span className={`font-medium ${
                        selectedShift.status === 'active' ? 'text-green-600' : 
                        selectedShift.validationStatus === 'balanced' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {selectedShift.status === 'active' ? 'نشطة' : 
                         selectedShift.validationStatus === 'balanced' ? 'متوازنة' : 'بها اختلاف'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discrepancies */}
                {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h4 className="font-medium text-red-900 mb-2">الاختلافات</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {selectedShift.discrepancies.map((discrepancy, index) => (
                        <li key={index}>• {discrepancy}</li>
                      ))}
                    </ul>
                    {selectedShift.closeReason && (
                      <div className="mt-2 pt-2 border-t border-red-200">
                        <p className="text-sm text-red-700">
                          <strong>ملاحظة الإغلاق:</strong> {selectedShift.closeReason}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Purchases and Expenses */}
              <div className="space-y-4">
                {/* Purchases */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">المبيعات ({selectedShift.purchases.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedShift.purchases.map((purchase, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium">{purchase.name}</span>
                          <span className="text-gray-600 mr-2">x{purchase.quantity}</span>
                        </div>
                        <span className="font-medium text-green-600">
                          {purchase.price * purchase.quantity} ج.م
                        </span>
                      </div>
                    ))}
                    {selectedShift.purchases.length === 0 && (
                      <p className="text-gray-500 text-center py-4">لا توجد مبيعات</p>
                    )}
                  </div>
                </div>

                {/* Expenses */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">
                    المصروفات ({selectedShift.expenses.length}) - 
                    إجمالي: {selectedShift.expenses.reduce((total, e) => total + e.amount, 0)} ج.م
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedShift.expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium">{expense.reason}</span>
                          <div className="text-gray-600">
                            {new Date(expense.timestamp).toLocaleString('ar-EG')}
                          </div>
                        </div>
                        <span className="font-medium text-red-600">{expense.amount} ج.م</span>
                      </div>
                    ))}
                    {selectedShift.expenses.length === 0 && (
                      <p className="text-gray-500 text-center py-4">لا توجد مصروفات</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;