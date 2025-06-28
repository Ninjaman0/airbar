import React, { useState, useEffect } from 'react';
import { 
  Package, Users, DollarSign, TrendingUp, Calendar, FileText, 
  Settings, Plus, Edit, Trash2, Eye, Download, AlertTriangle,
  CheckCircle, Clock, X, Save, BarChart3, PieChart, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { 
  Item, Category, Customer, Shift, Supply, AdminLog, User, 
  SupplementDebt, SupplementDebtTransaction, CustomerPurchase, Expense, ExternalMoney
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [debtTransactions, setDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showDebtTransactionModal, setShowDebtTransactionModal] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    categoryId: '',
    image: ''
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: ''
  });
  
  const [customerForm, setCustomerForm] = useState({
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
    note: ''
  });

  const [debtTransactionForm, setDebtTransactionForm] = useState({
    type: 'payment' as 'payment' | 'debt',
    amount: '',
    note: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [
        itemsData, categoriesData, customersData, shiftsData, 
        suppliesData, adminLogsData, usersData, unpaidData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllAdminLogs(),
        db_service.getAllUsers(),
        db_service.getUnpaidCustomerPurchases(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setAdminLogs(adminLogsData.filter(log => !log.section || log.section === section));
      setUsers(usersData);
      setUnpaidPurchases(unpaidData);

      // Load supplement debt data if in supplement section
      if (section === 'supplement') {
        const [debtData, transactionsData] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debtData);
        setDebtTransactions(transactionsData);
      }

      // Initialize supply form with current items
      const supplyItems: Record<string, number> = {};
      itemsData.forEach(item => {
        supplyItems[item.id] = 0;
      });
      setSupplyForm(prev => ({ ...prev, items: supplyItems }));
    } catch (error) {
      console.error('Error loading data:', error);
      setError('فشل في تحميل البيانات');
    }
  };

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      loadData();
    }
  }, [section]);

  // Item operations
  const saveItem = async () => {
    if (!itemForm.name || !itemForm.sellPrice || !itemForm.costPrice) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsLoading(true);

      const item: Item = {
        id: editingItem?.id || uuidv4(),
        name: itemForm.name,
        sellPrice: parseFloat(itemForm.sellPrice),
        costPrice: parseFloat(itemForm.costPrice),
        currentAmount: parseInt(itemForm.currentAmount) || 0,
        categoryId: itemForm.categoryId || undefined,
        image: itemForm.image || undefined,
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
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetItemForm();
      setShowItemModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      setError('فشل في حفظ المنتج');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (item: Item) => {
    if (!confirm(`هل أنت متأكد من حذف المنتج "${item.name}"؟`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteItem(item.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'حذف منتج',
        itemOrShiftAffected: item.name,
        changeDetails: `تم حذف المنتج: ${item.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('فشل في حذف المنتج');
    } finally {
      setIsLoading(false);
    }
  };

  const editItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sellPrice: item.sellPrice.toString(),
      costPrice: item.costPrice.toString(),
      currentAmount: item.currentAmount.toString(),
      categoryId: item.categoryId || '',
      image: item.image || ''
    });
    setShowItemModal(true);
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      sellPrice: '',
      costPrice: '',
      currentAmount: '',
      categoryId: '',
      image: ''
    });
  };

  // Category operations
  const saveCategory = async () => {
    if (!categoryForm.name) {
      setError('يرجى إدخال اسم الفئة');
      return;
    }

    try {
      setIsLoading(true);

      const category: Category = {
        id: editingCategory?.id || uuidv4(),
        name: categoryForm.name,
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db_service.saveCategory(category);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingCategory ? 'تعديل فئة' : 'إضافة فئة',
        itemOrShiftAffected: category.name,
        changeDetails: editingCategory ? 
          `تم تعديل الفئة: ${category.name}` : 
          `تم إضافة فئة جديدة: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetCategoryForm();
      setShowCategoryModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving category:', error);
      setError('فشل في حفظ الفئة');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!confirm(`هل أنت متأكد من حذف الفئة "${category.name}"؟`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteCategory(category.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'حذف فئة',
        itemOrShiftAffected: category.name,
        changeDetails: `تم حذف الفئة: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('فشل في حذف الفئة');
    } finally {
      setIsLoading(false);
    }
  };

  const editCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryModal(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '' });
  };

  // Customer operations
  const saveCustomer = async () => {
    if (!customerForm.name) {
      setError('يرجى إدخال اسم العميل');
      return;
    }

    try {
      setIsLoading(true);

      const customer: Customer = {
        id: editingCustomer?.id || uuidv4(),
        name: customerForm.name,
        section,
        createdAt: editingCustomer?.createdAt || new Date()
      };

      await db_service.saveCustomer(customer);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingCustomer ? 'تعديل عميل' : 'إضافة عميل',
        itemOrShiftAffected: customer.name,
        changeDetails: editingCustomer ? 
          `تم تعديل العميل: ${customer.name}` : 
          `تم إضافة عميل جديد: ${customer.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetCustomerForm();
      setShowCustomerModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      setError('فشل في حفظ العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const editCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({ name: customer.name });
    setShowCustomerModal(true);
  };

  const resetCustomerForm = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '' });
  };

  // Mark customer purchase as paid
  const markAsPaid = async (purchase: CustomerPurchase) => {
    try {
      setIsLoading(true);

      // Mark purchase as paid
      const updatedPurchase = { ...purchase, isPaid: true };
      await db_service.saveCustomerPurchase(updatedPurchase);

      // Update inventory (deduct items)
      for (const item of purchase.items) {
        const existingItem = items.find(i => i.id === item.itemId);
        if (existingItem) {
          const updatedItem = {
            ...existingItem,
            currentAmount: existingItem.currentAmount - item.quantity,
            updatedAt: new Date()
          };
          await db_service.saveItem(updatedItem);
        }
      }

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'دفع عميل',
        itemOrShiftAffected: purchase.customerName,
        changeDetails: `تم دفع مبلغ ${purchase.totalAmount} جنيه من العميل ${purchase.customerName}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('Error marking as paid:', error);
      setError('فشل في تحديد كمدفوع');
    } finally {
      setIsLoading(false);
    }
  };

  // Supply operations
  const saveSupply = async () => {
    const totalItems = Object.values(supplyForm.items).reduce((sum, qty) => sum + qty, 0);
    if (totalItems === 0 || !supplyForm.totalCost) {
      setError('يرجى إدخال كميات المنتجات والتكلفة الإجمالية');
      return;
    }

    try {
      setIsLoading(true);

      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyForm.items,
        totalCost: parseFloat(supplyForm.totalCost),
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupply(supply);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyForm.items)) {
        if (quantity > 0) {
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
      }

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'إضافة توريد',
        itemOrShiftAffected: 'توريد جديد',
        changeDetails: `تم إضافة توريد بتكلفة ${supply.totalCost} جنيه`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetSupplyForm();
      setShowSupplyModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving supply:', error);
      setError('فشل في حفظ التوريد');
    } finally {
      setIsLoading(false);
    }
  };

  const resetSupplyForm = () => {
    const supplyItems: Record<string, number> = {};
    items.forEach(item => {
      supplyItems[item.id] = 0;
    });
    setSupplyForm({
      items: supplyItems,
      totalCost: ''
    });
  };

  // User operations
  const saveUser = async () => {
    if (!userForm.username || !userForm.password) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsLoading(true);

      const newUser: User = {
        id: editingUser?.id || uuidv4(),
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        createdAt: editingUser?.createdAt || new Date()
      };

      if (editingUser) {
        await db_service.updateUser(newUser);
      } else {
        await db_service.createUser(newUser);
      }

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم',
        itemOrShiftAffected: newUser.username,
        changeDetails: editingUser ? 
          `تم تعديل المستخدم: ${newUser.username}` : 
          `تم إضافة مستخدم جديد: ${newUser.username}`,
        timestamp: new Date(),
        adminName: user?.username || ''
      };
      await db_service.saveAdminLog(log);

      resetUserForm();
      setShowUserModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving user:', error);
      setError('فشل في حفظ المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteUser(userToDelete.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'حذف مستخدم',
        itemOrShiftAffected: userToDelete.username,
        changeDetails: `تم حذف المستخدم: ${userToDelete.username}`,
        timestamp: new Date(),
        adminName: user?.username || ''
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('فشل في حذف المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  const editUser = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setUserForm({
      username: userToEdit.username,
      password: userToEdit.password,
      role: userToEdit.role
    });
    setShowUserModal(true);
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      password: '',
      role: 'normal'
    });
  };

  // Supplement debt operations
  const saveBaseDebt = async () => {
    if (!debtForm.amount) {
      setError('يرجى إدخال مبلغ الدين الأساسي');
      return;
    }

    try {
      setIsLoading(true);

      const debt: SupplementDebt = {
        amount: parseFloat(debtForm.amount),
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(debt);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'تعديل الدين الأساسي',
        itemOrShiftAffected: 'دين المكملات الغذائية',
        changeDetails: `تم تعديل الدين الأساسي إلى ${debt.amount} جنيه`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setDebtForm({ amount: '', note: '' });
      setShowDebtModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving base debt:', error);
      setError('فشل في حفظ الدين الأساسي');
    } finally {
      setIsLoading(false);
    }
  };

  const saveDebtTransaction = async () => {
    if (!debtTransactionForm.amount || !debtTransactionForm.note) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsLoading(true);

      const transaction: SupplementDebtTransaction = {
        id: uuidv4(),
        type: debtTransactionForm.type,
        amount: parseFloat(debtTransactionForm.amount),
        note: debtTransactionForm.note,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: transaction.type === 'payment' ? 'دفع دين' : 'إضافة دين',
        itemOrShiftAffected: 'دين المكملات الغذائية',
        changeDetails: `${transaction.type === 'payment' ? 'تم دفع' : 'تم إضافة'} مبلغ ${transaction.amount} جنيه - ${transaction.note}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setDebtTransactionForm({ type: 'payment', amount: '', note: '' });
      setShowDebtTransactionModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error saving debt transaction:', error);
      setError('فشل في حفظ معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate current debt
  const getCurrentDebt = () => {
    if (!supplementDebt) return 0;
    
    const baseDebt = supplementDebt.amount;
    const transactionTotal = debtTransactions.reduce((total, transaction) => {
      return transaction.type === 'payment' 
        ? total - transaction.amount 
        : total + transaction.amount;
    }, 0);
    
    return baseDebt + transactionTotal;
  };

  // PDF generation
  const generateShiftReport = () => {
    generateShiftsPDF(shifts, section);
  };

  const generateMonthlyReport = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    generateMonthlySummaryPDF(shifts, items, section, currentMonth);
  };

  // Dashboard calculations
  const todayShifts = shifts.filter(shift => {
    const today = new Date().toDateString();
    return shift.startTime.toDateString() === today;
  });

  const todayRevenue = todayShifts.reduce((sum, shift) => 
    sum + shift.purchases.reduce((total, p) => total + (p.price * p.quantity), 0), 0
  );

  const todayExpenses = todayShifts.reduce((sum, shift) => 
    sum + shift.expenses.reduce((total, e) => total + e.amount, 0), 0
  );

  const todayProfit = todayRevenue - todayExpenses;

  const activeShift = shifts.find(shift => shift.status === 'active');

  const lowStockItems = items.filter(item => item.currentAmount < 5);

  const totalCustomerDebt = unpaidPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{todayProfit.toFixed(2)} جنيه</div>
              <div className="text-sm text-gray-600">ربح اليوم</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{todayRevenue.toFixed(2)} جنيه</div>
              <div className="text-sm text-gray-600">مبيعات اليوم</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{customers.length}</div>
              <div className="text-sm text-gray-600">إجمالي العملاء</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{lowStockItems.length}</div>
              <div className="text-sm text-gray-600">منتجات قليلة المخزون</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Shift Status */}
      {activeShift && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">الوردية النشطة</h3>
              <p className="text-gray-600">
                بدأت: {activeShift.startTime.toLocaleString('ar-EG')} - المستخدم: {activeShift.username}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                نشطة
              </div>
              <button
                onClick={() => {
                  setSelectedShift(activeShift);
                  setShowShiftDetailsModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                عرض التفاصيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 ml-2" />
            تنبيه: منتجات قليلة المخزون
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockItems.map(item => (
              <div key={item.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-red-600">المخزون المتبقي: {item.currentAmount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Debt */}
      {unpaidPurchases.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ديون العملاء</h3>
          <div className="mb-4">
            <div className="text-2xl font-bold text-red-600">{totalCustomerDebt.toFixed(2)} جنيه</div>
            <div className="text-sm text-gray-600">إجمالي الديون غير المدفوعة</div>
          </div>
          <div className="space-y-3">
            {unpaidPurchases.slice(0, 5).map(purchase => (
              <div key={purchase.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <div>
                  <div className="font-medium">{purchase.customerName}</div>
                  <div className="text-sm text-gray-600">
                    {purchase.items.length} منتج - {purchase.totalAmount.toFixed(2)} جنيه
                  </div>
                  <div className="text-xs text-gray-500">
                    {purchase.timestamp.toLocaleString('ar-EG')}
                  </div>
                </div>
                <button
                  onClick={() => markAsPaid(purchase)}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                  تحديد كمدفوع
                </button>
              </div>
            ))}
          </div>
          {unpaidPurchases.length > 5 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setActiveTab('customers')}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                عرض جميع الديون ({unpaidPurchases.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Supplement Debt (only for supplement section) */}
      {section === 'supplement' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">إدارة ديون المكملات الغذائية</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowDebtModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                تعديل الدين الأساسي
              </button>
              <button
                onClick={() => {
                  setDebtTransactionForm({ type: 'payment', amount: '', note: '' });
                  setShowDebtTransactionModal(true);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                إضافة دفعة
              </button>
              <button
                onClick={() => {
                  setDebtTransactionForm({ type: 'debt', amount: '', note: '' });
                  setShowDebtTransactionModal(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                إضافة دين
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-3xl font-bold text-red-600">{getCurrentDebt().toFixed(2)} جنيه</div>
            <div className="text-sm text-gray-600">إجمالي الدين الحالي</div>
          </div>

          {supplementDebt && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="font-medium">الدين الأساسي: {supplementDebt.amount.toFixed(2)} جنيه</div>
              <div className="text-sm text-gray-600">
                آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
              </div>
            </div>
          )}

          {debtTransactions.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">سجل المعاملات</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {debtTransactions.slice(0, 10).map(transaction => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          transaction.type === 'payment' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'payment' ? 'دفعة' : 'دين'}
                        </span>
                        <span className="font-medium">
                          {transaction.type === 'payment' ? '-' : '+'}{transaction.amount.toFixed(2)} جنيه
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{transaction.note}</div>
                      <div className="text-xs text-gray-500">
                        {transaction.timestamp.toLocaleString('ar-EG')} - {transaction.createdBy}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderItems = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">إدارة المنتجات</h2>
        <button
          onClick={() => {
            resetItemForm();
            setShowItemModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة منتج
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المنتج
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  سعر البيع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  سعر التكلفة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المخزون
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الفئة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(item => {
                const category = categories.find(c => c.id === item.categoryId);
                return (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {item.sellPrice} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {item.costPrice} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.currentAmount < 5 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.currentAmount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {category?.name || 'غير محدد'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => editItem(item)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">إدارة الفئات</h2>
        <button
          onClick={() => {
            resetCategoryForm();
            setShowCategoryModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة فئة
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم الفئة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  عدد المنتجات
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الإنشاء
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map(category => {
                const itemCount = items.filter(item => item.categoryId === category.id).length;
                return (
                  <tr key={category.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{category.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {itemCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {category.createdAt.toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => editCategory(category)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCategory(category)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">إدارة العملاء</h2>
        <button
          onClick={() => {
            resetCustomerForm();
            setShowCustomerModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة عميل
        </button>
      </div>

      {/* Unpaid Purchases */}
      {unpaidPurchases.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">المشتريات غير المدفوعة</h3>
          <div className="space-y-3">
            {unpaidPurchases.map(purchase => (
              <div key={purchase.id} className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                <div>
                  <div className="font-medium">{purchase.customerName}</div>
                  <div className="text-sm text-gray-600">
                    {purchase.items.length} منتج - {purchase.totalAmount.toFixed(2)} جنيه
                  </div>
                  <div className="text-xs text-gray-500">
                    {purchase.timestamp.toLocaleString('ar-EG')}
                  </div>
                </div>
                <button
                  onClick={() => markAsPaid(purchase)}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  تحديد كمدفوع
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم العميل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الإنشاء
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map(customer => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {customer.createdAt.toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => editCustomer(customer)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderShifts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">إدارة الورديات</h2>
        <button
          onClick={generateShiftReport}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Download className="h-4 w-4 ml-2" />
          تصدير تقرير
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  معرف الوردية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  وقت البداية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  وقت النهاية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  إجمالي النقدية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.map(shift => (
                <tr key={shift.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-sm">{shift.id.substring(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{shift.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {shift.startTime.toLocaleString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {shift.totalAmount.toFixed(2)} جنيه
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      shift.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : shift.validationStatus === 'balanced'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {shift.status === 'active' ? 'نشطة' : 
                       shift.validationStatus === 'balanced' ? 'متوازنة' : 'بها تضارب'}
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
  );

  const renderSupplies = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">إدارة التوريدات</h2>
        <button
          onClick={() => {
            resetSupplyForm();
            setShowSupplyModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة توريد
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التكلفة الإجمالية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المنشئ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  عدد المنتجات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {supplies.map(supply => (
                <tr key={supply.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {supply.timestamp.toLocaleString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {supply.totalCost.toFixed(2)} جنيه
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {supply.createdBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {Object.values(supply.items).reduce((sum, qty) => sum + qty, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h2>
        <button
          onClick={() => {
            resetUserForm();
            setShowUserModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة مستخدم
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الدور
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الإنشاء
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(userItem => (
                <tr key={userItem.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{userItem.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      userItem.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {userItem.createdAt.toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editUser(userItem)}
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
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">سجل أنشطة المدير</h2>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ والوقت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع الإجراء
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المنتج/الوردية المتأثرة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تفاصيل التغيير
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم المدير
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {adminLogs.map(log => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {log.timestamp.toLocaleString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {log.itemOrShiftAffected}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {log.changeDetails}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {log.adminName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', name: 'لوحة التحكم', icon: BarChart3 },
    { id: 'items', name: 'المنتجات', icon: Package },
    { id: 'categories', name: 'الفئات', icon: FileText },
    { id: 'customers', name: 'العملاء', icon: Users },
    { id: 'shifts', name: 'الورديات', icon: Clock },
    { id: 'supplies', name: 'التوريدات', icon: TrendingUp },
    { id: 'users', name: 'المستخدمين', icon: Settings },
    { id: 'logs', name: 'سجل الأنشطة', icon: Activity }
  ];

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 ml-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'items' && renderItems()}
        {activeTab === 'categories' && renderCategories()}
        {activeTab === 'customers' && renderCustomers()}
        {activeTab === 'shifts' && renderShifts()}
        {activeTab === 'supplies' && renderSupplies()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'logs' && renderLogs()}
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingItem ? 'تعديل منتج' : 'إضافة منتج جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المنتج"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الحالية</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm({ ...itemForm, currentAmount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">اختر فئة</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة (اختياري)</label>
                <input
                  type="url"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveItem}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingCategory ? 'تعديل فئة' : 'إضافة فئة جديدة'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="أدخل اسم الفئة"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveCategory}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
              <input
                type="text"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="أدخل اسم العميل"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveCustomer}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">إضافة توريد جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">كميات المنتجات</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">المخزون الحالي: {item.currentAmount}</div>
                      </div>
                      <input
                        type="number"
                        value={supplyForm.items[item.id] || 0}
                        onChange={(e) => setSupplyForm({
                          ...supplyForm,
                          items: {
                            ...supplyForm.items,
                            [item.id]: parseInt(e.target.value) || 0
                          }
                        })}
                
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة الإجمالية (جنيه)</label>
                <input
                  type="number"
                  value={supplyForm.totalCost}
                  onChange={(e) => setSupplyForm({ ...supplyForm, totalCost: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowSupplyModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveSupply}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ التوريد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المستخدم"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'normal' | 'admin' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="normal">مستخدم عادي</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveUser}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">تعديل الدين الأساسي</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ الدين الأساسي (جنيه)</label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظة</label>
                <input
                  type="text"
                  value={debtForm.note}
                  onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل ملاحظة"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowDebtModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveBaseDebt}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Transaction Modal */}
      {showDebtTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {debtTransactionForm.type === 'payment' ? 'إضافة دفعة' : 'إضافة دين'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtTransactionForm.amount}
                  onChange={(e) => setDebtTransactionForm({ ...debtTransactionForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظة</label>
                <input
                  type="text"
                  value={debtTransactionForm.note}
                  onChange={(e) => setDebtTransactionForm({ ...debtTransactionForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل ملاحظة"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowDebtTransactionModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveDebtTransaction}
                disabled={isLoading}
                className={`flex-1 py-2 rounded-lg text-white disabled:opacity-50 ${
                  debtTransactionForm.type === 'payment' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetailsModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">تفاصيل الوردية</h3>
              <button
                onClick={() => setShowShiftDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shift Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">معلومات الوردية</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div><span className="font-medium">المعرف:</span> {selectedShift.id.substring(0, 8)}</div>
                    <div><span className="font-medium">المستخدم:</span> {selectedShift.username}</div>
                    <div><span className="font-medium">وقت البداية:</span> {selectedShift.startTime.toLocaleString('ar-EG')}</div>
                    <div><span className="font-medium">وقت النهاية:</span> {selectedShift.endTime ? selectedShift.endTime.toLocaleString('ar-EG') : 'نشطة'}</div>
                    <div><span className="font-medium">الحالة:</span> {selectedShift.status === 'active' ? 'نشطة' : 'مغلقة'}</div>
                    <div><span className="font-medium">حالة التحقق:</span> {selectedShift.validationStatus === 'balanced' ? 'متوازنة' : 'بها تضارب'}</div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">الملخص المالي</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div><span className="font-medium">إجمالي المبيعات:</span> {selectedShift.purchases.reduce((sum, p) => sum + (p.price * p.quantity), 0).toFixed(2)} جنيه</div>
                    <div><span className="font-medium">إجمالي المصروفات:</span> {selectedShift.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} جنيه</div>
                    <div><span className="font-medium">الأموال الخارجية:</span> {selectedShift.externalMoney.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} جنيه</div>
                    <div><span className="font-medium">إجمالي النقدية:</span> {selectedShift.totalAmount.toFixed(2)} جنيه</div>
                    {selectedShift.finalCash !== undefined && (
                      <div><span className="font-medium">النقدية النهائية:</span> {selectedShift.finalCash.toFixed(2)} جنيه</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Purchases */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">المشتريات ({selectedShift.purchases.length})</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                    {selectedShift.purchases.map((purchase, index) => (
                      <div key={index} className="flex justify-between items-center py-1">
                        <span>{purchase.name} x{purchase.quantity}</span>
                        <span>{(purchase.price * purchase.quantity).toFixed(2)} جنيه</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expenses */}
                {selectedShift.expenses.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">المصروفات ({selectedShift.expenses.length})</h4>
                    <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                      {selectedShift.expenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center py-1">
                          <span>{expense.reason}</span>
                          <span>{expense.amount.toFixed(2)} جنيه</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* External Money */}
                {selectedShift.externalMoney.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">الأموال الخارجية ({selectedShift.externalMoney.length})</h4>
                    <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                      {selectedShift.externalMoney.map((money) => (
                        <div key={money.id} className="flex justify-between items-center py-1">
                          <span>{money.reason}</span>
                          <span>{money.amount.toFixed(2)} جنيه</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Discrepancies */}
            {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">التضاربات</h4>
                <div className="bg-red-50 p-4 rounded-lg">
                  {selectedShift.discrepancies.map((discrepancy, index) => (
                    <div key={index} className="text-red-700 py-1">{discrepancy}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Reason */}
            {selectedShift.closeReason && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">ملاحظات الإغلاق</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {selectedShift.closeReason}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;