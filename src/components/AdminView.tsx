import React, { useState, useEffect } from 'react';
import { 
  Package, Users, DollarSign, TrendingUp, Calendar, FileText, 
  Plus, Edit, Trash2, Save, X, Upload, Download, RotateCcw,
  AlertTriangle, CheckCircle, Clock, Eye, Settings, Archive
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { 
  Item, Category, Customer, Shift, Supply, AdminLog, 
  SupplementDebt, SupplementDebtTransaction, MonthlyArchive,
  CustomerPurchase, Expense, ExternalMoney
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [supplementDebtTransactions, setSupplementDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [showResetMonthModal, setShowResetMonthModal] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  
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
  
  const [supplyForm, setSupplyForm] = useState<Record<string, string>>({});
  const [debtForm, setDebtForm] = useState({
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
        suppliesData, logsData, archivesData, activeShiftData, unpaidData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllAdminLogs(),
        db_service.getMonthlyArchives(section),
        db_service.getActiveShift(section),
        db_service.getUnpaidCustomerPurchases(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setAdminLogs(logsData.filter(log => !log.section || log.section === section));
      setMonthlyArchives(archivesData);
      setActiveShift(activeShiftData);
      setUnpaidPurchases(unpaidData);

      // Initialize supply form
      const supplyFormData: Record<string, string> = {};
      itemsData.forEach(item => {
        supplyFormData[item.id] = '0';
      });
      setSupplyForm(supplyFormData);

      // Load supplement debt if in supplement section
      if (section === 'supplement') {
        const [debtData, transactionsData] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debtData);
        setSupplementDebtTransactions(transactionsData);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
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
        image: itemForm.image || undefined,
        categoryId: itemForm.categoryId || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db_service.saveItem(item);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingItem ? 'item_updated' : 'item_created',
        itemOrShiftAffected: item.name,
        changeDetails: editingItem 
          ? `تم تحديث المنتج: ${item.name}`
          : `تم إنشاء منتج جديد: ${item.name}`,
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

      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'item_deleted',
        itemOrShiftAffected: item.name,
        changeDetails: `تم حذف المنتج: ${item.name}`,
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

      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingCategory ? 'category_updated' : 'category_created',
        itemOrShiftAffected: category.name,
        changeDetails: editingCategory 
          ? `تم تحديث الفئة: ${category.name}`
          : `تم إنشاء فئة جديدة: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetCategoryForm();
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

      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'category_deleted',
        itemOrShiftAffected: category.name,
        changeDetails: `تم حذف الفئة: ${category.name}`,
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

  const resetCategoryForm = () => {
    setCategoryForm({ name: '' });
    setEditingCategory(null);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryModal(true);
  };

  // Supply operations
  const addSupply = async () => {
    const itemsToSupply = Object.entries(supplyForm)
      .filter(([_, quantity]) => parseInt(quantity) > 0)
      .reduce((acc, [itemId, quantity]) => {
        acc[itemId] = parseInt(quantity);
        return acc;
      }, {} as Record<string, number>);

    if (Object.keys(itemsToSupply).length === 0) {
      setError('يرجى إدخال كميات صالحة للتوريد');
      return;
    }

    try {
      setIsLoading(true);

      // Calculate total cost
      let totalCost = 0;
      for (const [itemId, quantity] of Object.entries(itemsToSupply)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          totalCost += item.costPrice * quantity;
        }
      }

      const supply: Supply = {
        id: uuidv4(),
        section,
        items: itemsToSupply,
        totalCost,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      // Save supply with active shift for expense deduction
      await db_service.saveSupply(supply, activeShift || undefined);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(itemsToSupply)) {
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

      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'supply_added',
        itemOrShiftAffected: 'مخزون',
        changeDetails: `تم إضافة توريد بقيمة ${totalCost.toFixed(2)} جنيه`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      // Reset form
      const resetForm: Record<string, string> = {};
      items.forEach(item => {
        resetForm[item.id] = '0';
      });
      setSupplyForm(resetForm);
      setShowSupplyModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في إضافة التوريد:', error);
      setError('فشل في إضافة التوريد');
    } finally {
      setIsLoading(false);
    }
  };

  // Supplement debt operations
  const saveDebtTransaction = async () => {
    if (!debtForm.amount || !debtForm.note) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    try {
      setIsLoading(true);

      const transaction: SupplementDebtTransaction = {
        id: uuidv4(),
        type: debtForm.type,
        amount: parseFloat(debtForm.amount),
        note: debtForm.note,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Update debt amount
      const currentDebt = supplementDebt?.amount || 0;
      const newAmount = debtForm.type === 'debt' 
        ? currentDebt + transaction.amount
        : currentDebt - transaction.amount;

      const updatedDebt: SupplementDebt = {
        amount: Math.max(0, newAmount),
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'debt_transaction',
        itemOrShiftAffected: 'ديون المكملات',
        changeDetails: `${debtForm.type === 'debt' ? 'إضافة دين' : 'دفع'}: ${transaction.amount} جنيه - ${transaction.note}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setDebtForm({ type: 'payment', amount: '', note: '' });
      setShowDebtModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ معاملة الدين:', error);
      setError('فشل في حفظ معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  // Customer operations
  const openCustomerDetails = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);
      const purchases = await db_service.getCustomerPurchases(customer.id);
      setCustomerPurchases(purchases);
      setShowCustomerDetailsModal(true);
    } catch (error) {
      console.error('خطأ في تحميل تفاصيل العميل:', error);
      setError('فشل في تحميل تفاصيل العميل');
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customer.name}" وجميع بياناته؟`)) return;

    try {
      setIsLoading(true);

      // Delete customer purchases
      const purchases = await db_service.getCustomerPurchases(customer.id);
      for (const purchase of purchases) {
        const { error } = await supabase
          .from('customer_purchases')
          .delete()
          .eq('id', purchase.id);
        if (error) throw error;
      }

      // Delete customer
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);
      if (error) throw error;

      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'customer_deleted',
        itemOrShiftAffected: customer.name,
        changeDetails: `تم حذف العميل: ${customer.name} وجميع مشترياته`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('خطأ في حذف العميل:', error);
      setError('فشل في حذف العميل');
    } finally {
      setIsLoading(false);
    }
  };

  // Month reset operation
  const resetMonth = async () => {
    if (!confirm(`هل أنت متأكد من إعادة تعيين شهر ${section === 'store' ? 'البار' : 'المكملات الغذائية'}؟ سيتم أرشفة جميع البيانات الحالية.`)) return;

    try {
      setIsLoading(true);
      await db_service.resetMonth(section, user?.username || '');
      setShowResetMonthModal(false);
      await loadData();
      setError('');
    } catch (error) {
      console.error('خطأ في إعادة تعيين الشهر:', error);
      setError('فشل في إعادة تعيين الشهر');
    } finally {
      setIsLoading(false);
    }
  };

  // Shift details
  const openShiftDetails = async (shift: Shift) => {
    try {
      const fullShift = await db_service.getShift(shift.id);
      if (fullShift) {
        setSelectedShift(fullShift);
        setShowShiftDetailsModal(true);
      }
    } catch (error) {
      console.error('خطأ في تحميل تفاصيل الوردية:', error);
      setError('فشل في تحميل تفاصيل الوردية');
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const today = new Date();
    const todayShifts = shifts.filter(shift => 
      shift.startTime.toDateString() === today.toDateString()
    );

    let todayProfit = 0;
    let monthlyRevenue = 0;
    const topSellingItems: Record<string, { name: string; quantity: number; revenue: number }> = {};

    shifts.forEach(shift => {
      shift.purchases.forEach(purchase => {
        const item = items.find(i => i.id === purchase.itemId);
        if (item) {
          const revenue = purchase.price * purchase.quantity;
          const cost = item.costPrice * purchase.quantity;
          const profit = revenue - cost;

          if (shift.startTime.toDateString() === today.toDateString()) {
            todayProfit += profit;
          }

          if (shift.startTime.getMonth() === today.getMonth()) {
            monthlyRevenue += revenue;
          }

          if (!topSellingItems[purchase.itemId]) {
            topSellingItems[purchase.itemId] = {
              name: purchase.name,
              quantity: 0,
              revenue: 0
            };
          }
          topSellingItems[purchase.itemId].quantity += purchase.quantity;
          topSellingItems[purchase.itemId].revenue += revenue;
        }
      });
    });

    const topItems = Object.values(topSellingItems)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const totalCustomers = customers.length;
    const pendingCustomerDebt = unpaidPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

    return {
      todayProfit,
      activeShift: !!activeShift,
      topSellingItems: topItems,
      monthlyRevenue,
      totalCustomers,
      pendingCustomerDebt
    };
  };

  const stats = calculateStats();

  const renderInventoryTab = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{items.length}</div>
              <div className="text-sm text-gray-600">إجمالي المنتجات</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{stats.todayProfit.toFixed(2)}</div>
              <div className="text-sm text-gray-600">ربح اليوم (جنيه)</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{stats.monthlyRevenue.toFixed(2)}</div>
              <div className="text-sm text-gray-600">إيرادات الشهر (جنيه)</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Users className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="mr-4">
              <div className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</div>
              <div className="text-sm text-gray-600">إجمالي العملاء</div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">الفئات</h3>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة فئة</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map(category => (
            <div key={category.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{category.name}</div>
                  <div className="text-sm text-gray-600">
                    {items.filter(i => i.categoryId === category.id).length} منتج
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditCategory(category)}
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
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">المنتجات</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowSupplyModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>إضافة توريد</span>
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المنتج
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الفئة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  سعر البيع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  سعر التكلفة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الكمية الحالية
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
                      <div className="flex items-center">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-10 w-10 rounded-full object-cover ml-4"
                          />
                        )}
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {category?.name || 'بدون فئة'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.sellPrice} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.costPrice} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.currentAmount > 10 
                          ? 'bg-green-100 text-green-800'
                          : item.currentAmount > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
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
    </div>
  );

  const renderCustomersTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">العملاء</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم العميل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  إجمالي الدين
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map(customer => {
                const customerDebt = unpaidPurchases
                  .filter(p => p.customerId === customer.id)
                  .reduce((sum, p) => sum + p.totalAmount, 0);

                return (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openCustomerDetails(customer)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {customer.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customerDebt.toFixed(2)} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openCustomerDetails(customer)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          عرض التفاصيل
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          حذف العميل
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

  const renderShiftsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">تاريخ الورديات</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowResetMonthModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>إعادة تعيين الشهر</span>
            </button>
            <button
              onClick={() => generateShiftsPDF(shifts, section)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>تصدير PDF</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  معرف الوردية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ البداية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ النهاية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  إجمالي النقدية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المنتجات المباعة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  حالة التحقق
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.map(shift => (
                <tr key={shift.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {shift.id.substring(0, 8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.startTime.toLocaleString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.totalAmount.toFixed(2)} جنيه
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.purchases.reduce((sum, p) => sum + p.quantity, 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.validationStatus === 'balanced'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {shift.validationStatus === 'balanced' ? 'متوازنة' : 'تضارب'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => openShiftDetails(shift)}
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

      {/* Monthly Archives */}
      {monthlyArchives.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">أرشيف الشهور</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الشهر
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    السنة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    إجمالي الربح
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    إجمالي الإيرادات
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    عدد الورديات
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تاريخ الأرشفة
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyArchives.map(archive => (
                  <tr key={archive.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {archive.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {archive.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {archive.totalProfit.toFixed(2)} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {archive.totalRevenue.toFixed(2)} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {archive.shiftsCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
  );

  const renderSupplementDebtTab = () => {
    if (section !== 'supplement') return null;

    const currentDebt = supplementDebt?.amount || 0;

    return (
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

          {/* Current Debt Display */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-800">{currentDebt.toFixed(2)} جنيه</div>
              <div className="text-sm text-yellow-600">إجمالي الدين الحالي</div>
              {supplementDebt && (
                <div className="text-xs text-yellow-500 mt-1">
                  آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                </div>
              )}
            </div>
          </div>

          {/* Transactions History */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    النوع
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المبلغ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الملاحظة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    التاريخ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    بواسطة
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {supplementDebtTransactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'payment'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'payment' ? 'دفع' : 'دين'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.amount.toFixed(2)} جنيه
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.note}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.timestamp.toLocaleString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.createdBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminLogsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">سجل الإجراءات الإدارية</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع الإجراء
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  العنصر المتأثر
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تفاصيل التغيير
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المدير
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {adminLogs.map(log => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.actionType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.itemOrShiftAffected}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.changeDetails}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.timestamp.toLocaleString('ar-EG')}
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
  );

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError('')}
            className="float-left text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'inventory', label: 'المخزون', icon: Package },
              { id: 'customers', label: 'العملاء', icon: Users },
              { id: 'shifts', label: 'الورديات', icon: Clock },
              ...(section === 'supplement' ? [{ id: 'debt', label: 'الديون', icon: DollarSign }] : []),
              { id: 'logs', label: 'السجل', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && renderInventoryTab()}
          {activeTab === 'customers' && renderCustomersTab()}
          {activeTab === 'shifts' && renderShiftsTab()}
          {activeTab === 'debt' && renderSupplementDebtTab()}
          {activeTab === 'logs' && renderAdminLogsTab()}
        </div>
      </div>

      {/* Modals */}
      
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
                  placeholder="أدخل اسم المنتج"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (جنيه)</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة (جنيه)</label>
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
            
            <div className="space-y-4">
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
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">إضافة توريد جديد</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">
                          الكمية الحالية: {item.currentAmount}
                        </div>
                        <div className="text-sm text-gray-600">
                          سعر التكلفة: {item.costPrice} جنيه
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        كمية التوريد
                      </label>
                      <input
                        type="number"
                        value={supplyForm[item.id] || '0'}
                        onChange={(e) => setSupplyForm({
                          ...supplyForm,
                          [item.id]: e.target.value
                        })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        min="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Cost Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-800">
                    {Object.entries(supplyForm)
                      .reduce((total, [itemId, quantity]) => {
                        const item = items.find(i => i.id === itemId);
                        return total + (item ? item.costPrice * parseInt(quantity || '0') : 0);
                      }, 0)
                      .toFixed(2)} جنيه
                  </div>
                  <div className="text-sm text-blue-600">إجمالي تكلفة التوريد</div>
                  {activeShift && (
                    <div className="text-xs text-blue-500 mt-1">
                      سيتم خصم هذا المبلغ من الوردية النشطة كمصروف
                    </div>
                  )}
                </div>
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
                onClick={addSupply}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الإضافة...' : 'إضافة التوريد'}
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
                  value={debtForm.type}
                  onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as 'payment' | 'debt' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="payment">دفع</option>
                  <option value="debt">دين جديد</option>
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
                {isLoading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Month Modal */}
      {showResetMonthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إعادة تعيين الشهر</h3>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 ml-2" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium">تحذير!</div>
                    <div>سيتم أرشفة جميع الورديات والبيانات الحالية وإعادة تعيين النظام للشهر الجديد.</div>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <div className="font-medium mb-2">ما سيحدث:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>أرشفة جميع الورديات الحالية</li>
                  <li>حفظ إحصائيات الشهر</li>
                  <li>الاحتفاظ بالمخزون الحالي</li>
                  <li>الاحتفاظ بقائمة العملاء</li>
                  <li>مسح تاريخ الورديات</li>
                </ul>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowResetMonthModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={resetMonth}
                disabled={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري إعادة التعيين...' : 'إعادة تعيين الشهر'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetailsModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">تفاصيل الوردية</h3>
            
            <div className="space-y-6">
              {/* Shift Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">ملخص الوردية</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">معرف الوردية</div>
                    <div className="font-medium">{selectedShift.id.substring(0, 8)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">تاريخ البداية</div>
                    <div className="font-medium">{selectedShift.startTime.toLocaleString('ar-EG')}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">تاريخ النهاية</div>
                    <div className="font-medium">
                      {selectedShift.endTime ? selectedShift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">إجمالي النقدية</div>
                    <div className="font-medium">{selectedShift.totalAmount.toFixed(2)} جنيه</div>
                  </div>
                  <div>
                    <div className="text-gray-600">المنتجات المباعة</div>
                    <div className="font-medium">
                      {selectedShift.purchases.reduce((sum, p) => sum + p.quantity, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">حالة التحقق</div>
                    <div className={`font-medium ${
                      selectedShift.validationStatus === 'balanced' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedShift.validationStatus === 'balanced' ? 'متوازنة' : 'تضارب'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">فتح بواسطة</div>
                    <div className="font-medium">{selectedShift.username}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">أغلق بواسطة</div>
                    <div className="font-medium">
                      {selectedShift.status === 'closed' ? selectedShift.username : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchases */}
              {selectedShift.purchases.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">المبيعات</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">المنتج</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الكمية</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">السعر</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedShift.purchases.map((purchase, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm">{purchase.name}</td>
                            <td className="px-4 py-2 text-sm">{purchase.quantity}</td>
                            <td className="px-4 py-2 text-sm">{purchase.price} جنيه</td>
                            <td className="px-4 py-2 text-sm">{(purchase.price * purchase.quantity).toFixed(2)} جنيه</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Expenses */}
              {selectedShift.expenses.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">المصروفات</h4>
                  <div className="space-y-2">
                    {selectedShift.expenses.map(expense => (
                      <div key={expense.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{expense.reason}</div>
                            <div className="text-sm text-gray-600">
                              {expense.timestamp.toLocaleString('ar-EG')} - {expense.createdBy}
                            </div>
                          </div>
                          <div className="text-red-600 font-medium">{expense.amount.toFixed(2)} جنيه</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External Money */}
              {selectedShift.externalMoney.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">الأموال الخارجية</h4>
                  <div className="space-y-2">
                    {selectedShift.externalMoney.map(money => (
                      <div key={money.id} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{money.reason}</div>
                            <div className="text-sm text-gray-600">
                              {money.timestamp.toLocaleString('ar-EG')} - {money.createdBy}
                            </div>
                          </div>
                          <div className="text-purple-600 font-medium">{money.amount.toFixed(2)} جنيه</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discrepancies */}
              {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">التضاربات</h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <ul className="list-disc list-inside space-y-1">
                      {selectedShift.discrepancies.map((discrepancy, index) => (
                        <li key={index} className="text-sm text-yellow-800">{discrepancy}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Close Reason */}
              {selectedShift.closeReason && (
                <div>
                  <h4 className="font-medium mb-2">سبب الإغلاق</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-800">{selectedShift.closeReason}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowShiftDetailsModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {showCustomerDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">تفاصيل العميل: {selectedCustomer.name}</h3>
            
            <div className="space-y-4">
              {customerPurchases.map(purchase => (
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
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700 mb-1">المنتجات:</div>
                    <div className="space-y-1">
                      {purchase.items.map((item, index) => (
                        <div key={index} className="text-sm text-gray-600 flex justify-between">
                          <span>{item.name} × {item.quantity}</span>
                          <span>{(item.price * item.quantity).toFixed(2)} جنيه</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
};

export default AdminView;