import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Save, X, Upload, Download, Calendar, 
  TrendingUp, Users, DollarSign, Package, BarChart3, PieChart,
  Filter, Search, ChevronDown, ChevronRight, Eye, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Item, Shift, Category, Customer, CustomerPurchase, Supply, 
  Payment, DailySummary, MonthlySummary, ShiftEdit, Expense 
} from '../types';
import { db } from '../services/database';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'current' | 'items' | 'shifts' | 'profit' | 'monthly' | 'customers'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [dashboardStats, setDashboardStats] = useState({
    todayProfit: 0,
    activeShift: false,
    topSellingItems: [] as Array<{ name: string; quantity: number; revenue: number }>,
    monthlyRevenue: 0,
    totalCustomers: 0,
    pendingCustomerDebt: 0
  });

  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: 0,
    costPrice: 0,
    currentAmount: 0,
    categoryId: '',
    image: ''
  });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [supplyForm, setSupplyForm] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [section, activeTab]);

  const loadData = async () => {
    try {
      const [itemsData, categoriesData, shiftsData, customersData, activeShiftData, customerPurchasesData] = await Promise.all([
        db.getItemsBySection(section),
        db.getCategoriesBySection(section),
        db.getShiftsBySection(section),
        db.getCustomersBySection(section),
        db.getActiveShift(section),
        db.getUnpaidCustomerPurchases(section)
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setShifts(shiftsData);
      setCustomers(customersData);
      setActiveShift(activeShiftData);
      setCustomerPurchases(customerPurchasesData);
      
      // Calculate dashboard stats
      calculateDashboardStats(shiftsData, itemsData, customersData, customerPurchasesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const calculateDashboardStats = (
    shiftsData: Shift[], 
    itemsData: Item[], 
    customersData: Customer[], 
    customerPurchasesData: CustomerPurchase[]
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = shiftsData.filter(s => 
      new Date(s.startTime).toISOString().split('T')[0] === today
    );
    
    const todayProfit = todayShifts.reduce((total, shift) => {
      return total + shift.purchases.reduce((shiftTotal, purchase) => {
        const item = itemsData.find(i => i.id === purchase.itemId);
        return shiftTotal + (item ? (purchase.price - item.costPrice) * purchase.quantity : 0);
      }, 0);
    }, 0);

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = shiftsData
      .filter(s => new Date(s.startTime).toISOString().slice(0, 7) === thisMonth)
      .reduce((total, shift) => total + shift.totalAmount, 0);

    const pendingCustomerDebt = customerPurchasesData.reduce((total, purchase) => 
      total + purchase.totalAmount, 0
    );

    // Calculate top selling items
    const itemSales: Record<string, { quantity: number; revenue: number; name: string }> = {};
    shiftsData.forEach(shift => {
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

    setDashboardStats({
      todayProfit,
      activeShift: !!activeShift,
      topSellingItems,
      monthlyRevenue,
      totalCustomers: customersData.length,
      pendingCustomerDebt
    });
  };

  const handleSaveItem = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const item: Item = {
        id: editingItem?.id || `${section}-${Date.now()}`,
        name: itemForm.name,
        sellPrice: itemForm.sellPrice,
        costPrice: itemForm.costPrice,
        currentAmount: itemForm.currentAmount,
        categoryId: itemForm.categoryId || undefined,
        image: itemForm.image || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db.saveItem(item);
      await loadData();
      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, categoryId: '', image: '' });
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const category: Category = {
        id: editingCategory?.id || `${section}-cat-${Date.now()}`,
        name: categoryForm.name,
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db.saveCategory(category);
      await loadData();
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '' });
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await db.deleteItem(itemId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await db.deleteCategory(categoryId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleAddSupply = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const totalCost = Object.entries(supplyForm).reduce((total, [itemId, quantity]) => {
        const item = items.find(i => i.id === itemId);
        return total + (item ? item.costPrice * quantity : 0);
      }, 0);

      const supply: Supply = {
        id: `supply-${Date.now()}`,
        section,
        items: supplyForm,
        totalCost,
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.saveSupply(supply);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyForm)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          item.currentAmount += quantity;
          item.updatedAt = new Date();
          await db.saveItem(item);
        }
      }

      await loadData();
      setShowSupplyModal(false);
      setSupplyForm({});
    } catch (error) {
      console.error('Failed to add supply:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayCustomerDebt = async (customerId: string, amount: number, isToday = false) => {
    if (!user || amount <= 0) return;

    setIsLoading(true);
    try {
      const customerPurchasesToPay = customerPurchases
        .filter(p => p.customerId === customerId && !p.isPaid)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (isToday && activeShift) {
        // Pay only today's purchases and add to current shift
        const todayPurchases = customerPurchasesToPay.filter(p => 
          p.shiftId === activeShift.id
        );

        let remainingAmount = amount;
        for (const purchase of todayPurchases) {
          if (remainingAmount <= 0) break;
          
          if (remainingAmount >= purchase.totalAmount) {
            purchase.isPaid = true;
            remainingAmount -= purchase.totalAmount;
            
            // Add to current shift
            activeShift.purchases.push(...purchase.items);
            activeShift.totalAmount += purchase.totalAmount;
          }
        }

        await db.saveShift(activeShift);
      } else {
        // Pay all-time purchases
        let remainingAmount = amount;
        for (const purchase of customerPurchasesToPay) {
          if (remainingAmount <= 0) break;
          
          if (remainingAmount >= purchase.totalAmount) {
            purchase.isPaid = true;
            remainingAmount -= purchase.totalAmount;
          }
        }
      }

      // Update customer purchases
      for (const purchase of customerPurchasesToPay) {
        if (purchase.isPaid) {
          await db.saveCustomerPurchase(purchase);
        }
      }

      // Create payment record
      const payment: Payment = {
        id: `payment-${Date.now()}`,
        amount,
        paidBy: customers.find(c => c.id === customerId)?.name || 'Unknown',
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.savePayment(payment);
      await loadData();
    } catch (error) {
      console.error('Failed to process payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportShiftsPDF = () => {
    const filteredShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime).toISOString().split('T')[0];
      const matchesDate = !dateFilter.start || !dateFilter.end || 
        (shiftDate >= dateFilter.start && shiftDate <= dateFilter.end);
      const matchesSearch = !searchTerm || 
        shift.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shift.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDate && matchesSearch;
    });

    generateShiftsPDF(filteredShifts, section);
  };

  const exportMonthlySummaryPDF = () => {
    // Generate monthly summary data
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyShifts = shifts.filter(s => 
      new Date(s.startTime).toISOString().slice(0, 7) === currentMonth
    );

    generateMonthlySummaryPDF(monthlyShifts, items, section, currentMonth);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Profit</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.todayProfit} EGP</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Shift</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardStats.activeShift ? 'Open' : 'Closed'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.monthlyRevenue} EGP</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalCustomers}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h3>
          <div className="space-y-3">
            {dashboardStats.topSellingItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.quantity} sold</p>
                </div>
                <p className="font-semibold text-gray-900">{item.revenue} EGP</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => setActiveTab('current')}
              className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                <Package className="h-5 w-5 text-blue-600 mr-3" />
                <span className="font-medium text-blue-900">Current Shift</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                <Edit className="h-5 w-5 text-green-600 mr-3" />
                <span className="font-medium text-green-900">Manage Items</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                <Users className="h-5 w-5 text-purple-600 mr-3" />
                <span className="font-medium text-purple-900">Customer Management</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {dashboardStats.pendingCustomerDebt > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-yellow-600 mr-2" />
            <span className="font-medium text-yellow-800">
              Pending Customer Debt: {dashboardStats.pendingCustomerDebt} EGP
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderItemsTab = () => (
    <div className="flex h-full">
      {/* Categories Sidebar */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
        sidebarCollapsed ? 'w-12' : 'w-64'
      }`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <h3 className="font-semibold text-gray-900">Categories</h3>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="p-4 space-y-2">
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '' });
                setShowCategoryModal(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </button>

            <div className="space-y-1">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">{category.name}</span>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryForm({ name: category.name });
                        setShowCategoryModal(true);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-1 hover:bg-gray-200 rounded text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Items Content */}
      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Items Management</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowSupplyModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Package className="h-4 w-4 mr-2" />
              Add Supply
            </button>
            <button
              onClick={() => {
                setEditingItem(null);
                setItemForm({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, categoryId: '', image: '' });
                setShowItemModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500">
                    {categories.find(c => c.id === item.categoryId)?.name || 'No Category'}
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">Sell: <span className="font-medium">{item.sellPrice} EGP</span></p>
                    <p className="text-sm">Cost: <span className="font-medium">{item.costPrice} EGP</span></p>
                    <p className="text-sm">Stock: <span className="font-medium">{item.currentAmount}</span></p>
                  </div>
                </div>
                {item.image && (
                  <img 
                    src={item.image} 
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg ml-4"
                  />
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setItemForm({
                      name: item.name,
                      sellPrice: item.sellPrice,
                      costPrice: item.costPrice,
                      currentAmount: item.currentAmount,
                      categoryId: item.categoryId || '',
                      image: item.image || ''
                    });
                    setShowItemModal(true);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderShiftsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Shifts History</h2>
        <button
          onClick={exportShiftsPDF}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search shifts..."
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Shift ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Started</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Ended</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Total Cash</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Items Sold</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Expenses</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">User Opened</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">User Closed</th>
              </tr>
            </thead>
            <tbody>
              {shifts
                .filter(shift => {
                  const shiftDate = new Date(shift.startTime).toISOString().split('T')[0];
                  const matchesDate = !dateFilter.start || !dateFilter.end || 
                    (shiftDate >= dateFilter.start && shiftDate <= dateFilter.end);
                  const matchesSearch = !searchTerm || 
                    shift.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    shift.id.toLowerCase().includes(searchTerm.toLowerCase());
                  return matchesDate && matchesSearch;
                })
                .map(shift => (
                  <tr key={shift.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{shift.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(shift.startTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Active'}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {shift.totalAmount} EGP
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.purchases.reduce((total, p) => total + p.quantity, 0)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.expenses.reduce((total, e) => total + e.amount, 0)} EGP
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        shift.validationStatus === 'balanced' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {shift.validationStatus}
                      </span>
                      {shift.discrepancies && shift.discrepancies.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {shift.discrepancies.join(', ')}
                          {shift.closeReason && (
                            <div className="text-xs text-blue-600">Note: {shift.closeReason}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{shift.username}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.status === 'closed' ? shift.username : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCustomersTab = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Customer Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {customers.map(customer => {
          const customerPurchasesForCustomer = customerPurchases.filter(p => p.customerId === customer.id);
          const todayPurchases = customerPurchasesForCustomer.filter(p => 
            activeShift && p.shiftId === activeShift.id
          );
          const allTimePurchases = customerPurchasesForCustomer.filter(p => 
            !activeShift || p.shiftId !== activeShift.id
          );

          const todayTotal = todayPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
          const allTimeTotal = allTimePurchases.reduce((sum, p) => sum + p.totalAmount, 0);

          return (
            <div key={customer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                  <p className="text-sm text-gray-500">
                    Customer since {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerDetails(true);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>

              {todayTotal > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-blue-900">Today's Purchases</h4>
                    <span className="font-bold text-blue-900">{todayTotal} EGP</span>
                  </div>
                  <div className="space-y-1">
                    {todayPurchases.map(purchase => (
                      <div key={purchase.id} className="text-sm text-blue-800">
                        {purchase.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handlePayCustomerDebt(customer.id, todayTotal, true)}
                    disabled={isLoading}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Pay {todayTotal} EGP
                  </button>
                </div>
              )}

              {allTimeTotal > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-900">All-Time Debt</h4>
                    <span className="font-bold text-gray-900">{allTimeTotal} EGP</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      max={allTimeTotal}
                    />
                    <button
                      onClick={() => {
                        handlePayCustomerDebt(customer.id, paymentAmount, false);
                        setPaymentAmount(0);
                      }}
                      disabled={isLoading || paymentAmount <= 0}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Pay
                    </button>
                  </div>
                </div>
              )}

              {todayTotal === 0 && allTimeTotal === 0 && (
                <p className="text-sm text-gray-500 italic">No pending purchases</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMonthlySummaryTab = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyShifts = shifts.filter(s => 
      new Date(s.startTime).toISOString().slice(0, 7) === currentMonth
    );

    const itemTotals: Record<string, {
      totalSold: number;
      totalCost: number;
      totalProfit: number;
      totalRevenue: number;
      name: string;
    }> = {};

    monthlyShifts.forEach(shift => {
      shift.purchases.forEach(purchase => {
        if (!itemTotals[purchase.itemId]) {
          const item = items.find(i => i.id === purchase.itemId);
          itemTotals[purchase.itemId] = {
            totalSold: 0,
            totalCost: 0,
            totalProfit: 0,
            totalRevenue: 0,
            name: purchase.name
          };
        }
        
        const item = items.find(i => i.id === purchase.itemId);
        const cost = item ? item.costPrice * purchase.quantity : 0;
        const revenue = purchase.price * purchase.quantity;
        
        itemTotals[purchase.itemId].totalSold += purchase.quantity;
        itemTotals[purchase.itemId].totalCost += cost;
        itemTotals[purchase.itemId].totalRevenue += revenue;
        itemTotals[purchase.itemId].totalProfit += revenue - cost;
      });
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Monthly Summary</h2>
          <button
            onClick={exportMonthlySummaryPDF}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Item Totals</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Item Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Sold</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Cost</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Profit</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(itemTotals).map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-900">{item.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.totalSold}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.totalCost} EGP</td>
                    <td className="py-3 px-4 text-sm font-medium text-green-600">{item.totalProfit} EGP</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{item.totalRevenue} EGP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Shifts Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Shift ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Started</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Ended</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">User Opened</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">User Closed</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Cash</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {monthlyShifts.map(shift => (
                  <tr key={shift.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-900">{shift.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(shift.startTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Active'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{shift.username}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.status === 'closed' ? shift.username : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {shift.totalAmount} EGP
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {shift.expenses.reduce((total, e) => total + e.amount, 0)} EGP
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

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
            { id: 'current', name: 'Current Shift', icon: Package },
            { id: 'items', name: 'Items', icon: Edit },
            { id: 'shifts', name: 'Shifts History', icon: FileText },
            { id: 'profit', name: 'Profit', icon: TrendingUp },
            { id: 'monthly', name: 'Monthly Summary', icon: Calendar },
            { id: 'customers', name: 'Customers', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'current' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Shift</h2>
          <p className="text-gray-600">Current shift functionality is handled in the Normal User View.</p>
        </div>
      )}
      {activeTab === 'items' && renderItemsTab()}
      {activeTab === 'shifts' && renderShiftsTab()}
      {activeTab === 'profit' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit Analysis</h2>
          <p className="text-gray-600">Profit analysis features coming soon.</p>
        </div>
      )}
      {activeTab === 'monthly' && renderMonthlySummaryTab()}
      {activeTab === 'customers' && renderCustomersTab()}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm(prev => ({ ...prev, sellPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm(prev => ({ ...prev, currentAmount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={itemForm.image}
                  onChange={(e) => setItemForm(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveItem}
                disabled={isLoading || !itemForm.name}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                  setItemForm({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, categoryId: '', image: '' });
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
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
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveCategory}
                disabled={isLoading || !categoryForm.name}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setCategoryForm({ name: '' });
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Add Supply</h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    <p className="text-sm text-gray-500">Current: {item.currentAmount}</p>
                  </div>
                  <input
                    type="number"
                    value={supplyForm[item.id] || 0}
                    onChange={(e) => setSupplyForm(prev => ({
                      ...prev,
                      [item.id]: parseInt(e.target.value) || 0
                    }))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>
              ))}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddSupply}
                disabled={isLoading || Object.values(supplyForm).every(v => v === 0)}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add Supply'}
              </button>
              <button
                onClick={() => {
                  setShowSupplyModal(false);
                  setSupplyForm({});
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;