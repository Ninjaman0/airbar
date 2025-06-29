import React, { useState, useEffect } from 'react';
import { 
  Package, Users, DollarSign, FileText, Settings, Plus, Edit, Trash2, 
  Download, Upload, BarChart3, TrendingUp, Calendar, Archive, RotateCcw,
  Eye, AlertTriangle, CheckCircle, X, Camera, Search, Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { 
  Item, Category, Customer, CustomerPurchase, Shift, Supply, AdminLog, 
  SupplementDebt, SupplementDebtTransaction, MonthlyArchive, Expense, ExternalMoney
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
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [supplementDebtTransactions, setSupplementDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showResetMonthModal, setShowResetMonthModal] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  
  // Item form
  const [itemName, setItemName] = useState('');
  const [itemSellPrice, setItemSellPrice] = useState('');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  
  // Category form
  const [categoryName, setCategoryName] = useState('');
  
  // Supply form
  const [supplyItems, setSupplyItems] = useState<Record<string, number>>({});
  const [supplyTotalCost, setSupplyTotalCost] = useState('');
  
  // Debt form
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [debtType, setDebtType] = useState<'payment' | 'debt'>('payment');
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
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
        suppliesData, logsData, archivesData, activeShiftData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllAdminLogs(),
        db_service.getMonthlyArchives(section),
        db_service.getActiveShift(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setAdminLogs(logsData.filter(log => !log.section || log.section === section));
      setMonthlyArchives(archivesData);
      setActiveShift(activeShiftData);

      // Load supplement debt data if in supplement section
      if (section === 'supplement') {
        const [debtData, transactionsData] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debtData);
        setSupplementDebtTransactions(transactionsData);
      }

      // Initialize supply items
      const supplyMap: Record<string, number> = {};
      itemsData.forEach(item => {
        supplyMap[item.id] = 0;
      });
      setSupplyItems(supplyMap);
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
    if (!itemName || !itemSellPrice || !itemCostPrice) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsLoading(true);

      const item: Item = {
        id: editingItem?.id || uuidv4(),
        name: itemName,
        sellPrice: parseInt(itemSellPrice),
        costPrice: parseInt(itemCostPrice),
        currentAmount: editingItem ? editingItem.currentAmount : parseInt(itemAmount) || 0,
        image: itemImage || undefined,
        categoryId: itemCategoryId || undefined,
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

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemSellPrice(item.sellPrice.toString());
    setItemCostPrice(item.costPrice.toString());
    setItemAmount(item.currentAmount.toString());
    setItemImage(item.image || '');
    setItemCategoryId(item.categoryId || '');
    setShowItemModal(true);
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setItemName('');
    setItemSellPrice('');
    setItemCostPrice('');
    setItemAmount('');
    setItemImage('');
    setItemCategoryId('');
  };

  // Category operations
  const saveCategory = async () => {
    if (!categoryName) {
      setError('يرجى إدخال اسم الفئة');
      return;
    }

    try {
      setIsLoading(true);

      const category: Category = {
        id: editingCategory?.id || uuidv4(),
        name: categoryName,
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db_service.saveCategory(category);
      setCategoryName('');
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

  // Supply operations
  const saveSupply = async () => {
    const totalItems = Object.values(supplyItems).reduce((sum, qty) => sum + qty, 0);
    if (totalItems === 0 || !supplyTotalCost) {
      setError('يرجى إدخال كميات المنتجات والتكلفة الإجمالية');
      return;
    }

    try {
      setIsLoading(true);

      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyItems,
        totalCost: parseInt(supplyTotalCost),
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

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

      await db_service.saveSupply(supply, activeShift || undefined);

      // Reset form
      const resetSupplyItems: Record<string, number> = {};
      items.forEach(item => {
        resetSupplyItems[item.id] = 0;
      });
      setSupplyItems(resetSupplyItems);
      setSupplyTotalCost('');
      setShowSupplyModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ التوريد:', error);
      setError('فشل في حفظ التوريد');
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
      
      // Delete customer purchases first
      const purchases = await db_service.getCustomerPurchases(customer.id);
      for (const purchase of purchases) {
        await db_service.deleteCustomerPurchase(purchase.id);
      }

      // Then delete customer
      await db_service.deleteCustomer(customer.id);
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف العميل:', error);
      setError('فشل في حذف العميل');
    } finally {
      setIsLoading(false);
    }
  };

  // Supplement debt operations
  const saveDebtTransaction = async () => {
    if (!debtAmount || !debtNote) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    try {
      setIsLoading(true);

      const transaction: SupplementDebtTransaction = {
        id: uuidv4(),
        type: debtType,
        amount: parseInt(debtAmount),
        note: debtNote,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Update current debt
      const currentDebtAmount = supplementDebt?.amount || 0;
      const newDebtAmount = debtType === 'debt' 
        ? currentDebtAmount + parseInt(debtAmount)
        : currentDebtAmount - parseInt(debtAmount);

      const updatedDebt: SupplementDebt = {
        amount: Math.max(0, newDebtAmount),
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      setDebtAmount('');
      setDebtNote('');
      setShowDebtModal(false);
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
    if (!confirm('هل أنت متأكد من إعادة تعيين الشهر؟ سيتم أرشفة جميع البيانات الحالية.')) return;

    try {
      setIsLoading(true);
      await db_service.resetMonth(section, user?.username || '');
      setShowResetMonthModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في إعادة تعيين الشهر:', error);
      setError('فشل في إعادة تعيين الشهر');
    } finally {
      setIsLoading(false);
    }
  };

  // Shift operations
  const openShiftDetails = (shift: Shift) => {
    setSelectedShift(shift);
    setShowShiftDetailsModal(true);
  };

  // Export operations
  const exportShiftsReport = () => {
    generateShiftsPDF(shifts, section);
  };

  const exportMonthlyReport = () => {
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    generateMonthlySummaryPDF(shifts, items, section, currentMonth);
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate statistics
  const calculateStats = () => {
    const today = new Date();
    const todayShifts = shifts.filter(shift => 
      shift.startTime.toDateString() === today.toDateString()
    );

    let todayProfit = 0;
    let todayRevenue = 0;
    let todayCost = 0;

    todayShifts.forEach(shift => {
      shift.purchases.forEach(purchase => {
        const item = items.find(i => i.id === purchase.itemId);
        if (item) {
          const revenue = purchase.price * purchase.quantity;
          const cost = item.costPrice * purchase.quantity;
          todayRevenue += revenue;
          todayCost += cost;
          todayProfit += revenue - cost;
        }
      });
    });

    const totalCustomers = customers.length;
    const lowStockItems = items.filter(item => item.currentAmount < 10).length;

    return {
      todayProfit,
      todayRevenue,
      todayCost,
      totalCustomers,
      lowStockItems,
      activeShifts: shifts.filter(s => s.status === 'active').length
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            إدارة {section === 'store' ? 'البار' : 'المكملات الغذائية'}
          </h1>
          <button
            onClick={() => setShowResetMonthModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>إعادة تعيين الشهر</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.todayProfit.toFixed(0)} جنيه</div>
            <div className="text-sm text-green-600">ربح اليوم</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.todayRevenue.toFixed(0)} جنيه</div>
            <div className="text-sm text-blue-600">مبيعات اليوم</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.todayCost.toFixed(0)} جنيه</div>
            <div className="text-sm text-red-600">تكلفة اليوم</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.totalCustomers}</div>
            <div className="text-sm text-purple-600">إجمالي العملاء</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStockItems}</div>
            <div className="text-sm text-yellow-600">منتجات قليلة المخزون</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600">{stats.activeShifts}</div>
            <div className="text-sm text-indigo-600">الورديات النشطة</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'inventory', label: 'المخزون', icon: Package },
              { id: 'customers', label: 'العملاء', icon: Users },
              { id: 'shifts', label: 'الورديات', icon: Clock },
              { id: 'supplies', label: 'التوريدات', icon: Upload },
              { id: 'reports', label: 'التقارير', icon: BarChart3 },
              { id: 'logs', label: 'سجل الأنشطة', icon: FileText },
              ...(section === 'supplement' ? [{ id: 'debt', label: 'إدارة الديون', icon: DollarSign }] : [])
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">إدارة المخزون</h2>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة فئة</span>
                  </button>
                  <button
                    onClick={() => {
                      resetItemForm();
                      setShowItemModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة منتج</span>
                  </button>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="flex space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="البحث في المنتجات..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">جميع الفئات</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">الفئات</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                      <div key={category.id} className="bg-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                        <span>{category.name}</span>
                        <button
                          onClick={() => deleteCategory(category)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => (
                  <div key={item.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-32 object-cover rounded-md mb-3"
                      />
                    )}
                    <div className="space-y-2">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <div className="text-sm text-gray-600">
                        <div>سعر البيع: {item.sellPrice} جنيه</div>
                        <div>سعر التكلفة: {item.costPrice} جنيه</div>
                        <div className={`font-medium ${item.currentAmount < 10 ? 'text-red-600' : 'text-green-600'}`}>
                          المخزون: {item.currentAmount}
                        </div>
                        {item.categoryId && (
                          <div>الفئة: {categories.find(c => c.id === item.categoryId)?.name}</div>
                        )}
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <button
                          onClick={() => openEditItem(item)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded text-sm"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded text-sm"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">إدارة العملاء</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map(customer => {
                  const customerDebt = customerPurchases
                    .filter(p => p.customerId === customer.id && !p.isPaid)
                    .reduce((sum, p) => sum + p.totalAmount, 0);

                  return (
                    <div key={customer.id} className="bg-white border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <button
                          onClick={() => openCustomerDetails(customer)}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {customer.name}
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>إجمالي الدين: {customerDebt.toFixed(0)} جنيه</div>
                        <div>تاريخ الإنشاء: {customer.createdAt.toLocaleDateString('ar-EG')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">سجل الورديات</h2>
                <button
                  onClick={exportShiftsReport}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير التقرير</span>
                </button>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">معرف الوردية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ البداية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ النهاية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي النقدية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shifts.map(shift => (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.id.substring(0, 8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.startTime.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shift.totalAmount.toFixed(0)} جنيه
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
                             shift.validationStatus === 'balanced' ? 'متوازنة' : 'بها تضارب'}
                          </span>
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
          )}

          {/* Supplies Tab */}
          {activeTab === 'supplies' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">إدارة التوريدات</h2>
                <button
                  onClick={() => setShowSupplyModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة توريد</span>
                </button>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المنتجات</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التكلفة الإجمالية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تم بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplies.map(supply => (
                      <tr key={supply.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {supply.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {Object.entries(supply.items).map(([itemId, quantity]) => {
                            const item = items.find(i => i.id === itemId);
                            return item ? `${item.name}: ${quantity}` : '';
                          }).filter(Boolean).join(', ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {supply.totalCost.toFixed(0)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {supply.createdBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">التقارير والإحصائيات</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">تقارير الورديات</h3>
                  <button
                    onClick={exportShiftsReport}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                  >
                    تصدير تقرير الورديات
                  </button>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">التقرير الشهري</h3>
                  <button
                    onClick={exportMonthlyReport}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                  >
                    تصدير التقرير الشهري
                  </button>
                </div>
              </div>

              {/* Monthly Archives */}
              {monthlyArchives.length > 0 && (
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">الأرشيف الشهري</h3>
                  <div className="space-y-4">
                    {monthlyArchives.map(archive => (
                      <div key={archive.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{archive.month} {archive.year}</h4>
                            <div className="text-sm text-gray-600 mt-1">
                              <div>إجمالي الربح: {archive.totalProfit.toFixed(0)} جنيه</div>
                              <div>إجمالي الإيرادات: {archive.totalRevenue.toFixed(0)} جنيه</div>
                              <div>عدد الورديات: {archive.shiftsCount}</div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            أرشف بواسطة: {archive.archivedBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">سجل أنشطة المدير</h2>
              
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع الإجراء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنصر المتأثر</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تفاصيل التغيير</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المدير</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {adminLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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

          {/* Supplement Debt Tab */}
          {activeTab === 'debt' && section === 'supplement' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">إدارة ديون المكملات الغذائية</h2>
                <button
                  onClick={() => setShowDebtModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة معاملة</span>
                </button>
              </div>

              {/* Current Debt Display */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium mb-2">الدين الحالي</h3>
                <div className="text-3xl font-bold text-red-600">
                  {supplementDebt?.amount?.toFixed(0) || '0'} جنيه
                </div>
                {supplementDebt && (
                  <div className="text-sm text-gray-600 mt-2">
                    آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                  </div>
                )}
              </div>

              {/* Debt Transactions */}
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium">سجل المعاملات</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">النوع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الملاحظة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تم بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplementDebtTransactions.map(transaction => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.timestamp.toLocaleString('ar-EG')}
                        </td>
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
                          {transaction.amount.toFixed(0)} جنيه
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.note}
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
          )}
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
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المنتج"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (جنيه)</label>
                  <input
                    type="number"
                    value={itemSellPrice}
                    onChange={(e) => setItemSellPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة (جنيه)</label>
                  <input
                    type="number"
                    value={itemCostPrice}
                    onChange={(e) => setItemCostPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
              </div>

              {!editingItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الأولية</label>
                  <input
                    type="number"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                <select
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة</label>
                <input
                  type="url"
                  value={itemImage}
                  onChange={(e) => setItemImage(e.target.value)}
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
                disabled={isLoading || !itemName || !itemSellPrice || !itemCostPrice}
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
            <h3 className="text-lg font-semibold mb-4">إضافة فئة جديدة</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة</label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
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
                disabled={isLoading || !categoryName}
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
                        <div className="text-xs text-gray-500">المخزون الحالي: {item.currentAmount}</div>
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
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة الإجمالية (جنيه)</label>
                <input
                  type="number"
                  value={supplyTotalCost}
                  onChange={(e) => setSupplyTotalCost(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0"
                />
                {activeShift && (
                  <div className="text-xs text-yellow-600 mt-1">
                    ملاحظة: سيتم خصم هذا المبلغ من النقدية الحالية في الوردية النشطة
                  </div>
                )}
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
                disabled={isLoading || !supplyTotalCost}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'حفظ التوريد'}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">معلومات الوردية</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>معرف الوردية: {selectedShift.id.substring(0, 8)}</div>
                    <div>المستخدم: {selectedShift.username}</div>
                    <div>تاريخ البداية: {selectedShift.startTime.toLocaleString('ar-EG')}</div>
                    <div>تاريخ النهاية: {selectedShift.endTime ? selectedShift.endTime.toLocaleString('ar-EG') : 'نشطة'}</div>
                    <div>إجمالي النقدية: {selectedShift.totalAmount.toFixed(0)} جنيه</div>
                    <div>حالة التحقق: {selectedShift.validationStatus === 'balanced' ? 'متوازنة' : 'بها تضارب'}</div>
                  </div>
                </div>

                {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">التضاربات</h4>
                    <div className="text-sm text-red-600 space-y-1">
                      {selectedShift.discrepancies.map((discrepancy, index) => (
                        <div key={index}>• {discrepancy}</div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedShift.closeReason && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">سبب الإغلاق</h4>
                    <div className="text-sm text-gray-600">{selectedShift.closeReason}</div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">المبيعات</h4>
                  <div className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {selectedShift.purchases.map((purchase, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{purchase.name} × {purchase.quantity}</span>
                        <span>{(purchase.price * purchase.quantity).toFixed(0)} جنيه</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">المصروفات</h4>
                  <div className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {selectedShift.expenses.map((expense, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{expense.reason}</span>
                        <span>{expense.amount.toFixed(0)} جنيه</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedShift.externalMoney.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">الأموال الخارجية</h4>
                    <div className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                      {selectedShift.externalMoney.map((money, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{money.reason}</span>
                          <span>{money.amount.toFixed(0)} جنيه</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                      <div className="font-medium">المبلغ: {purchase.totalAmount.toFixed(0)} جنيه</div>
                      <div className="text-sm text-gray-600">
                        التاريخ: {purchase.timestamp.toLocaleString('ar-EG')}
                      </div>
                      <div className="text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          purchase.isPaid 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {purchase.isPaid ? 'مدفوع' : 'غير مدفوع'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700 mb-1">المنتجات:</div>
                    <div className="space-y-1">
                      {purchase.items.map((item, index) => (
                        <div key={index} className="text-sm text-gray-600 flex justify-between">
                          <span>{item.name} × {item.quantity}</span>
                          <span>{(item.price * item.quantity).toFixed(0)} جنيه</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
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

      {/* Debt Transaction Modal */}
      {showDebtModal && (
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
                  <option value="payment">دفع</option>
                  <option value="debt">دين جديد</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الملاحظة</label>
                <textarea
                  value={debtNote}
                  onChange={(e) => setDebtNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="أدخل ملاحظة..."
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
                disabled={isLoading || !debtAmount || !debtNote}
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
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">تحذير!</p>
                    <p>سيتم أرشفة جميع الورديات والمبيعات الحالية وحذفها من النظام. هذا الإجراء لا يمكن التراجع عنه.</p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>سيتم الاحتفاظ بـ:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>بيانات المنتجات والمخزون</li>
                  <li>بيانات العملاء</li>
                  <li>الفئات</li>
                </ul>
              </div>

              <div className="text-sm text-gray-600">
                <p>سيتم أرشفة وحذف:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>جميع الورديات</li>
                  <li>المبيعات والمصروفات</li>
                  <li>مشتريات العملاء</li>
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
                {isLoading ? 'جاري الإعادة...' : 'تأكيد الإعادة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;