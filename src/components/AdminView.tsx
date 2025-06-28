import React, { useState, useEffect } from 'react';
import { 
  Users, Package, TrendingUp, DollarSign, FileText, Settings, 
  Plus, Edit, Trash2, Eye, Download, AlertTriangle, CheckCircle,
  Calendar, BarChart3, PieChart, Activity, Clock, CreditCard,
  ExternalLink, History, Calculator, Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';
import { 
  Item, Shift, Supply, Category, Customer, CustomerPurchase, 
  Expense, AdminLog, User, SupplementDebt 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'shifts' | 'customers' | 'supplies' | 'users' | 'logs' | 'debt'>('dashboard');
  
  // Data states
  const [items, setItems] = useState<Item[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    image: '',
    categoryId: ''
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: ''
  });
  
  const [supplyForm, setSupplyForm] = useState({
    items: {} as Record<string, number>,
    totalCost: ''
  });
  
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });
  
  const [debtForm, setDebtForm] = useState({
    amount: '',
    type: 'payment' as 'payment' | 'debt',
    note: ''
  });

  // Real-time updates
  useRealtime((event) => {
    if (event.data?.table === 'items' || event.type === 'ITEM_UPDATED') {
      loadItems();
    }
    if (event.data?.table === 'shifts' || event.type === 'SHIFT_UPDATED') {
      loadShifts();
    }
    if (event.data?.table === 'customers' || event.type === 'CUSTOMER_UPDATED') {
      loadCustomers();
      loadUnpaidPurchases();
    }
    if (event.data?.table === 'supplies' || event.type === 'SUPPLY_ADDED') {
      loadSupplies();
    }
    if (event.data?.table === 'categories') {
      loadCategories();
    }
    if (event.data?.table === 'users') {
      loadUsers();
    }
    if (event.data?.table === 'admin_logs') {
      loadAdminLogs();
    }
  }, [section]);

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadItems(),
        loadShifts(),
        loadCustomers(),
        loadSupplies(),
        loadCategories(),
        loadUsers(),
        loadAdminLogs(),
        loadUnpaidPurchases(),
        section === 'supplement' ? loadSupplementDebt() : Promise.resolve()
      ]);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('فشل في تحميل البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const data = await db_service.getItemsBySection(section);
      setItems(data);
    } catch (err) {
      console.error('Error loading items:', err);
    }
  };

  const loadShifts = async () => {
    try {
      const data = await db_service.getShiftsBySection(section);
      setShifts(data);
    } catch (err) {
      console.error('Error loading shifts:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await db_service.getCustomersBySection(section);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadSupplies = async () => {
    try {
      const data = await db_service.getSuppliesBySection(section);
      setSupplies(data);
    } catch (err) {
      console.error('Error loading supplies:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await db_service.getCategoriesBySection(section);
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await db_service.getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadAdminLogs = async () => {
    try {
      const data = await db_service.getAllAdminLogs();
      setAdminLogs(data.filter(log => !log.section || log.section === section));
    } catch (err) {
      console.error('Error loading admin logs:', err);
    }
  };

  const loadUnpaidPurchases = async () => {
    try {
      const data = await db_service.getUnpaidCustomerPurchases(section);
      setUnpaidPurchases(data);
    } catch (err) {
      console.error('Error loading unpaid purchases:', err);
    }
  };

  const loadSupplementDebt = async () => {
    try {
      const data = await db_service.getSupplementDebt();
      setSupplementDebt(data);
    } catch (err) {
      console.error('Error loading supplement debt:', err);
    }
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.sellPrice || !itemForm.costPrice) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const item: Item = {
        id: editingItem?.id || uuidv4(),
        name: itemForm.name,
        sellPrice: parseFloat(itemForm.sellPrice),
        costPrice: parseFloat(itemForm.costPrice),
        currentAmount: parseInt(itemForm.currentAmount) || 0,
        image: itemForm.image || undefined,
        categoryId: itemForm.categoryId || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db_service.saveItem(item);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingItem ? 'تعديل منتج' : 'إضافة منتج',
        itemOrShiftAffected: item.name,
        changeDetails: editingItem ? 
          `تم تعديل المنتج: ${item.name}` : 
          `تم إضافة منتج جديد: ${item.name}`,
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section
      };
      await db_service.saveAdminLog(log);

      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({ name: '', sellPrice: '', costPrice: '', currentAmount: '', image: '', categoryId: '' });
      loadItems();
      loadAdminLogs();
    } catch (err) {
      console.error('Error saving item:', err);
      alert('فشل في حفظ المنتج');
    }
  };

  const deleteItem = async (item: Item) => {
    if (!confirm(`هل أنت متأكد من حذف المنتج "${item.name}"؟`)) return;

    try {
      await db_service.deleteItem(item.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'حذف منتج',
        itemOrShiftAffected: item.name,
        changeDetails: `تم حذف المنتج: ${item.name}`,
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section
      };
      await db_service.saveAdminLog(log);

      loadItems();
      loadAdminLogs();
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('فشل في حذف المنتج');
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name) {
      alert('يرجى إدخال اسم الفئة');
      return;
    }

    try {
      const category: Category = {
        id: uuidv4(),
        name: categoryForm.name,
        section,
        createdAt: new Date()
      };

      await db_service.saveCategory(category);
      setShowCategoryModal(false);
      setCategoryForm({ name: '' });
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      alert('فشل في حفظ الفئة');
    }
  };

  const saveSupply = async () => {
    if (!supplyForm.totalCost || Object.keys(supplyForm.items).length === 0) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyForm.items,
        totalCost: parseFloat(supplyForm.totalCost),
        timestamp: new Date(),
        createdBy: user?.username || 'غير معروف'
      };

      await db_service.saveSupply(supply);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyForm.items)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          const updatedItem: Item = {
            ...item,
            currentAmount: item.currentAmount + quantity,
            updatedAt: new Date()
          };
          await db_service.saveItem(updatedItem);
        }
      }

      setShowSupplyModal(false);
      setSupplyForm({ items: {}, totalCost: '' });
      loadSupplies();
      loadItems();
    } catch (err) {
      console.error('Error saving supply:', err);
      alert('فشل في حفظ التوريد');
    }
  };

  const saveUser = async () => {
    if (!userForm.username || !userForm.password) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const userToSave: User = {
        id: editingUser?.id || uuidv4(),
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        createdAt: editingUser?.createdAt || new Date()
      };

      if (editingUser) {
        await db_service.updateUser(userToSave);
      } else {
        await db_service.createUser(userToSave);
      }

      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', role: 'normal' });
      loadUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert('فشل في حفظ المستخدم');
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) return;

    try {
      await db_service.deleteUser(userToDelete.id);
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('فشل في حذف المستخدم');
    }
  };

  const updateSupplementDebt = async () => {
    if (!debtForm.amount || !debtForm.note) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const amount = parseFloat(debtForm.amount);
      const currentDebt = supplementDebt?.amount || 0;
      const newAmount = debtForm.type === 'payment' ? 
        currentDebt - amount : 
        currentDebt + amount;

      const debt: SupplementDebt = {
        amount: Math.max(0, newAmount),
        lastUpdated: new Date(),
        updatedBy: user?.username || 'غير معروف'
      };

      await db_service.saveSupplementDebt(debt);
      setShowDebtModal(false);
      setDebtForm({ amount: '', type: 'payment', note: '' });
      loadSupplementDebt();
    } catch (err) {
      console.error('Error updating supplement debt:', err);
      alert('فشل في تحديث الدين');
    }
  };

  const exportShiftsPDF = () => {
    generateShiftsPDF(shifts, section);
  };

  const exportMonthlySummaryPDF = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    generateMonthlySummaryPDF(shifts, items, section, currentMonth);
  };

  // Dashboard calculations
  const todayShifts = shifts.filter(shift => 
    new Date(shift.startTime).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayShifts.reduce((total, shift) => total + shift.totalAmount, 0);
  const todayExpenses = todayShifts.reduce((total, shift) => 
    total + shift.expenses.reduce((expTotal, exp) => expTotal + exp.amount, 0), 0
  );
  const todayProfit = todayRevenue - todayExpenses;
  
  const activeShift = shifts.find(shift => shift.status === 'active');
  const lowStockItems = items.filter(item => item.currentAmount <= 5);
  const totalCustomerDebt = unpaidPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
        <button
          onClick={loadData}
          className="mt-2 text-sm underline hover:no-underline"
        >
          حاول مرة أخرى
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              لوحة تحكم المدير - {section === 'store' ? 'البار' : 'المكملات الغذائية'}
            </h2>
            <p className="text-gray-600">إدارة شاملة للنظام</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportShiftsPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4 inline mr-1" />
              تصدير الورديات
            </button>
            <button
              onClick={exportMonthlySummaryPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="h-4 w-4 inline mr-1" />
              تقرير شهري
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex overflow-x-auto">
          {[
            { id: 'dashboard', label: 'لوحة التحكم', icon: BarChart3 },
            { id: 'items', label: 'المنتجات', icon: Package },
            { id: 'shifts', label: 'الورديات', icon: Clock },
            { id: 'customers', label: 'العملاء', icon: Users },
            { id: 'supplies', label: 'التوريدات', icon: TrendingUp },
            { id: 'users', label: 'المستخدمين', icon: Settings },
            { id: 'logs', label: 'سجل الأنشطة', icon: FileText },
            ...(section === 'supplement' ? [{ id: 'debt', label: 'إدارة الديون', icon: CreditCard }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">ربح اليوم</p>
                  <p className="text-2xl font-bold text-green-600">{todayProfit.toFixed(2)} جنيه</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">إيرادات اليوم</p>
                  <p className="text-2xl font-bold text-blue-600">{todayRevenue.toFixed(2)} جنيه</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">إجمالي العملاء</p>
                  <p className="text-2xl font-bold text-purple-600">{customers.length}</p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">ديون العملاء</p>
                  <p className="text-2xl font-bold text-red-600">{totalCustomerDebt.toFixed(2)} جنيه</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>

          {/* Active Shift & Low Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Shift */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium mb-4">الوردية النشطة</h3>
              {activeShift ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="font-medium">{activeShift.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">بدأت في:</span>
                    <span className="font-medium">{activeShift.startTime.toLocaleTimeString('ar-EG')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي المبيعات:</span>
                    <span className="font-medium text-green-600">{activeShift.totalAmount} جنيه</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedShift(activeShift);
                      setShowShiftDetailsModal(true);
                    }}
                    className="w-full mt-3 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    عرض التفاصيل
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد وردية نشطة</p>
                </div>
              )}
            </div>

            {/* Low Stock Alert */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium mb-4">تنبيهات المخزون المنخفض</h3>
              {lowStockItems.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-red-600 font-semibold">{item.currentAmount} متبقي</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>جميع المنتجات متوفرة</p>
                </div>
              )}
            </div>
          </div>

          {/* Supplement Debt (only for supplement section) */}
          {section === 'supplement' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">إجمالي دين المكملات الغذائية</h3>
                <button
                  onClick={() => setShowDebtModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  إدارة الدين
                </button>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">
                  {supplementDebt?.amount?.toFixed(2) || '0.00'} جنيه
                </p>
                {supplementDebt && (
                  <p className="text-sm text-gray-500 mt-2">
                    آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">إدارة المنتجات</h3>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  إضافة فئة
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm({ name: '', sellPrice: '', costPrice: '', currentAmount: '', image: '', categoryId: '' });
                    setShowItemModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  إضافة منتج
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المنتج</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر البيع</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر التكلفة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المخزون</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.image && (
                            <img className="h-10 w-10 rounded-lg object-cover mr-3" src={item.image} alt={item.name} />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            {item.categoryId && (
                              <div className="text-sm text-gray-500">
                                {categories.find(c => c.id === item.categoryId)?.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.sellPrice} جنيه</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.costPrice} جنيه</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.currentAmount <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {item.currentAmount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setItemForm({
                                name: item.name,
                                sellPrice: item.sellPrice.toString(),
                                costPrice: item.costPrice.toString(),
                                currentAmount: item.currentAmount.toString(),
                                image: item.image || '',
                                categoryId: item.categoryId || ''
                              });
                              setShowItemModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteItem(item)}
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

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium mb-4">سجل الورديات</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">بداية الوردية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نهاية الوردية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجمالي المبيعات</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shift.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.startTime.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.totalAmount} جنيه</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          shift.status === 'active' ? 'bg-green-100 text-green-800' : 
                          shift.validationStatus === 'balanced' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {shift.status === 'active' ? 'نشطة' : 
                           shift.validationStatus === 'balanced' ? 'متوازنة' : 'بها تناقض'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedShift(shift);
                            setShowShiftDetailsModal(true);
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
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium mb-4">إدارة العملاء</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customers List */}
              <div>
                <h4 className="font-medium mb-3">قائمة العملاء</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {customers.map((customer) => (
                    <div key={customer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-sm text-gray-500">
                        {customer.createdAt.toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unpaid Purchases */}
              <div>
                <h4 className="font-medium mb-3">المشتريات غير المدفوعة</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {unpaidPurchases.map((purchase) => (
                    <div key={purchase.id} className="p-3 bg-red-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{purchase.customerName}</div>
                          <div className="text-sm text-gray-600">
                            {purchase.timestamp.toLocaleDateString('ar-EG')}
                          </div>
                        </div>
                        <div className="text-red-600 font-semibold">{purchase.totalAmount} جنيه</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplies Tab */}
      {activeTab === 'supplies' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">إدارة التوريدات</h3>
              <button
                onClick={() => {
                  setSupplyForm({ items: {}, totalCost: '' });
                  setShowSupplyModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                إضافة توريد
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجمالي التكلفة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المنشئ</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عدد المنتجات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplies.map((supply) => (
                    <tr key={supply.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {supply.timestamp.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supply.totalCost} جنيه</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supply.createdBy}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Object.keys(supply.items).length} منتج
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">إدارة المستخدمين</h3>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ username: '', password: '', role: 'normal' });
                  setShowUserModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                إضافة مستخدم
              </button>
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
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{userItem.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userItem.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem.createdAt.toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingUser(userItem);
                              setUserForm({
                                username: userItem.username,
                                password: userItem.password,
                                role: userItem.role
                              });
                              setShowUserModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteUser(userItem)}
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

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium mb-4">سجل أنشطة المديرين</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">نوع الإجراء</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العنصر المتأثر</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تفاصيل التغيير</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المدير</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {adminLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.timestamp.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.actionType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.itemOrShiftAffected}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{log.changeDetails}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.adminName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Debt Tab (Supplement section only) */}
      {activeTab === 'debt' && section === 'supplement' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">إدارة ديون المكملات الغذائية</h3>
              <button
                onClick={() => setShowDebtModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                إضافة معاملة
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">إجمالي الدين الحالي</p>
              <p className="text-4xl font-bold text-red-600">
                {supplementDebt?.amount?.toFixed(2) || '0.00'} جنيه
              </p>
              {supplementDebt && (
                <p className="text-sm text-gray-500 mt-2">
                  آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Modals */}
      
      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">
              {editingItem ? 'تعديل منتج' : 'إضافة منتج جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (جنيه)</label>
                <input
                  type="number"
                  value={itemForm.sellPrice}
                  onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة (جنيه)</label>
                <input
                  type="number"
                  value={itemForm.costPrice}
                  onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الحالية</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm({ ...itemForm, currentAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة (اختياري)</label>
                <input
                  type="url"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة (اختياري)</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">اختر فئة</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                  setItemForm({ name: '', sellPrice: '', costPrice: '', currentAmount: '', image: '', categoryId: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={saveItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingItem ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">إضافة فئة جديدة</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setCategoryForm({ name: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={saveCategory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">إضافة توريد جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المنتجات والكميات</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="font-medium">{item.name}</span>
                      <input
                        type="number"
                        min="0"
                        value={supplyForm.items[item.id] || ''}
                        onChange={(e) => {
                          const quantity = parseInt(e.target.value) || 0;
                          setSupplyForm({
                            ...supplyForm,
                            items: {
                              ...supplyForm.items,
                              [item.id]: quantity
                            }
                          });
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">إجمالي التكلفة (جنيه)</label>
                <input
                  type="number"
                  value={supplyForm.totalCost}
                  onChange={(e) => setSupplyForm({ ...supplyForm, totalCost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSupplyModal(false);
                  setSupplyForm({ items: {}, totalCost: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={saveSupply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                إضافة توريد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'normal' | 'admin' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">مستخدم عادي</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                  setUserForm({ username: '', password: '', role: 'normal' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={saveUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingUser ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetailsModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">تفاصيل الوردية</h3>
              <button
                onClick={() => setShowShiftDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shift Info */}
              <div className="space-y-4">
                <h4 className="font-medium">معلومات الوردية</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="font-medium">{selectedShift.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">بداية الوردية:</span>
                    <span className="font-medium">{selectedShift.startTime.toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">نهاية الوردية:</span>
                    <span className="font-medium">
                      {selectedShift.endTime ? selectedShift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي المبيعات:</span>
                    <span className="font-medium text-green-600">{selectedShift.totalAmount} جنيه</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي المصروفات:</span>
                    <span className="font-medium text-red-600">
                      {selectedShift.expenses.reduce((total, exp) => total + exp.amount, 0)} جنيه
                    </span>
                  </div>
                  {selectedShift.finalCash !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">النقدية النهائية:</span>
                      <span className="font-medium">{selectedShift.finalCash} جنيه</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Purchases */}
              <div className="space-y-4">
                <h4 className="font-medium">المبيعات</h4>
                <div className="max-h-64 overflow-y-auto">
                  {selectedShift.purchases.map((purchase, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg mb-2">
                      <span>{purchase.name} x{purchase.quantity}</span>
                      <span className="font-medium">{(purchase.price * purchase.quantity).toFixed(2)} جنيه</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Expenses */}
            {selectedShift.expenses.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3">المصروفات</h4>
                <div className="space-y-2">
                  {selectedShift.expenses.map((expense, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                      <span>{expense.reason}</span>
                      <span className="font-medium text-red-600">{expense.amount} جنيه</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discrepancies */}
            {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3 text-red-600">التناقضات</h4>
                <div className="space-y-2">
                  {selectedShift.discrepancies.map((discrepancy, index) => (
                    <div key={index} className="p-2 bg-red-50 rounded-lg text-red-700">
                      {discrepancy}
                    </div>
                  ))}
                </div>
                {selectedShift.closeReason && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
                    <span className="font-medium">سبب الإغلاق: </span>
                    {selectedShift.closeReason}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debt Modal (Supplement section only) */}
      {showDebtModal && section === 'supplement' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">إدارة دين المكملات الغذائية</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المعاملة</label>
                <select
                  value={debtForm.type}
                  onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as 'payment' | 'debt' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="payment">دفع (تقليل الدين)</option>
                  <option value="debt">دين جديد (زيادة الدين)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظة</label>
                <textarea
                  value={debtForm.note}
                  onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  الدين الحالي: {supplementDebt?.amount?.toFixed(2) || '0.00'} جنيه
                </div>
                {debtForm.amount && (
                  <div className="text-sm text-gray-600">
                    الدين بعد المعاملة: {
                      debtForm.type === 'payment' ? 
                        Math.max(0, (supplementDebt?.amount || 0) - parseFloat(debtForm.amount)).toFixed(2) :
                        ((supplementDebt?.amount || 0) + parseFloat(debtForm.amount)).toFixed(2)
                    } جنيه
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDebtModal(false);
                  setDebtForm({ amount: '', type: 'payment', note: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={updateSupplementDebt}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                تحديث الدين
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;