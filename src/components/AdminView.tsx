import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Users, Package, DollarSign, BarChart3, FileText, Settings, Download, Upload, Camera, X, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { Item, Category, Customer, CustomerPurchase, Shift, Supply, User, AdminLog, SupplementDebt, SupplementDebtTransaction, MonthlyArchive } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'customers' | 'shifts' | 'supplies' | 'users' | 'logs' | 'debt' | 'archives'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [debtTransactions, setDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [showEditDebtTransactionModal, setShowEditDebtTransactionModal] = useState(false);
  
  // Edit states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingDebtTransaction, setEditingDebtTransaction] = useState<SupplementDebtTransaction | null>(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  
  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    image: '',
    categoryId: ''
  });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [customerForm, setCustomerForm] = useState({ name: '' });
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });
  const [debtForm, setDebtForm] = useState({
    type: 'debt' as 'payment' | 'debt',
    amount: '',
    note: ''
  });
  const [supplyForm, setSupplyForm] = useState<Record<string, string>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, [section]);

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      loadData();
    }
  }, [section]);

  const loadData = async () => {
    try {
      const [
        itemsData,
        categoriesData,
        customersData,
        shiftsData,
        suppliesData,
        usersData,
        logsData,
        unpaidData,
        archivesData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllUsers(),
        db_service.getAllAdminLogs(),
        db_service.getUnpaidCustomerPurchases(section),
        db_service.getMonthlyArchives(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setUsers(usersData);
      setAdminLogs(logsData.filter(log => !log.section || log.section === section));
      setUnpaidPurchases(unpaidData);
      setMonthlyArchives(archivesData);

      // Load supplement debt data if in supplement section
      if (section === 'supplement') {
        const [debtData, transactionsData] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debtData);
        setDebtTransactions(transactionsData);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      setError('فشل في تحميل البيانات');
    }
  };

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
        image: itemForm.image || undefined,
        categoryId: itemForm.categoryId || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db_service.saveItem(item);
      
      // Log the action
      const log = {
        id: uuidv4(),
        actionType: editingItem ? 'item_updated' : 'item_created',
        itemOrShiftAffected: item.name,
        changeDetails: editingItem 
          ? `Updated item: ${item.name}` 
          : `Created new item: ${item.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetItemForm();
      setShowItemModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ المنتج:', error);
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
      
      // Log the action
      const log = {
        id: uuidv4(),
        actionType: 'item_deleted',
        itemOrShiftAffected: item.name,
        changeDetails: `Deleted item: ${item.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('خطأ في حذف المنتج:', error);
      setError('فشل في حذف المنتج');
    } finally {
      setIsLoading(false);
    }
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
      
      setCategoryForm({ name: '' });
      setEditingCategory(null);
      setShowCategoryModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ الفئة:', error);
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
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف الفئة:', error);
      setError('فشل في حذف الفئة');
    } finally {
      setIsLoading(false);
    }
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
      
      setCustomerForm({ name: '' });
      setEditingCustomer(null);
      setShowCustomerModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ العميل:', error);
      setError('فشل في حفظ العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customer.name}"؟ سيتم حذف جميع مشترياته أيضاً.`)) return;

    try {
      setIsLoading(true);
      
      // Get customer purchases to delete them
      const purchases = await db_service.getCustomerPurchases(customer.id);
      for (const purchase of purchases) {
        await db_service.deleteCustomerPurchase(purchase.id);
      }
      
      await db_service.deleteCustomer(customer.id);
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف العميل:', error);
      setError('فشل في حذف العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerDetails = async (customer: Customer) => {
    try {
      setSelectedCustomerDetails(customer);
      const purchases = await db_service.getCustomerPurchases(customer.id);
      setCustomerPurchases(purchases);
      setShowCustomerDetailsModal(true);
    } catch (error) {
      console.error('خطأ في تحميل تفاصيل العميل:', error);
      setError('فشل في تحميل تفاصيل العميل');
    }
  };

  // User operations
  const saveUser = async () => {
    if (!userForm.username || !userForm.password) {
      setError('يرجى ملء جميع الحقول');
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
      
      setUserForm({ username: '', password: '', role: 'normal' });
      setEditingUser(null);
      setShowUserModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ المستخدم:', error);
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
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف المستخدم:', error);
      setError('فشل في حذف المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  // Supply operations
  const saveSupply = async () => {
    const supplyItems: Record<string, number> = {};
    let totalCost = 0;
    let hasItems = false;

    for (const [itemId, quantityStr] of Object.entries(supplyForm)) {
      const quantity = parseInt(quantityStr);
      if (quantity > 0) {
        supplyItems[itemId] = quantity;
        hasItems = true;
        
        // Calculate cost
        const item = items.find(i => i.id === itemId);
        if (item) {
          totalCost += item.costPrice * quantity;
        }
      }
    }

    if (!hasItems) {
      setError('يرجى إدخال كمية لمنتج واحد على الأقل');
      return;
    }

    try {
      setIsLoading(true);
      
      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyItems,
        totalCost,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      // Get active shift to deduct cost
      const activeShift = await db_service.getActiveShift(section);
      await db_service.saveSupply(supply, activeShift || undefined);

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

      setSupplyForm({});
      setShowSupplyModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ التوريد:', error);
      setError('فشل في حفظ التوريد');
    } finally {
      setIsLoading(false);
    }
  };

  // Debt operations (supplement section only)
  const saveDebtTransaction = async () => {
    if (!debtForm.amount || !debtForm.note) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    try {
      setIsLoading(true);
      
      const amount = parseFloat(debtForm.amount);
      const transaction: SupplementDebtTransaction = {
        id: editingDebtTransaction?.id || uuidv4(),
        type: debtForm.type,
        amount,
        note: debtForm.note,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Update total debt
      const currentDebt = supplementDebt?.amount || 0;
      let newDebtAmount = currentDebt;

      if (editingDebtTransaction) {
        // Reverse the old transaction
        if (editingDebtTransaction.type === 'debt') {
          newDebtAmount -= editingDebtTransaction.amount;
        } else {
          newDebtAmount += editingDebtTransaction.amount;
        }
      }

      // Apply the new transaction
      if (transaction.type === 'debt') {
        newDebtAmount += amount;
      } else {
        newDebtAmount -= amount;
      }

      const updatedDebt: SupplementDebt = {
        amount: Math.max(0, newDebtAmount),
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      setDebtForm({ type: 'debt', amount: '', note: '' });
      setEditingDebtTransaction(null);
      setShowDebtModal(false);
      setShowEditDebtTransactionModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ معاملة الدين:', error);
      setError('فشل في حفظ معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDebtTransaction = async (transaction: SupplementDebtTransaction) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) return;

    try {
      setIsLoading(true);
      
      await db_service.deleteSupplementDebtTransaction(transaction.id);

      // Update total debt by reversing the transaction
      const currentDebt = supplementDebt?.amount || 0;
      let newDebtAmount = currentDebt;

      if (transaction.type === 'debt') {
        newDebtAmount -= transaction.amount;
      } else {
        newDebtAmount += transaction.amount;
      }

      const updatedDebt: SupplementDebt = {
        amount: Math.max(0, newDebtAmount),
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف معاملة الدين:', error);
      setError('فشل في حذف معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDebtTransaction = (transaction: SupplementDebtTransaction) => {
    setEditingDebtTransaction(transaction);
    setDebtForm({
      type: transaction.type,
      amount: transaction.amount.toString(),
      note: transaction.note
    });
    setShowEditDebtTransactionModal(true);
  };

  // Reset month functionality
  const resetMonth = async () => {
    if (!confirm('هل أنت متأكد من إعادة تعيين الشهر؟ سيتم أرشفة جميع البيانات الحالية وحذفها.')) return;

    try {
      setIsLoading(true);
      await db_service.resetMonth(section, user?.username || '');
      await loadData();
    } catch (error) {
      console.error('خطأ في إعادة تعيين الشهر:', error);
      setError('فشل في إعادة تعيين الشهر');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions
  const resetItemForm = () => {
    setItemForm({
      name: '',
      sellPrice: '',
      costPrice: '',
      currentAmount: '',
      image: '',
      categoryId: ''
    });
    setEditingItem(null);
  };

  const openEditItem = (item: Item) => {
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
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryModal(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({ name: customer.name });
    setShowCustomerModal(true);
  };

  const openEditUser = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setUserForm({
      username: userToEdit.username,
      password: userToEdit.password,
      role: userToEdit.role
    });
    setShowUserModal(true);
  };

  // Calculate dashboard stats
  const totalRevenue = shifts.reduce((sum, shift) => 
    sum + shift.purchases.reduce((purchaseSum, purchase) => 
      purchaseSum + (purchase.price * purchase.quantity), 0), 0);
  
  const totalCost = shifts.reduce((sum, shift) => 
    sum + shift.purchases.reduce((purchaseSum, purchase) => {
      const item = items.find(i => i.id === purchase.itemId);
      return purchaseSum + (item ? item.costPrice * purchase.quantity : 0);
    }, 0), 0);
  
  const totalProfit = totalRevenue - totalCost;
  const totalCustomerDebt = unpaidPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            لوحة تحكم المدير - {section === 'store' ? 'البار' : 'المكملات الغذائية'}
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => generateShiftsPDF(shifts, section)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>تصدير الورديات</span>
            </button>
            <button
              onClick={resetMonth}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>إعادة تعيين الشهر</span>
            </button>
          </div>
        </div>
      </div>

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
            {[
              { id: 'dashboard', label: 'لوحة التحكم', icon: BarChart3 },
              { id: 'items', label: 'المنتجات', icon: Package },
              { id: 'customers', label: 'العملاء', icon: Users },
              { id: 'shifts', label: 'الورديات', icon: FileText },
              { id: 'supplies', label: 'التوريدات', icon: Upload },
              { id: 'users', label: 'المستخدمين', icon: Users },
              { id: 'logs', label: 'سجل الأنشطة', icon: FileText },
              ...(section === 'supplement' ? [{ id: 'debt', label: 'إدارة الديون', icon: DollarSign }] : []),
              { id: 'archives', label: 'الأرشيف الشهري', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-green-50 p-6 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} جنيه</div>
                  <div className="text-sm text-green-600">إجمالي الإيرادات</div>
                </div>
                <div className="bg-red-50 p-6 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{totalCost.toFixed(2)} جنيه</div>
                  <div className="text-sm text-red-600">إجمالي التكاليف</div>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{totalProfit.toFixed(2)} جنيه</div>
                  <div className="text-sm text-blue-600">صافي الربح</div>
                </div>
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{totalCustomerDebt.toFixed(2)} جنيه</div>
                  <div className="text-sm text-yellow-600">ديون العملاء</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">المنتجات منخفضة المخزون</h3>
                  <div className="space-y-2">
                    {items.filter(item => item.currentAmount < 10).map(item => (
                      <div key={item.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                        <span>{item.name}</span>
                        <span className="text-red-600 font-semibold">{item.currentAmount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">الورديات النشطة</h3>
                  <div className="space-y-2">
                    {shifts.filter(shift => shift.status === 'active').map(shift => (
                      <div key={shift.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span>{shift.username}</span>
                        <span className="text-blue-600 font-semibold">{shift.totalAmount.toFixed(2)} جنيه</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">إدارة المنتجات</h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة فئة</span>
                  </button>
                  <button
                    onClick={() => setShowItemModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة منتج</span>
                  </button>
                </div>
              </div>

              {/* Categories */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">الفئات</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <div key={category.id} className="bg-white px-3 py-1 rounded-full flex items-center space-x-2">
                      <span>{category.name}</span>
                      <button
                        onClick={() => openEditCategory(category)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteCategory(category)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المنتج</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الفئة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سعر البيع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">سعر التكلفة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المخزون</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map(item => {
                      const category = categories.find(c => c.id === item.categoryId);
                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {item.image && (
                                <img src={item.image} alt={item.name} className="h-10 w-10 rounded-full mr-3" />
                              )}
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {category?.name || 'غير محدد'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.sellPrice} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.costPrice} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              item.currentAmount < 10 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {item.currentAmount}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => openEditItem(item)}
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
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">إدارة العملاء</h3>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة عميل</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم العميل</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي الدين</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عدد المشتريات غير المدفوعة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإنشاء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {customers.map(customer => {
                      const customerDebt = unpaidPurchases
                        .filter(p => p.customerId === customer.id)
                        .reduce((sum, p) => sum + p.totalAmount, 0);
                      const unpaidCount = unpaidPurchases.filter(p => p.customerId === customer.id).length;

                      return (
                        <tr key={customer.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {customer.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${
                              customerDebt > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {customerDebt.toFixed(2)} جنيه
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {unpaidCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {customer.createdAt.toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => openCustomerDetails(customer)}
                                className="text-blue-600 hover:text-blue-900"
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEditCustomer(customer)}
                                className="text-green-600 hover:text-green-900"
                                title="تعديل"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteCustomer(customer)}
                                className="text-red-600 hover:text-red-900"
                                title="حذف"
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
          )}

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">سجل الورديات</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">وقت البداية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">وقت النهاية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي النقدية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المصروفات</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">حالة التحقق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shifts.map(shift => (
                      <tr key={shift.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {shift.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.startTime.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشط'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.totalAmount.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            shift.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shift.status === 'active' ? 'نشط' : 'مغلق'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            shift.validationStatus === 'balanced' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {shift.validationStatus === 'balanced' ? 'متوازن' : 'يوجد تضارب'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Supplies Tab */}
          {activeTab === 'supplies' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">إدارة التوريدات</h3>
                <button
                  onClick={() => setShowSupplyModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة توريد</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المنتجات</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي التكلفة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تم بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {supplies.map(supply => (
                      <tr key={supply.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supply.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="space-y-1">
                            {Object.entries(supply.items).map(([itemId, quantity]) => {
                              const item = items.find(i => i.id === itemId);
                              return (
                                <div key={itemId}>
                                  {item?.name}: {quantity}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {supply.totalCost.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supply.createdBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">إدارة المستخدمين</h3>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة مستخدم</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الدور</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإنشاء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(userItem => (
                      <tr key={userItem.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {userItem.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            userItem.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userItem.createdAt.toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditUser(userItem)}
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
          )}

          {/* Admin Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">سجل أنشطة المدير</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع الإجراء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنصر المتأثر</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تفاصيل التغيير</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المدير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {adminLogs.map(log => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.actionType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.itemOrShiftAffected}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {log.changeDetails}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.adminName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Debt Management Tab (Supplement section only) */}
          {activeTab === 'debt' && section === 'supplement' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">إدارة ديون المكملات الغذائية</h3>
                <button
                  onClick={() => setShowDebtModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة معاملة</span>
                </button>
              </div>

              {/* Current Debt Summary */}
              <div className="bg-white border rounded-lg p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {supplementDebt?.amount.toFixed(2) || '0.00'} جنيه
                  </div>
                  <div className="text-gray-600">إجمالي الدين الحالي</div>
                  {supplementDebt && (
                    <div className="text-sm text-gray-500 mt-2">
                      آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                    </div>
                  )}
                </div>
              </div>

              {/* Debt Transactions */}
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النوع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الملاحظة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تم بواسطة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {debtTransactions.map(transaction => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.type === 'debt' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {transaction.type === 'debt' ? 'دين' : 'دفع'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.amount.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.note}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.createdBy}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditDebtTransaction(transaction)}
                              className="text-blue-600 hover:text-blue-900"
                              title="تعديل"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteDebtTransaction(transaction)}
                              className="text-red-600 hover:text-red-900"
                              title="حذف"
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
          )}

          {/* Monthly Archives Tab */}
          {activeTab === 'archives' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">الأرشيف الشهري</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الشهر</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السنة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي الإيرادات</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي التكاليف</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">صافي الربح</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عدد الورديات</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الأرشفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {monthlyArchives.map(archive => (
                      <tr key={archive.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {archive.month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {archive.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {archive.totalRevenue.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {archive.totalCost.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          {archive.totalProfit.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {archive.shiftsCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {archive.archivedAt.toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Details Modal */}
      {showCustomerDetailsModal && selectedCustomerDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">تفاصيل العميل: {selectedCustomerDetails.name}</h3>
            
            <div className="space-y-4">
              {customerPurchases.map(purchase => {
                // Calculate totals for this purchase
                let totalCost = 0;
                let totalProfit = 0;
                
                purchase.items.forEach(item => {
                  const itemData = items.find(i => i.id === item.itemId);
                  if (itemData) {
                    const itemCost = itemData.costPrice * item.quantity;
                    const itemRevenue = item.price * item.quantity;
                    totalCost += itemCost;
                    totalProfit += (itemRevenue - itemCost);
                  }
                });

                return (
                  <div key={purchase.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">المبلغ: {purchase.totalAmount.toFixed(2)} جنيه</div>
                        <div className="text-sm text-gray-600">
                          التاريخ: {purchase.timestamp.toLocaleString('ar-EG')}
                        </div>
                        <div className="text-sm text-gray-600">
                          الحالة: {purchase.isPaid ? 'مدفوع' : 'غير مدفوع'}
                        </div>
                        <div className="text-sm text-blue-600">
                          إجمالي التكلفة: {totalCost.toFixed(2)} جنيه
                        </div>
                        <div className="text-sm text-green-600">
                          إجمالي الربح: {totalProfit.toFixed(2)} جنيه
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        purchase.isPaid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {purchase.isPaid ? 'مدفوع' : 'غير مدفوع'}
                      </span>
                    </div>
                    
                    <div className="mt-2">
                      <div className="text-sm font-medium text-gray-700 mb-1">المنتجات:</div>
                      <div className="space-y-1">
                        {purchase.items.map((item, index) => {
                          const itemData = items.find(i => i.id === item.itemId);
                          const itemCost = itemData ? itemData.costPrice * item.quantity : 0;
                          const itemRevenue = item.price * item.quantity;
                          const itemProfit = itemRevenue - itemCost;

                          return (
                            <div key={index} className="text-sm text-gray-600 grid grid-cols-4 gap-4">
                              <span>{item.name} × {item.quantity}</span>
                              <span>الإيراد: {itemRevenue.toFixed(2)} جنيه</span>
                              <span>التكلفة: {itemCost.toFixed(2)} جنيه</span>
                              <span>الربح: {itemProfit.toFixed(2)} جنيه</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCustomerDetailsModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingItem ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة</label>
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
                onClick={() => {
                  setShowItemModal(false);
                  resetItemForm();
                }}
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
              {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setCategoryForm({ name: '' });
                  setEditingCategory(null);
                }}
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
              {editingCustomer ? 'تعديل العميل' : 'إضافة عميل جديد'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
              <input
                type="text"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setCustomerForm({ name: '' });
                  setEditingCustomer(null);
                }}
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
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-600">المخزون الحالي: {item.currentAmount}</div>
                    <div className="text-sm text-gray-600">سعر التكلفة: {item.costPrice} جنيه</div>
                  </div>
                  <input
                    type="number"
                    value={supplyForm[item.id] || ''}
                    onChange={(e) => setSupplyForm({
                      ...supplyForm,
                      [item.id]: e.target.value
                    })}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                    placeholder="0"
                    min="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSupplyModal(false);
                  setSupplyForm({});
                }}
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
              {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                onClick={() => {
                  setShowUserModal(false);
                  setUserForm({ username: '', password: '', role: 'normal' });
                  setEditingUser(null);
                }}
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
      {(showDebtModal || showEditDebtTransactionModal) && section === 'supplement' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingDebtTransaction ? 'تعديل معاملة الدين' : 'إضافة معاملة دين'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المعاملة</label>
                <select
                  value={debtForm.type}
                  onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as 'payment' | 'debt' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="debt">دين (إضافة دين)</option>
                  <option value="payment">دفع (تقليل الدين)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الملاحظة</label>
                <textarea
                  value={debtForm.note}
                  onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="أدخل تفاصيل المعاملة..."
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDebtModal(false);
                  setShowEditDebtTransactionModal(false);
                  setDebtForm({ type: 'debt', amount: '', note: '' });
                  setEditingDebtTransaction(null);
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveDebtTransaction}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;