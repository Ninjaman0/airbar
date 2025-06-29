import React, { useState, useEffect } from 'react';
import { Plus, Package, Users, DollarSign, Clock, AlertTriangle, CheckCircle, X, Edit, Trash2, Camera, Upload, Download, FileText, BarChart3, TrendingUp, Calendar, Archive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { Item, Shift, Supply, Category, Customer, CustomerPurchase, Expense, User, AdminLog, SupplementDebt, SupplementDebtTransaction, MonthlyArchive } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'shifts' | 'customers' | 'supplies' | 'users' | 'logs' | 'debt' | 'archives'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [debtTransactions, setDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemSellPrice, setNewItemSellPrice] = useState('');
  const [newItemCostPrice, setNewItemCostPrice] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'normal' | 'admin'>('normal');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [debtType, setDebtType] = useState<'payment' | 'debt'>('payment');
  
  // Supply form states
  const [supplyItems, setSupplyItems] = useState<Record<string, number>>({});
  const [supplyCost, setSupplyCost] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [
        itemsData,
        categoriesData,
        shiftsData,
        customersData,
        suppliesData,
        usersData,
        logsData,
        unpaidData,
        archivesData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllUsers(),
        db_service.getAllAdminLogs(),
        db_service.getUnpaidCustomerPurchases(section),
        db_service.getMonthlyArchives(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setShifts(shiftsData);
      setCustomers(customersData);
      setSupplies(suppliesData);
      setUsers(usersData);
      setAdminLogs(logsData.filter(log => !log.section || log.section === section));
      setUnpaidPurchases(unpaidData);
      setMonthlyArchives(archivesData);

      // Load supplement debt if in supplement section
      if (section === 'supplement') {
        const [debt, transactions] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debt);
        setDebtTransactions(transactions);
      }

      setError('');
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      setError('فشل في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      switch (event.type) {
        case 'ITEM_UPDATED':
        case 'SHIFT_UPDATED':
        case 'CUSTOMER_UPDATED':
        case 'EXPENSE_ADDED':
        case 'SUPPLY_ADDED':
        case 'DEBT_UPDATED':
        case 'ADMIN_LOG_ADDED':
          loadData();
          break;
      }
    }
  }, [section]);

  // Item operations
  const saveItem = async () => {
    if (!newItemName || !newItemSellPrice || !newItemCostPrice) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsLoading(true);
      const sellPrice = parseFloat(newItemSellPrice);
      const costPrice = parseFloat(newItemCostPrice);
      const amount = parseInt(newItemAmount) || 0;

      if (sellPrice <= 0 || costPrice <= 0) {
        setError('يجب أن تكون الأسعار أكبر من صفر');
        return;
      }

      const item: Item = {
        id: editingItem?.id || uuidv4(),
        name: newItemName.trim(),
        sellPrice,
        costPrice,
        currentAmount: amount,
        image: newItemImage.trim() || undefined,
        categoryId: newItemCategoryId || undefined,
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
          ? `Updated item: ${item.name} - Price: ${item.sellPrice} EGP, Cost: ${item.costPrice} EGP, Amount: ${item.currentAmount}`
          : `Created new item: ${item.name} - Price: ${item.sellPrice} EGP, Cost: ${item.costPrice} EGP, Amount: ${item.currentAmount}`,
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
      console.error('خطأ في حفظ المنتج:', error);
      setError('فشل في حفظ المنتج');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (item: Item) => {
    if (!confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) return;

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

  const openEditItemModal = (item: Item) => {
    setEditingItem(item);
    setNewItemName(item.name);
    setNewItemSellPrice(item.sellPrice.toString());
    setNewItemCostPrice(item.costPrice.toString());
    setNewItemAmount(item.currentAmount.toString());
    setNewItemImage(item.image || '');
    setNewItemCategoryId(item.categoryId || '');
    setShowItemModal(true);
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setNewItemName('');
    setNewItemSellPrice('');
    setNewItemCostPrice('');
    setNewItemAmount('');
    setNewItemImage('');
    setNewItemCategoryId('');
  };

  // Category operations
  const saveCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('يرجى إدخال اسم الفئة');
      return;
    }

    try {
      setIsLoading(true);
      const category: Category = {
        id: editingCategory?.id || uuidv4(),
        name: newCategoryName.trim(),
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db_service.saveCategory(category);

      // Log the action
      const log = {
        id: uuidv4(),
        actionType: editingCategory ? 'category_updated' : 'category_created',
        itemOrShiftAffected: category.name,
        changeDetails: editingCategory 
          ? `Updated category: ${category.name}`
          : `Created new category: ${category.name}`,
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
      console.error('خطأ في حفظ الفئة:', error);
      setError('فشل في حفظ الفئة');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!confirm(`هل أنت متأكد من حذف فئة "${category.name}"؟`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteCategory(category.id);

      // Log the action
      const log = {
        id: uuidv4(),
        actionType: 'category_deleted',
        itemOrShiftAffected: category.name,
        changeDetails: `Deleted category: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };

      await db_service.saveAdminLog(log);
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف الفئة:', error);
      setError('فشل في حذف الفئة');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditCategoryModal = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setShowCategoryModal(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setNewCategoryName('');
  };

  // Supply operations
  const saveSupply = async () => {
    const totalItems = Object.values(supplyItems).reduce((sum, qty) => sum + qty, 0);
    const cost = parseFloat(supplyCost);

    if (totalItems === 0 || !cost || cost <= 0) {
      setError('يرجى إضافة منتجات وتحديد التكلفة');
      return;
    }

    try {
      setIsLoading(true);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyItems)) {
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

      // Create supply record
      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyItems,
        totalCost: cost,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      // Get active shift to deduct cost
      const activeShift = await db_service.getActiveShift(section);
      await db_service.saveSupply(supply, activeShift || undefined);

      // Log the action
      const itemNames = Object.entries(supplyItems)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = items.find(i => i.id === itemId);
          return `${item?.name}: ${qty}`;
        })
        .join(', ');

      const log = {
        id: uuidv4(),
        actionType: 'supply_added',
        itemOrShiftAffected: 'Inventory Supply',
        changeDetails: `Added supply - Items: ${itemNames}, Total Cost: ${cost} EGP`,
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
      console.error('خطأ في حفظ التوريد:', error);
      setError('فشل في حفظ التوريد');
    } finally {
      setIsLoading(false);
    }
  };

  const resetSupplyForm = () => {
    setSupplyItems({});
    setSupplyCost('');
  };

  // User operations
  const saveUser = async () => {
    if (!newUserUsername.trim() || !newUserPassword.trim()) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    try {
      setIsLoading(true);
      const newUser: User = {
        id: editingUser?.id || uuidv4(),
        username: newUserUsername.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
        createdAt: editingUser?.createdAt || new Date()
      };

      if (editingUser) {
        await db_service.updateUser(newUser);
      } else {
        await db_service.createUser(newUser);
      }

      // Log the action
      const log = {
        id: uuidv4(),
        actionType: editingUser ? 'user_updated' : 'user_created',
        itemOrShiftAffected: newUser.username,
        changeDetails: editingUser 
          ? `Updated user: ${newUser.username} (${newUser.role})`
          : `Created new user: ${newUser.username} (${newUser.role})`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: undefined
      };

      await db_service.saveAdminLog(log);

      resetUserForm();
      setShowUserModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ المستخدم:', error);
      setError('فشل في حفظ المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (userToDelete.id === user?.id) {
      setError('لا يمكن حذف المستخدم الحالي');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteUser(userToDelete.id);

      // Log the action
      const log = {
        id: uuidv4(),
        actionType: 'user_deleted',
        itemOrShiftAffected: userToDelete.username,
        changeDetails: `Deleted user: ${userToDelete.username}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: undefined
      };

      await db_service.saveAdminLog(log);
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف المستخدم:', error);
      setError('فشل في حذف المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditUserModal = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setNewUserUsername(userToEdit.username);
    setNewUserPassword(userToEdit.password);
    setNewUserRole(userToEdit.role);
    setShowUserModal(true);
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserRole('normal');
  };

  // Supplement debt operations
  const saveDebtTransaction = async () => {
    if (!debtAmount || !debtNote.trim()) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    const amount = parseFloat(debtAmount);
    if (amount <= 0) {
      setError('يجب أن يكون المبلغ أكبر من صفر');
      return;
    }

    try {
      setIsLoading(true);

      // Create transaction
      const transaction: SupplementDebtTransaction = {
        id: uuidv4(),
        type: debtType,
        amount,
        note: debtNote.trim(),
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Update debt amount
      const currentDebt = supplementDebt?.amount || 0;
      const newDebtAmount = debtType === 'debt' 
        ? currentDebt + amount 
        : Math.max(0, currentDebt - amount);

      const updatedDebt: SupplementDebt = {
        amount: newDebtAmount,
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      // Log the action
      const log = {
        id: uuidv4(),
        actionType: 'debt_transaction',
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `${debtType === 'debt' ? 'Added debt' : 'Payment received'}: ${amount} EGP - ${debtNote}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };

      await db_service.saveAdminLog(log);

      setDebtAmount('');
      setDebtNote('');
      setShowDebtModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ معاملة الدين:', error);
      setError('فشل في حفظ معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  // Month reset operation
  const resetMonth = async () => {
    if (!confirm('هل أنت متأكد من إعادة تعيين الشهر؟ سيتم حذف جميع الورديات والمبيعات!')) return;

    try {
      setIsLoading(true);
      await db_service.resetMonth(section, user?.username || '');
      setShowResetModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في إعادة تعيين الشهر:', error);
      setError('فشل في إعادة تعيين الشهر');
    } finally {
      setIsLoading(false);
    }
  };

  // PDF generation
  const generateShiftsPDFReport = () => {
    generateShiftsPDF(shifts, section);
  };

  const generateMonthlySummaryPDFReport = () => {
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    generateMonthlySummaryPDF(shifts, items, section, currentMonth);
  };

  // Calculate dashboard stats
  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      shiftDate.setHours(0, 0, 0, 0);
      return shiftDate.getTime() === today.getTime();
    });

    const todayRevenue = todayShifts.reduce((sum, shift) => 
      sum + shift.purchases.reduce((total, p) => total + (p.price * p.quantity), 0), 0
    );

    const todayCost = todayShifts.reduce((sum, shift) => {
      return sum + shift.purchases.reduce((total, p) => {
        const item = items.find(i => i.id === p.itemId);
        return total + (item ? item.costPrice * p.quantity : 0);
      }, 0);
    }, 0);

    const todayProfit = todayRevenue - todayCost;

    const activeShift = shifts.find(shift => shift.status === 'active');

    const monthlyRevenue = shifts.reduce((sum, shift) => 
      sum + shift.purchases.reduce((total, p) => total + (p.price * p.quantity), 0), 0
    );

    const totalCustomerDebt = unpaidPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

    // Top selling items
    const itemSales: Record<string, { quantity: number; revenue: number; name: string }> = {};
    shifts.forEach(shift => {
      shift.purchases.forEach(purchase => {
        if (!itemSales[purchase.itemId]) {
          itemSales[purchase.itemId] = {
            quantity: 0,
            revenue: 0,
            name: purchase.name
          };
        }
        itemSales[purchase.itemId].quantity += purchase.quantity;
        itemSales[purchase.itemId].revenue += purchase.price * purchase.quantity;
      });
    });

    const topSellingItems = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      todayProfit,
      activeShift: !!activeShift,
      topSellingItems,
      monthlyRevenue,
      totalCustomers: customers.length,
      pendingCustomerDebt: totalCustomerDebt
    };
  };

  const stats = calculateStats();

  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            لوحة تحكم المدير - {section === 'store' ? 'البار' : 'المكملات الغذائية'}
          </h1>
          <div className="flex space-x-4">
            <button
              onClick={generateShiftsPDFReport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>تقرير الورديات</span>
            </button>
            <button
              onClick={generateMonthlySummaryPDFReport}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>تقرير شهري</span>
            </button>
            <button
              onClick={() => setShowResetModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Archive className="h-4 w-4" />
              <span>إعادة تعيين الشهر</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'dashboard', label: 'لوحة التحكم', icon: BarChart3 },
            { id: 'items', label: 'المنتجات', icon: Package },
            { id: 'shifts', label: 'الورديات', icon: Clock },
            { id: 'customers', label: 'العملاء', icon: Users },
            { id: 'supplies', label: 'التوريدات', icon: Upload },
            { id: 'users', label: 'المستخدمين', icon: Users },
            { id: 'logs', label: 'السجلات', icon: FileText },
            ...(section === 'supplement' ? [{ id: 'debt', label: 'الديون', icon: DollarSign }] : []),
            { id: 'archives', label: 'الأرشيف', icon: Archive }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.todayProfit.toFixed(2)} جنيه
                  </div>
                  <div className="text-sm text-gray-600">ربح اليوم</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.monthlyRevenue.toFixed(2)} جنيه
                  </div>
                  <div className="text-sm text-gray-600">إيرادات الشهر</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.totalCustomers}
                  </div>
                  <div className="text-sm text-gray-600">إجمالي العملاء</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stats.activeShift ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Clock className={`h-6 w-6 ${stats.activeShift ? 'text-green-600' : 'text-gray-600'}`} />
                </div>
                <div className="ml-4">
                  <div className="text-lg font-bold text-gray-900">
                    {stats.activeShift ? 'نشطة' : 'مغلقة'}
                  </div>
                  <div className="text-sm text-gray-600">حالة الوردية</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.pendingCustomerDebt.toFixed(2)} جنيه
                  </div>
                  <div className="text-sm text-gray-600">ديون العملاء</div>
                </div>
              </div>
            </div>

            {section === 'supplement' && supplementDebt && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <DollarSign className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {supplementDebt.amount.toFixed(2)} جنيه
                    </div>
                    <div className="text-sm text-gray-600">دين المكملات</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Selling Items */}
          {stats.topSellingItems.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">أكثر المنتجات مبيعاً</h3>
              <div className="space-y-3">
                {stats.topSellingItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-600">
                        {item.quantity} قطعة مباعة
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {item.revenue.toFixed(2)} جنيه
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إدارة المنتجات</h3>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
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
            {categories.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">الفئات</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {categories.map(category => (
                    <div key={category.id} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="font-medium">{category.name}</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditCategoryModal(category)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCategory(category)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map(item => (
                <div key={item.id} className="border rounded-lg p-4">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                  )}
                  <div className="space-y-2">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-600">
                      سعر البيع: {item.sellPrice} جنيه
                    </div>
                    <div className="text-sm text-gray-600">
                      سعر التكلفة: {item.costPrice} جنيه
                    </div>
                    <div className={`text-sm ${item.currentAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      المخزون: {item.currentAmount}
                    </div>
                    {item.categoryId && (
                      <div className="text-xs text-purple-600">
                        {categories.find(c => c.id === item.categoryId)?.name}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => openEditItemModal(item)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">سجل الورديات</h3>
          <div className="space-y-4">
            {shifts.map(shift => (
              <div key={shift.id} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">المستخدم</div>
                    <div className="font-medium">{shift.username}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">بداية الوردية</div>
                    <div className="font-medium">
                      {shift.startTime.toLocaleString('ar-EG')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">نهاية الوردية</div>
                    <div className="font-medium">
                      {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">إجمالي النقدية</div>
                    <div className="font-medium text-green-600">
                      {shift.totalAmount.toFixed(2)} جنيه
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">المنتجات المباعة</div>
                    <div className="font-medium">
                      {shift.purchases.reduce((sum, p) => sum + p.quantity, 0)} قطعة
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">المصروفات</div>
                    <div className="font-medium text-red-600">
                      {shift.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} جنيه
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">حالة التحقق</div>
                    <div className={`font-medium ${
                      shift.validationStatus === 'balanced' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {shift.validationStatus === 'balanced' ? 'متوازن' : 'يوجد تضارب'}
                    </div>
                  </div>
                </div>

                {shift.discrepancies && shift.discrepancies.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg">
                    <div className="text-sm font-medium text-red-800 mb-2">التضاربات:</div>
                    <ul className="text-sm text-red-700 space-y-1">
                      {shift.discrepancies.map((discrepancy, index) => (
                        <li key={index}>• {discrepancy}</li>
                      ))}
                    </ul>
                    {shift.closeReason && (
                      <div className="mt-2 text-sm text-red-700">
                        <strong>سبب الإغلاق:</strong> {shift.closeReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">إدارة العملاء</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map(customer => {
              const customerDebt = unpaidPurchases
                .filter(p => p.customerId === customer.id)
                .reduce((sum, p) => sum + p.totalAmount, 0);

              return (
                <div key={customer.id} className="border rounded-lg p-4">
                  <div className="font-medium text-gray-900 mb-2">{customer.name}</div>
                  <div className="text-sm text-gray-600 mb-2">
                    تاريخ الإنشاء: {customer.createdAt.toLocaleDateString('ar-EG')}
                  </div>
                  {customerDebt > 0 && (
                    <div className="text-sm text-red-600 font-medium">
                      الدين: {customerDebt.toFixed(2)} جنيه
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Supplies Tab */}
      {activeTab === 'supplies' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إدارة التوريدات</h3>
              <button
                onClick={() => setShowSupplyModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة توريد</span>
              </button>
            </div>

            <div className="space-y-4">
              {supplies.map(supply => (
                <div key={supply.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">التاريخ</div>
                      <div className="font-medium">
                        {supply.timestamp.toLocaleString('ar-EG')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">التكلفة الإجمالية</div>
                      <div className="font-medium text-green-600">
                        {supply.totalCost.toFixed(2)} جنيه
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">تم بواسطة</div>
                      <div className="font-medium">{supply.createdBy}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="text-sm text-gray-600 mb-2">المنتجات المضافة:</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(supply.items).map(([itemId, quantity]) => {
                        const item = items.find(i => i.id === itemId);
                        return (
                          <div key={itemId} className="text-sm bg-gray-50 p-2 rounded">
                            {item?.name}: {quantity}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">إدارة المستخدمين</h3>
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة مستخدم</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(userItem => (
              <div key={userItem.id} className="border rounded-lg p-4">
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">{userItem.username}</div>
                  <div className={`text-sm px-2 py-1 rounded-full inline-block ${
                    userItem.role === 'admin' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                  </div>
                  <div className="text-sm text-gray-600">
                    تاريخ الإنشاء: {userItem.createdAt.toLocaleDateString('ar-EG')}
                  </div>
                </div>
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => openEditUserModal(userItem)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm"
                  >
                    تعديل
                  </button>
                  {userItem.id !== user?.id && (
                    <button
                      onClick={() => deleteUser(userItem)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">سجل أعمال المدير</h3>
          <div className="space-y-4">
            {adminLogs.map(log => (
              <div key={log.id} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">نوع العملية</div>
                    <div className="font-medium">{log.actionType}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">العنصر المتأثر</div>
                    <div className="font-medium">{log.itemOrShiftAffected}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">المدير</div>
                    <div className="font-medium">{log.adminName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">التاريخ</div>
                    <div className="font-medium">
                      {log.timestamp.toLocaleString('ar-EG')}
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-sm text-gray-600">تفاصيل التغيير:</div>
                  <div className="text-sm text-gray-800 mt-1">{log.changeDetails}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplement Debt Tab */}
      {activeTab === 'debt' && section === 'supplement' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">إدارة ديون المكملات الغذائية</h3>
              <button
                onClick={() => setShowDebtModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة معاملة</span>
              </button>
            </div>

            {/* Current Debt */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {supplementDebt?.amount.toFixed(2) || '0.00'} جنيه
                </div>
                <div className="text-sm text-red-600">إجمالي الدين الحالي</div>
                {supplementDebt && (
                  <div className="text-xs text-gray-600 mt-2">
                    آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                  </div>
                )}
              </div>
            </div>

            {/* Debt Transactions */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">سجل المعاملات</h4>
              {debtTransactions.map(transaction => (
                <div key={transaction.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">نوع المعاملة</div>
                      <div className={`font-medium ${
                        transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'payment' ? 'دفعة' : 'دين جديد'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">المبلغ</div>
                      <div className={`font-medium ${
                        transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.amount.toFixed(2)} جنيه
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">تم بواسطة</div>
                      <div className="font-medium">{transaction.createdBy}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">التاريخ</div>
                      <div className="font-medium">
                        {transaction.timestamp.toLocaleString('ar-EG')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm text-gray-600">الملاحظة:</div>
                    <div className="text-sm text-gray-800 mt-1">{transaction.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Archives Tab */}
      {activeTab === 'archives' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">أرشيف الشهور</h3>
          <div className="space-y-4">
            {monthlyArchives.map(archive => (
              <div key={archive.id} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">الشهر</div>
                    <div className="font-medium">{archive.month} {archive.year}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">إجمالي الربح</div>
                    <div className="font-medium text-green-600">
                      {archive.totalProfit.toFixed(2)} جنيه
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">عدد الورديات</div>
                    <div className="font-medium">{archive.shiftsCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">تاريخ الأرشفة</div>
                    <div className="font-medium">
                      {archive.archivedAt.toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">إجمالي التكلفة</div>
                    <div className="font-medium text-red-600">
                      {archive.totalCost.toFixed(2)} جنيه
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">إجمالي الإيرادات</div>
                    <div className="font-medium text-blue-600">
                      {archive.totalRevenue.toFixed(2)} جنيه
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">أرشف بواسطة</div>
                    <div className="font-medium">{archive.archivedBy}</div>
                  </div>
                </div>

                {/* Top sold items in this archive */}
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">أكثر المنتجات مبيعاً:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(archive.itemsSold)
                      .sort(([,a], [,b]) => b.quantity - a.quantity)
                      .slice(0, 8)
                      .map(([itemId, data]) => (
                        <div key={itemId} className="text-sm bg-gray-50 p-2 rounded">
                          <div className="font-medium">{data.name}</div>
                          <div className="text-xs text-gray-600">
                            {data.quantity} قطعة - {data.revenue.toFixed(2)} جنيه
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingItem ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المنتج"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (جنيه)</label>
                <input
                  type="number"
                  value={newItemSellPrice}
                  onChange={(e) => setNewItemSellPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة (جنيه)</label>
                <input
                  type="number"
                  value={newItemCostPrice}
                  onChange={(e) => setNewItemCostPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الحالية</label>
                <input
                  type="number"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة (اختياري)</label>
                <input
                  type="url"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة (اختياري)</label>
                <select
                  value={newItemCategoryId}
                  onChange={(e) => setNewItemCategoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">بدون فئة</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
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
                {isLoading ? 'جاري الحفظ...' : editingItem ? 'تحديث' : 'إضافة'}
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
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="أدخل اسم الفئة"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  resetCategoryForm();
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveCategory}
                disabled={isLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : editingCategory ? 'تحديث' : 'إضافة'}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">المنتجات</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">
                          المخزون الحالي: {item.currentAmount}
                        </div>
                      </div>
                      <input
                        type="number"
                        value={supplyItems[item.id] || 0}
                        onChange={(e) => setSupplyItems({
                          ...supplyItems,
                          [item.id]: parseInt(e.target.value) || 0
                        })}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة الإجمالية (جنيه)</label>
                <input
                  type="number"
                  value={supplyCost}
                  onChange={(e) => setSupplyCost(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSupplyModal(false);
                  resetSupplyForm();
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveSupply}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'إضافة توريد'}
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
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المستخدم"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'normal' | 'admin')}
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
                  resetUserForm();
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
                {isLoading ? 'جاري الحفظ...' : editingUser ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && section === 'supplement' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة معاملة دين</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المعاملة</label>
                <select
                  value={debtType}
                  onChange={(e) => setDebtType(e.target.value as 'payment' | 'debt')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="payment">دفعة (تقليل الدين)</option>
                  <option value="debt">دين جديد (زيادة الدين)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الملاحظة</label>
                <textarea
                  value={debtNote}
                  onChange={(e) => setDebtNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="أدخل ملاحظة حول هذه المعاملة"
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
                onClick={saveDebtTransaction}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'إضافة معاملة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Month Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600">تحذير: إعادة تعيين الشهر</h3>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-800">
                  <strong>تحذير:</strong> هذه العملية ستقوم بما يلي:
                </div>
                <ul className="text-sm text-red-700 mt-2 space-y-1">
                  <li>• أرشفة جميع بيانات الشهر الحالي</li>
                  <li>• حذف جميع الورديات والمبيعات</li>
                  <li>• حذف جميع المصروفات والأموال الخارجية</li>
                  <li>• حذف جميع مشتريات العملاء</li>
                  <li>• <strong>لا يمكن التراجع عن هذه العملية!</strong></li>
                </ul>
              </div>
              <div className="text-sm text-gray-600">
                سيتم حفظ ملخص الشهر في الأرشيف قبل الحذف.
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={resetMonth}
                disabled={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري إعادة التعيين...' : 'تأكيد إعادة التعيين'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;