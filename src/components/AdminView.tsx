import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Users, Package, DollarSign, Calendar, FileText, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { 
  Item, Category, Customer, CustomerPurchase, Shift, Supply, 
  SupplementDebt, SupplementDebtTransaction, AdminLog, MonthlyArchive,
  ExternalMoney, Expense
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'customers' | 'shifts' | 'debt' | 'reports' | 'logs'>('inventory');
  
  // State for all data
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [debtTransactions, setDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerPurchases, setSelectedCustomerPurchases] = useState<CustomerPurchase[]>([]);
  
  // Form state
  const [newItem, setNewItem] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    categoryId: '',
    image: ''
  });
  
  const [newCategory, setNewCategory] = useState({ name: '' });
  const [newCustomer, setNewCustomer] = useState({ name: '' });
  const [supplyItems, setSupplyItems] = useState<Record<string, number>>({});
  const [debtForm, setDebtForm] = useState({
    type: 'payment' as 'payment' | 'debt',
    amount: '',
    note: ''
  });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [
        itemsData,
        categoriesData,
        customersData,
        shiftsData,
        suppliesData,
        logsData,
        archivesData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllAdminLogs(),
        db_service.getMonthlyArchives(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setAdminLogs(logsData.filter(log => !log.section || log.section === section));
      setMonthlyArchives(archivesData);

      // Load unpaid customer purchases
      const unpaidPurchases = await db_service.getUnpaidCustomerPurchases(section);
      setCustomerPurchases(unpaidPurchases);

      // Load supplement debt if in supplement section
      if (section === 'supplement') {
        const debt = await db_service.getSupplementDebt();
        const transactions = await db_service.getSupplementDebtTransactions();
        setSupplementDebt(debt);
        setDebtTransactions(transactions);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [section]);

  // Real-time updates
  useRealtime((event) => {
    if (event.section && event.section !== section) return;
    
    switch (event.type) {
      case 'ITEM_UPDATED':
        loadData();
        break;
      case 'CUSTOMER_UPDATED':
        loadData();
        break;
      case 'SHIFT_UPDATED':
        loadData();
        break;
      case 'SUPPLY_ADDED':
        loadData();
        break;
      case 'DEBT_UPDATED':
        if (section === 'supplement') {
          loadData();
        }
        break;
      case 'ADMIN_LOG_ADDED':
        loadData();
        break;
    }
  }, [section]);

  // Item management
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.sellPrice || !newItem.costPrice) return;

    const item: Item = {
      id: uuidv4(),
      name: newItem.name,
      sellPrice: parseFloat(newItem.sellPrice),
      costPrice: parseFloat(newItem.costPrice),
      currentAmount: parseInt(newItem.currentAmount) || 0,
      categoryId: newItem.categoryId || undefined,
      image: newItem.image || undefined,
      section,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db_service.saveItem(item);
    setNewItem({ name: '', sellPrice: '', costPrice: '', currentAmount: '', categoryId: '', image: '' });
    setShowAddItem(false);
    loadData();
  };

  const handleEditItem = async () => {
    if (!editingItem) return;

    const updatedItem = {
      ...editingItem,
      updatedAt: new Date()
    };

    await db_service.saveItem(updatedItem);
    setEditingItem(null);
    loadData();
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
      await db_service.deleteItem(id);
      loadData();
    }
  };

  // Category management
  const handleAddCategory = async () => {
    if (!newCategory.name) return;

    const category: Category = {
      id: uuidv4(),
      name: newCategory.name,
      section,
      createdAt: new Date()
    };

    await db_service.saveCategory(category);
    setNewCategory({ name: '' });
    setShowAddCategory(false);
    loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
      await db_service.deleteCategory(id);
      loadData();
    }
  };

  // Customer management
  const handleAddCustomer = async () => {
    if (!newCustomer.name) return;

    const customer: Customer = {
      id: uuidv4(),
      name: newCustomer.name,
      section,
      createdAt: new Date()
    };

    await db_service.saveCustomer(customer);
    setNewCustomer({ name: '' });
    setShowAddCustomer(false);
    loadData();
  };

  const handleEditCustomer = async () => {
    if (!editingCustomer) return;

    await db_service.saveCustomer(editingCustomer);
    setEditingCustomer(null);
    loadData();
  };

  const handleDeleteCustomer = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      await db_service.deleteCustomer(id);
      loadData();
    }
  };

  const handleViewCustomer = async (customer: Customer) => {
    setViewingCustomer(customer);
    const purchases = await db_service.getCustomerPurchases(customer.id);
    setSelectedCustomerPurchases(purchases);
  };

  // Supply management
  const handleAddSupply = async () => {
    const totalCost = Object.entries(supplyItems).reduce((total, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId);
      return total + (item ? item.costPrice * quantity : 0);
    }, 0);

    if (totalCost === 0) return;

    const supply: Supply = {
      id: uuidv4(),
      section,
      items: supplyItems,
      totalCost,
      timestamp: new Date(),
      createdBy: user?.username || 'Unknown'
    };

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

    // Get active shift to deduct cost
    const activeShift = await db_service.getActiveShift(section);
    await db_service.saveSupply(supply, activeShift || undefined);

    setSupplyItems({});
    setShowSupplyForm(false);
    loadData();
  };

  // Debt management (supplement only)
  const handleDebtTransaction = async () => {
    if (!debtForm.amount || !debtForm.note) return;

    const amount = parseFloat(debtForm.amount);
    const transaction: SupplementDebtTransaction = {
      id: uuidv4(),
      type: debtForm.type,
      amount,
      note: debtForm.note,
      timestamp: new Date(),
      createdBy: user?.username || 'Unknown'
    };

    await db_service.saveSupplementDebtTransaction(transaction);

    // Update total debt
    const currentDebt = supplementDebt?.amount || 0;
    const newAmount = debtForm.type === 'debt' 
      ? currentDebt + amount 
      : Math.max(0, currentDebt - amount);

    const updatedDebt: SupplementDebt = {
      amount: newAmount,
      lastUpdated: new Date(),
      updatedBy: user?.username || 'Unknown'
    };

    await db_service.saveSupplementDebt(updatedDebt);

    setDebtForm({ type: 'payment', amount: '', note: '' });
    setShowDebtForm(false);
    loadData();
  };

  const handleDeleteDebtTransaction = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
      await db_service.deleteSupplementDebtTransaction(id);
      loadData();
    }
  };

  // Month reset functionality with proper foreign key handling
  const resetMonth = async () => {
    if (!confirm('هل أنت متأكد من إعادة تعيين الشهر؟ سيتم حذف جميع البيانات وأرشفتها.')) {
      return;
    }

    try {
      setLoading(true);
      await db_service.resetMonth(section, user?.username || 'Unknown');
      await loadData();
      alert('تم إعادة تعيين الشهر بنجاح');
    } catch (error: any) {
      console.error('خطأ في إعادة تعيين الشهر:', error);
      alert(`خطأ في إعادة تعيين الشهر: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // PDF generation
  const generateShiftsReport = () => {
    generateShiftsPDF(shifts, section);
  };

  const generateMonthlyReport = () => {
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    generateMonthlySummaryPDF(shifts, items, section, currentMonth);
  };

  if (loading) {
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            إدارة {section === 'store' ? 'البار' : 'المكملات الغذائية'}
          </h1>
          <div className="flex space-x-2">
            <button
              onClick={resetMonth}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>إعادة تعيين الشهر</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'inventory', label: 'المخزون', icon: Package },
              { id: 'customers', label: 'العملاء', icon: Users },
              { id: 'shifts', label: 'الورديات', icon: Calendar },
              ...(section === 'supplement' ? [{ id: 'debt', label: 'إدارة الديون', icon: DollarSign }] : []),
              { id: 'reports', label: 'التقارير', icon: FileText },
              { id: 'logs', label: 'سجل الأنشطة', icon: AlertTriangle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
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
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">إدارة المخزون</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة فئة</span>
                  </button>
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة عنصر</span>
                  </button>
                  <button
                    onClick={() => setShowSupplyForm(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Package className="h-4 w-4" />
                    <span>توريد مخزون</span>
                  </button>
                </div>
              </div>

              {/* Categories */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-3">الفئات</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <div key={category.id} className="bg-white px-3 py-1 rounded-full flex items-center space-x-2">
                      <span>{category.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الاسم
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
                        الفئة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.sellPrice} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.costPrice} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.currentAmount <= 5 
                              ? 'bg-red-100 text-red-800' 
                              : item.currentAmount <= 10
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {item.currentAmount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {categories.find(c => c.id === item.categoryId)?.name || 'غير محدد'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingItem(item)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
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

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">إدارة العملاء</h2>
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة عميل</span>
                </button>
              </div>

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
                        تاريخ الإنشاء
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map(customer => {
                      const customerDebt = customerPurchases
                        .filter(p => p.customerId === customer.id && !p.isPaid)
                        .reduce((total, p) => total + p.totalAmount, 0);

                      return (
                        <tr key={customer.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {customer.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              customerDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {customerDebt.toFixed(2)} جنيه
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {customer.createdAt.toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleViewCustomer(customer)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingCustomer(customer)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(customer.id)}
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

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">إدارة الورديات</h2>
                <button
                  onClick={generateShiftsReport}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>تصدير تقرير</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
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
                        إجمالي المبيعات
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الحالة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        حالة التحقق
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.totalAmount.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            shift.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shift.status === 'active' ? 'نشط' : 'مغلق'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
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

          {/* Debt Management Tab (Supplement only) */}
          {activeTab === 'debt' && section === 'supplement' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">إدارة ديون المكملات الغذائية</h2>
                <button
                  onClick={() => setShowDebtForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة معاملة</span>
                </button>
              </div>

              {/* Current Debt */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">إجمالي الدين الحالي</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {supplementDebt?.amount.toFixed(2) || '0.00'} جنيه
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  آخر تحديث: {supplementDebt?.lastUpdated.toLocaleString('ar-EG') || 'غير محدد'}
                </p>
              </div>

              {/* Transactions */}
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
                        المستخدم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {debtTransactions.map(transaction => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            transaction.type === 'payment' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.type === 'payment' ? 'دفع' : 'دين'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.amount.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.note}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.createdBy}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteDebtTransaction(transaction.id)}
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
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">التقارير والأرشيف</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">تقارير الورديات</h3>
                  <button
                    onClick={generateShiftsReport}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    تصدير تقرير الورديات
                  </button>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">التقرير الشهري</h3>
                  <button
                    onClick={generateMonthlyReport}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  >
                    تصدير التقرير الشهري
                  </button>
                </div>
              </div>

              {/* Monthly Archives */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="font-semibold mb-4">الأرشيف الشهري</h3>
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {archive.year}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {archive.totalProfit.toFixed(2)} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {archive.totalRevenue.toFixed(2)} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">سجل أنشطة المدراء</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        نوع النشاط
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        العنصر المتأثر
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        تفاصيل التغيير
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المدير
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        التاريخ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {adminLogs.map(log => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.actionType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.itemOrShiftAffected}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {log.changeDetails}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.adminName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.timestamp.toLocaleString('ar-EG')}
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
      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة عنصر جديد</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="اسم العنصر"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="سعر البيع"
                value={newItem.sellPrice}
                onChange={(e) => setNewItem({ ...newItem, sellPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="سعر التكلفة"
                value={newItem.costPrice}
                onChange={(e) => setNewItem({ ...newItem, costPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="الكمية الحالية"
                value={newItem.currentAmount}
                onChange={(e) => setNewItem({ ...newItem, currentAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <select
                value={newItem.categoryId}
                onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">اختر الفئة</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddItem(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة فئة جديدة</h3>
            <input
              type="text"
              placeholder="اسم الفئة"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة عميل جديد</h3>
            <input
              type="text"
              placeholder="اسم العميل"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddCustomer(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddCustomer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">تعديل العنصر</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="اسم العنصر"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="سعر البيع"
                value={editingItem.sellPrice}
                onChange={(e) => setEditingItem({ ...editingItem, sellPrice: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="سعر التكلفة"
                value={editingItem.costPrice}
                onChange={(e) => setEditingItem({ ...editingItem, costPrice: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="الكمية الحالية"
                value={editingItem.currentAmount}
                onChange={(e) => setEditingItem({ ...editingItem, currentAmount: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleEditItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">تعديل العميل</h3>
            <input
              type="text"
              placeholder="اسم العميل"
              value={editingCustomer.name}
              onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleEditCustomer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Customer Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">تفاصيل العميل: {viewingCustomer.name}</h3>
              <button
                onClick={() => setViewingCustomer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">ملخص الدين</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-blue-700">إجمالي الدين</p>
                    <p className="text-xl font-bold text-blue-600">
                      {selectedCustomerPurchases
                        .filter(p => !p.isPaid)
                        .reduce((total, p) => total + p.totalAmount, 0)
                        .toFixed(2)} جنيه
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">إجمالي التكلفة</p>
                    <p className="text-xl font-bold text-blue-600">
                      {selectedCustomerPurchases
                        .filter(p => !p.isPaid)
                        .reduce((total, p) => {
                          return total + p.items.reduce((itemTotal, item) => {
                            const dbItem = items.find(i => i.id === item.itemId);
                            return itemTotal + (dbItem ? dbItem.costPrice * item.quantity : 0);
                          }, 0);
                        }, 0)
                        .toFixed(2)} جنيه
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">إجمالي الربح</p>
                    <p className="text-xl font-bold text-blue-600">
                      {(selectedCustomerPurchases
                        .filter(p => !p.isPaid)
                        .reduce((total, p) => total + p.totalAmount, 0) -
                        selectedCustomerPurchases
                        .filter(p => !p.isPaid)
                        .reduce((total, p) => {
                          return total + p.items.reduce((itemTotal, item) => {
                            const dbItem = items.find(i => i.id === item.itemId);
                            return itemTotal + (dbItem ? dbItem.costPrice * item.quantity : 0);
                          }, 0);
                        }, 0))
                        .toFixed(2)} جنيه
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        التاريخ
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        العناصر
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المبلغ الإجمالي
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        التكلفة الإجمالية
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الربح الإجمالي
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedCustomerPurchases.map(purchase => {
                      const totalCost = purchase.items.reduce((total, item) => {
                        const dbItem = items.find(i => i.id === item.itemId);
                        return total + (dbItem ? dbItem.costPrice * item.quantity : 0);
                      }, 0);
                      const totalProfit = purchase.totalAmount - totalCost;

                      return (
                        <tr key={purchase.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {purchase.timestamp.toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {purchase.items.map(item => (
                              <div key={item.itemId}>
                                {item.name} × {item.quantity}
                              </div>
                            ))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {purchase.totalAmount.toFixed(2)} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {totalCost.toFixed(2)} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {totalProfit.toFixed(2)} جنيه
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              purchase.isPaid 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {purchase.isPaid ? 'مدفوع' : 'غير مدفوع'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supply Form Modal */}
      {showSupplyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">توريد مخزون</h3>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">سعر التكلفة: {item.costPrice} جنيه</p>
                  </div>
                  <input
                    type="number"
                    placeholder="الكمية"
                    value={supplyItems[item.id] || ''}
                    onChange={(e) => setSupplyItems({
                      ...supplyItems,
                      [item.id]: parseInt(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowSupplyForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddSupply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إضافة التوريد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Form Modal */}
      {showDebtForm && section === 'supplement' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة معاملة دين</h3>
            <div className="space-y-4">
              <select
                value={debtForm.type}
                onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as 'payment' | 'debt' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="payment">دفع</option>
                <option value="debt">دين</option>
              </select>
              <input
                type="number"
                placeholder="المبلغ"
                value={debtForm.amount}
                onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                placeholder="الملاحظة"
                value={debtForm.note}
                onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowDebtForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleDebtTransaction}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;