import React, { useState, useEffect } from 'react';
import { 
  Settings, Package, TrendingUp, Clock, Plus, Edit3, Trash2, Save, X, 
  DollarSign, Calendar, AlertCircle, Users, BarChart3, FileText, 
  History, Play, Receipt, Image, Tag, ChevronDown, ChevronRight
} from 'lucide-react';
import { 
  Item, Shift, Supply, Payment, DailySummary, SupplementDebt, Category,
  Customer, CustomerPurchase, Expense, ShiftEdit, MonthlySummary, DashboardStats
} from '../types';
import { db } from '../services/database';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'shift' | 'storage' | 'profit' | 'payments' | 'customers' | 'shifts-history' | 'monthly'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [todaySummary, setTodaySummary] = useState<DailySummary | null>(null);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: 0,
    costPrice: 0,
    currentAmount: 0,
    image: '',
    categoryId: ''
  });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [supplyForm, setSupplyForm] = useState<Record<string, number>>({});
  const [paymentForm, setPaymentForm] = useState({ amount: 0, paidBy: '' });
  const [debtAmount, setDebtAmount] = useState(0);

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [
        itemsData, categoriesData, customersData, customerPurchasesData,
        shiftData, shiftsData, suppliesData, paymentsData, debtData
      ] = await Promise.all([
        db.getItemsBySection(section),
        db.getCategoriesBySection(section),
        db.getCustomersBySection(section),
        db.getUnpaidCustomerPurchases(section),
        db.getActiveShift(section),
        db.getShiftsBySection(section),
        db.getSuppliesBySection(section),
        db.getAllPayments(),
        section === 'supplement' ? db.getSupplementDebt() : Promise.resolve(null)
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setCustomerPurchases(customerPurchasesData);
      setActiveShift(shiftData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setPayments(paymentsData);
      setSupplementDebt(debtData);

      // Load today's summary
      const today = new Date().toISOString().split('T')[0];
      const summary = await db.getDailySummary(`${today}-${section}`, section);
      setTodaySummary(summary);

      // Load monthly summaries
      const monthlyData = await db.getMonthlySummariesBySection(section);
      setMonthlySummaries(monthlyData);

      // Calculate dashboard stats
      await calculateDashboardStats();

      // Initialize debt amount
      if (debtData) {
        setDebtAmount(debtData.amount);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const calculateDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayShifts = shifts.filter(s => 
        s.startTime && new Date(s.startTime).toISOString().split('T')[0] === today
      );
      
      const todayProfit = todayShifts.reduce((sum, shift) => {
        return sum + shift.purchases.reduce((purchaseSum, purchase) => {
          const item = items.find(i => i.id === purchase.itemId);
          if (item) {
            return purchaseSum + ((purchase.price - item.costPrice) * purchase.quantity);
          }
          return purchaseSum;
        }, 0);
      }, 0);

      // Calculate top selling items from all shifts
      const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      shifts.forEach(shift => {
        shift.purchases.forEach(purchase => {
          if (!itemSales[purchase.itemId]) {
            itemSales[purchase.itemId] = {
              name: purchase.name,
              quantity: 0,
              revenue: 0
            };
          }
          itemSales[purchase.itemId].quantity += purchase.quantity;
          itemSales[purchase.itemId].revenue += purchase.price * purchase.quantity;
        });
      });

      const topSellingItems = Object.values(itemSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyRevenue = shifts
        .filter(s => s.startTime && new Date(s.startTime).toISOString().slice(0, 7) === currentMonth)
        .reduce((sum, shift) => sum + shift.totalAmount, 0);

      const pendingCustomerDebt = customerPurchases
        .filter(cp => !cp.isPaid)
        .reduce((sum, cp) => sum + cp.totalAmount, 0);

      setDashboardStats({
        todayProfit,
        activeShift: !!activeShift,
        topSellingItems,
        monthlyRevenue,
        totalCustomers: customers.length,
        pendingCustomerDebt
      });
    } catch (error) {
      console.error('Failed to calculate dashboard stats:', error);
    }
  };

  const handleSaveCategory = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const categoryData: Category = {
        id: editingCategory?.id || `${section}-cat-${Date.now()}`,
        name: categoryForm.name,
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db.saveCategory(categoryData);
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

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await db.deleteCategory(categoryId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleSaveItem = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const itemData: Item = {
        id: editingItem?.id || `${section}-${Date.now()}`,
        name: itemForm.name,
        sellPrice: itemForm.sellPrice,
        costPrice: itemForm.costPrice,
        currentAmount: itemForm.currentAmount,
        image: itemForm.image || undefined,
        categoryId: itemForm.categoryId || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db.saveItem(itemData);
      await loadData();
      
      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, image: '', categoryId: '' });
    } catch (error) {
      console.error('Failed to save item:', error);
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

  const handlePayCustomer = async (customerId: string, amount: number, isToday = false) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const customerPurchasesToPay = customerPurchases
        .filter(cp => cp.customerId === customerId && !cp.isPaid)
        .filter(cp => isToday ? cp.shiftId === activeShift?.id : true)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let remainingAmount = amount;
      const paidPurchases: CustomerPurchase[] = [];

      for (const purchase of customerPurchasesToPay) {
        if (remainingAmount <= 0) break;

        if (remainingAmount >= purchase.totalAmount) {
          remainingAmount -= purchase.totalAmount;
          purchase.isPaid = true;
          paidPurchases.push(purchase);
          await db.saveCustomerPurchase(purchase);
        }
      }

      // If paying today's purchases, add to current shift
      if (isToday && activeShift) {
        const todayPaidPurchases = paidPurchases.filter(p => p.shiftId === activeShift.id);
        todayPaidPurchases.forEach(purchase => {
          activeShift.purchases.push(...purchase.items);
        });
        activeShift.totalAmount += todayPaidPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
        await db.saveShift(activeShift);
      }

      await loadData();
    } catch (error) {
      console.error('Failed to process customer payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportShiftsHistory = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${section.charAt(0).toUpperCase() + section.slice(1)} Shifts History`, 20, 20);

    const tableData = shifts.map(shift => [
      shift.id,
      new Date(shift.startTime).toLocaleString(),
      shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Active',
      `${shift.totalAmount} EGP`,
      shift.purchases.length.toString(),
      `${shift.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0} EGP`,
      shift.validationStatus === 'balanced' ? 'Balanced' : 
        `${shift.discrepancies?.join(', ') || 'Discrepancy'}${shift.closeReason ? ` - ${shift.closeReason}` : ''}`,
      shift.username
    ]);

    (doc as any).autoTable({
      head: [['Shift ID', 'Started', 'Ended', 'Total Cash', 'Items Sold', 'Expenses', 'Status', 'User']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 }
    });

    doc.save(`${section}-shifts-history.pdf`);
  };

  const exportMonthlySummary = (summary: MonthlySummary) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${section.charAt(0).toUpperCase() + section.slice(1)} Monthly Summary - ${summary.month}`, 20, 20);

    // Summary stats
    doc.setFontSize(12);
    doc.text(`Total Revenue: ${summary.totalRevenue} EGP`, 20, 40);
    doc.text(`Total Cost: ${summary.totalCost} EGP`, 20, 50);
    doc.text(`Total Profit: ${summary.totalProfit} EGP`, 20, 60);
    doc.text(`Total Expenses: ${summary.totalExpenses} EGP`, 20, 70);

    // Items table
    const itemsData = Object.entries(summary.soldItems).map(([itemId, data]) => [
      data.name,
      data.totalSold.toString(),
      `${data.totalCost} EGP`,
      `${data.totalProfit} EGP`,
      `${data.totalRevenue} EGP`
    ]);

    (doc as any).autoTable({
      head: [['Item Name', 'Total Sold', 'Total Cost', 'Total Profit', 'Total Revenue']],
      body: itemsData,
      startY: 80,
      styles: { fontSize: 10 }
    });

    doc.save(`${section}-monthly-summary-${summary.month}.pdf`);
  };

  const getFilteredItems = () => {
    if (selectedCategory === 'all') return items;
    if (selectedCategory === 'uncategorized') return items.filter(item => !item.categoryId);
    return items.filter(item => item.categoryId === selectedCategory);
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const renderDashboardTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Dashboard</h3>
      
      {dashboardStats && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-600">Today's Profit</p>
                  <p className="text-2xl font-bold text-green-900">{dashboardStats.todayProfit} EGP</p>
                </div>
              </div>
            </div>

            <div className={`p-6 rounded-lg ${dashboardStats.activeShift ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <div className="flex items-center">
                <Clock className={`h-8 w-8 ${dashboardStats.activeShift ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="ml-4">
                  <p className={`text-sm font-medium ${dashboardStats.activeShift ? 'text-blue-600' : 'text-gray-600'}`}>
                    Shift Status
                  </p>
                  <p className={`text-2xl font-bold ${dashboardStats.activeShift ? 'text-blue-900' : 'text-gray-900'}`}>
                    {dashboardStats.activeShift ? 'Active' : 'Closed'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-600">Total Customers</p>
                  <p className="text-2xl font-bold text-purple-900">{dashboardStats.totalCustomers}</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-6 rounded-lg">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-orange-600">Pending Debt</p>
                  <p className="text-2xl font-bold text-orange-900">{dashboardStats.pendingCustomerDebt} EGP</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Top Selling Items</h4>
            <div className="space-y-3">
              {dashboardStats.topSellingItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      {index + 1}
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">{item.quantity} units</div>
                    <div className="font-medium text-green-600">{item.revenue} EGP</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Quick Actions</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => setActiveTab('shift')}
                className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                <Clock className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                <span className="text-sm font-medium">Current Shift</span>
              </button>
              <button
                onClick={() => setActiveTab('items')}
                className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                <Package className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                <span className="text-sm font-medium">Manage Items</span>
              </button>
              <button
                onClick={() => setActiveTab('customers')}
                className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                <Users className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                <span className="text-sm font-medium">Customers</span>
              </button>
              <button
                onClick={() => setActiveTab('profit')}
                className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                <span className="text-sm font-medium">View Profits</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderItemsTab = () => (
    <div className="flex">
      {/* Categories Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 mr-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-900">Categories</h4>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '' });
              setShowCategoryModal(true);
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              selectedCategory === 'all' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
            }`}
          >
            All Items ({items.length})
          </button>
          
          <button
            onClick={() => setSelectedCategory('uncategorized')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              selectedCategory === 'uncategorized' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
            }`}
          >
            Uncategorized ({items.filter(i => !i.categoryId).length})
          </button>

          {categories.map(category => (
            <div key={category.id}>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  {category.name} ({items.filter(i => i.categoryId === category.id).length})
                </button>
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryForm({ name: category.name });
                      setShowCategoryModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items Content */}
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedCategory === 'all' ? 'All Items' : 
             selectedCategory === 'uncategorized' ? 'Uncategorized Items' :
             categories.find(c => c.id === selectedCategory)?.name || 'Items'}
          </h3>
          <button
            onClick={() => {
              setEditingItem(null);
              setItemForm({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, image: '', categoryId: '' });
              setShowItemModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredItems().map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-500">Stock: {item.currentAmount}</p>
                  {item.categoryId && (
                    <p className="text-xs text-blue-600">
                      {categories.find(c => c.id === item.categoryId)?.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setItemForm({
                          name: item.name,
                          sellPrice: item.sellPrice,
                          costPrice: item.costPrice,
                          currentAmount: item.currentAmount,
                          image: item.image || '',
                          categoryId: item.categoryId || ''
                        });
                        setShowItemModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Sell Price:</span>
                  <span className="font-medium">{item.sellPrice} EGP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cost Price:</span>
                  <span className="font-medium">{item.costPrice} EGP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Profit:</span>
                  <span className="font-medium text-green-600">
                    {item.sellPrice - item.costPrice} EGP
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item Modal */}
        {showItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h3>
                <button
                  onClick={() => setShowItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price (EGP)</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm(prev => ({ ...prev, sellPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (EGP)</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                  <input
                    type="number"
                    value={itemForm.currentAmount}
                    onChange={(e) => setItemForm(prev => ({ ...prev, currentAmount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowItemModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCustomersTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Customers</h3>
      
      <div className="space-y-6">
        {customers.map(customer => {
          const customerTodayPurchases = customerPurchases.filter(cp => 
            cp.customerId === customer.id && !cp.isPaid && cp.shiftId === activeShift?.id
          );
          const customerAllTimePurchases = customerPurchases.filter(cp => 
            cp.customerId === customer.id && !cp.isPaid && cp.shiftId !== activeShift?.id
          );
          
          const todayTotal = customerTodayPurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);
          const allTimeTotal = customerAllTimePurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);

          if (todayTotal === 0 && allTimeTotal === 0) return null;

          return (
            <div key={customer.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">{customer.name}</h4>
              
              {/* Today's Purchases */}
              {customerTodayPurchases.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium text-gray-900">Today's Purchases</h5>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-blue-600">{todayTotal} EGP</span>
                      <button
                        onClick={() => handlePayCustomer(customer.id, todayTotal, true)}
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {customerTodayPurchases.map(purchase => (
                      <div key={purchase.id} className="bg-gray-50 p-3 rounded">
                        {purchase.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>{item.price * item.quantity} EGP</span>
                          </div>
                        ))}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(purchase.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All-Time Purchases */}
              {customerAllTimePurchases.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium text-gray-900">All-Time Purchases</h5>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-red-600">{allTimeTotal} EGP</span>
                      <button
                        onClick={() => handlePayCustomer(customer.id, allTimeTotal, false)}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {customerAllTimePurchases.map(purchase => (
                      <div key={purchase.id} className="bg-gray-50 p-3 rounded">
                        {purchase.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>{item.price * item.quantity} EGP</span>
                          </div>
                        ))}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(purchase.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderShiftsHistoryTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Shifts History</h3>
        <button
          onClick={exportShiftsHistory}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shift ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ended
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cash
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items Sold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expenses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.map(shift => (
                <tr key={shift.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {shift.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(shift.startTime).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Active'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {shift.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {shift.totalAmount} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {shift.purchases.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {shift.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.validationStatus === 'balanced' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {shift.validationStatus === 'balanced' ? 'Balanced' : 'Discrepancy'}
                    </span>
                    {shift.discrepancies && shift.discrepancies.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {shift.discrepancies.join(', ')}
                        {shift.closeReason && ` - ${shift.closeReason}`}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMonthlyTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Monthly Summaries</h3>
      
      <div className="space-y-6">
        {monthlySummaries.map(summary => (
          <div key={summary.month} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-gray-900">{summary.month}</h4>
              <button
                onClick={() => exportMonthlySummary(summary)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center"
              >
                <FileText className="h-4 w-4 mr-1" />
                Export PDF
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Total Revenue</div>
                <div className="text-xl font-bold text-blue-900">{summary.totalRevenue} EGP</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Total Cost</div>
                <div className="text-xl font-bold text-red-900">{summary.totalCost} EGP</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Total Profit</div>
                <div className="text-xl font-bold text-green-900">{summary.totalProfit} EGP</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">Total Expenses</div>
                <div className="text-xl font-bold text-orange-900">{summary.totalExpenses} EGP</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Items Summary */}
              <div>
                <h5 className="font-medium text-gray-900 mb-3">Items Summary</h5>
                <div className="space-y-2">
                  {Object.entries(summary.soldItems).map(([itemId, data]) => (
                    <div key={itemId} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">{data.name}</span>
                      <div className="text-right text-sm">
                        <div>{data.totalSold} units</div>
                        <div className="text-green-600">{data.totalProfit} EGP profit</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shifts Summary */}
              <div>
                <h5 className="font-medium text-gray-900 mb-3">Shifts Summary</h5>
                <div className="space-y-2">
                  {summary.shifts.map(shift => (
                    <div key={shift.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <div className="font-medium">{shift.id}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(shift.startTime).toLocaleDateString()} - {shift.userOpened}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>{shift.totalCash} EGP</div>
                        <div className="text-orange-600">{shift.expenses} EGP expenses</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Keep existing methods for other tabs (shift, storage, profit, payments)
  const renderShiftTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Current Shift</h3>
      
      {activeShift ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-green-600 mr-2" />
              <span className="font-semibold text-green-800">Active Shift</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Started by: {activeShift.username}</div>
              <div className="text-sm text-gray-500">
                {new Date(activeShift.startTime).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Amount:</span>
              <span className="text-xl font-bold text-blue-600">{activeShift.totalAmount} EGP</span>
            </div>

            {activeShift.expenses && activeShift.expenses.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Expenses:</h4>
                <div className="space-y-2">
                  {activeShift.expenses.map((expense, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span>{expense.reason}</span>
                      <span className="font-medium text-red-600">{expense.amount} EGP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeShift.purchases.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Purchases:</h4>
                <div className="space-y-2">
                  {activeShift.purchases.map((purchase, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span>{purchase.quantity}x {purchase.name}</span>
                      <span className="font-medium">{purchase.price * purchase.quantity} EGP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No active shift</p>
        </div>
      )}
    </div>
  );

  const renderStorageTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Storage Management</h3>
        <button
          onClick={() => {
            const form: Record<string, number> = {};
            items.forEach(item => { form[item.id] = 0; });
            setSupplyForm(form);
            setShowSupplyModal(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Supply
        </button>
      </div>

      {/* Current Storage Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost per Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profit per Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sell Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Profit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {item.costPrice} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                    {item.sellPrice - item.costPrice} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {item.sellPrice} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {item.currentAmount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {(item.costPrice * item.currentAmount).toFixed(2)} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                    {((item.sellPrice - item.costPrice) * item.currentAmount).toFixed(2)} EGP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supply Modal */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">New Supply</h3>
              <button
                onClick={() => setShowSupplyModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <div className="text-sm text-gray-500">Cost: {item.costPrice} EGP each</div>
                  </div>
                  <input
                    type="number"
                    value={supplyForm[item.id] || 0}
                    onChange={(e) => setSupplyForm(prev => ({
                      ...prev,
                      [item.id]: parseInt(e.target.value) || 0
                    }))}
                    className="w-20 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>
              ))}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {/* handleNewSupply logic */}}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Confirm Supply'}
              </button>
              <button
                onClick={() => setShowSupplyModal(false)}
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

  const renderProfitTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Profit Analysis</h3>
      
      {todaySummary ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Today's Summary</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Total Cost</div>
              <div className="text-2xl font-bold text-blue-900">{todaySummary.totalCost} EGP</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Total Profit</div>
              <div className="text-2xl font-bold text-green-900">{todaySummary.totalProfit} EGP</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-sm text-indigo-600 font-medium">Total Revenue</div>
              <div className="text-2xl font-bold text-indigo-900">
                {todaySummary.totalCost + todaySummary.totalProfit} EGP
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-orange-600 font-medium">Total Expenses</div>
              <div className="text-2xl font-bold text-orange-900">{todaySummary.totalExpenses || 0} EGP</div>
            </div>
          </div>

          <div>
            <h5 className="font-medium text-gray-900 mb-3">Items Sold Today:</h5>
            <div className="space-y-3">
              {Object.entries(todaySummary.soldItems).map(([itemId, data]) => (
                <div key={itemId} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <span className="font-medium">{data.name}</span>
                    <span className="text-gray-500 ml-2">({data.quantity} units)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Cost: {data.cost} EGP</div>
                    <div className="text-sm font-medium text-green-600">Profit: {data.profit} EGP</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No sales data for today</p>
        </div>
      )}
    </div>
  );

  const renderPaymentsTab = () => {
    if (section !== 'supplement') {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Payments are only available for the supplement section</p>
        </div>
      );
    }

    const getCurrentDebt = () => {
      const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const totalSupplyCosts = supplies.reduce((sum, supply) => sum + supply.totalCost, 0);
      const baseDebt = supplementDebt?.amount || 0;
      
      return baseDebt - totalPayments + totalSupplyCosts;
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Supplement Payments</h3>
          <button
            onClick={() => {
              setPaymentForm({ amount: 0, paidBy: '' });
              setShowPaymentModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </button>
        </div>

        {/* Debt Management */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Debt Management</h4>
          
          <div className="flex items-center space-x-4 mb-4">
            <label className="text-sm font-medium text-gray-700">Base Debt (EGP):</label>
            <input
              type="number"
              value={debtAmount}
              onChange={(e) => setDebtAmount(parseFloat(e.target.value) || 0)}
              onBlur={() => {/* handleUpdateDebt logic */}}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-red-600 font-medium">Base Debt</div>
              <div className="text-xl font-bold text-red-900">{supplementDebt?.amount || 0} EGP</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Total Payments</div>
              <div className="text-xl font-bold text-green-900">
                {payments.reduce((sum, p) => sum + p.amount, 0)} EGP
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Current Debt</div>
              <div className="text-xl font-bold text-blue-900">{getCurrentDebt()} EGP</div>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Payment</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
                  <input
                    type="text"
                    value={paymentForm.paidBy}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paidBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter person name"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {/* handleNewPayment logic */}}
                  disabled={isLoading || !paymentForm.paidBy || paymentForm.amount <= 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Add Payment'}
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
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

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'items', label: 'Items', icon: Settings },
    { id: 'shift', label: 'Current Shift', icon: Clock },
    { id: 'storage', label: 'Storage', icon: Package },
    { id: 'profit', label: 'Profit', icon: TrendingUp },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'shifts-history', label: 'Shifts History', icon: History },
    { id: 'monthly', label: 'Monthly', icon: Calendar },
    ...(section === 'supplement' ? [{ id: 'payments' as const, label: 'Payments', icon: DollarSign }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboardTab()}
      {activeTab === 'items' && renderItemsTab()}
      {activeTab === 'shift' && renderShiftTab()}
      {activeTab === 'storage' && renderStorageTab()}
      {activeTab === 'profit' && renderProfitTab()}
      {activeTab === 'customers' && renderCustomersTab()}
      {activeTab === 'shifts-history' && renderShiftsHistoryTab()}
      {activeTab === 'monthly' && renderMonthlyTab()}
      {activeTab === 'payments' && renderPaymentsTab()}
    </div>
  );
};

export default AdminView;
