import React, { useState, useEffect } from 'react';
import { 
  Package, DollarSign, TrendingUp, Calendar, Users, FileText, 
  Plus, Edit, Trash2, Save, X, AlertCircle, CheckCircle, Eye,
  Download, Filter, Search, Clock, Receipt, Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Item, Shift, Supply, Payment, DailySummary, MonthlySummary, Category, Customer, CustomerPurchase, Expense, SupplementDebt } from '../types';
import { db } from '../services/database';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'shifts' | 'profit' | 'customers' | 'payments'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCustomerPurchase, setEditingCustomerPurchase] = useState<CustomerPurchase | null>(null);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showNewSupplyModal, setShowNewSupplyModal] = useState(false);
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);
  const [showEditDebtModal, setShowEditDebtModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customerTab, setCustomerTab] = useState<'today' | 'alltime'>('today');
  const [newDebtAmount, setNewDebtAmount] = useState(0);
  const [newPaymentAmount, setNewPaymentAmount] = useState(0);
  const [newPaymentPerson, setNewPaymentPerson] = useState('');

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [itemsData, categoriesData, shiftsData, customersData, customerPurchasesData, suppliesData, paymentsData] = await Promise.all([
        db.getItemsBySection(section),
        db.getCategoriesBySection(section),
        db.getShiftsBySection(section),
        db.getCustomersBySection(section),
        db.getUnpaidCustomerPurchases(section),
        db.getSuppliesBySection(section),
        db.getAllPayments()
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setShifts(shiftsData);
      setCustomers(customersData);
      setCustomerPurchases(customerPurchasesData);
      setSupplies(suppliesData);
      setPayments(paymentsData);

      if (section === 'supplement') {
        const debt = await db.getSupplementDebt();
        setSupplementDebt(debt);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const saveItem = async (item: Item) => {
    try {
      await db.saveItem(item);
      await loadData();
      setEditingItem(null);
      setShowNewItemModal(false);
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await db.deleteItem(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const saveCategory = async (category: Category) => {
    try {
      await db.saveCategory(category);
      await loadData();
      setEditingCategory(null);
      setShowNewCategoryModal(false);
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await db.deleteCategory(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to delete ${customer.name} and all associated data?`)) return;
    
    try {
      // Get all customer purchases
      const allCustomerPurchases = await db.getCustomerPurchases(customer.id);
      
      // Delete all customer purchases
      for (const purchase of allCustomerPurchases) {
        // Note: In a real implementation, you'd need a delete method for customer purchases
        // For now, we'll mark them as deleted by setting isPaid to true and adding a deleted flag
        purchase.isPaid = true;
        await db.saveCustomerPurchase(purchase);
      }
      
      // Delete customer (Note: You'd need to implement deleteCustomer in the database service)
      // For now, we'll just reload data
      await loadData();
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  const updateCustomerPurchase = async (purchase: CustomerPurchase) => {
    try {
      await db.saveCustomerPurchase(purchase);
      await loadData();
      setEditingCustomerPurchase(null);
    } catch (error) {
      console.error('Failed to update customer purchase:', error);
    }
  };

  const removeExpenseFromShift = async (shift: Shift, expenseId: string) => {
    if (!confirm('Are you sure you want to remove this expense?')) return;
    
    try {
      const expense = shift.expenses.find(e => e.id === expenseId);
      if (!expense) return;

      // Remove expense from shift
      shift.expenses = shift.expenses.filter(e => e.id !== expenseId);
      shift.totalAmount += expense.amount; // Return money to cashier balance
      
      await db.saveShift(shift);
      await loadData();
    } catch (error) {
      console.error('Failed to remove expense:', error);
    }
  };

  const addSupplementPayment = async () => {
    if (!user || newPaymentAmount <= 0 || !newPaymentPerson) return;

    try {
      const payment: Payment = {
        id: `payment-${Date.now()}`,
        amount: newPaymentAmount,
        paidBy: newPaymentPerson,
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.savePayment(payment);
      await loadData();
      setShowNewPaymentModal(false);
      setNewPaymentAmount(0);
      setNewPaymentPerson('');
    } catch (error) {
      console.error('Failed to add payment:', error);
    }
  };

  const updateSupplementDebt = async () => {
    if (!user) return;

    try {
      const debt: SupplementDebt = {
        amount: newDebtAmount,
        lastUpdated: new Date(),
        updatedBy: user.username
      };

      await db.saveSupplementDebt(debt);
      await loadData();
      setShowEditDebtModal(false);
    } catch (error) {
      console.error('Failed to update debt:', error);
    }
  };

  const calculateCurrentDebt = () => {
    if (!supplementDebt) return 0;
    
    const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalSupplyCosts = supplies.reduce((sum, supply) => sum + supply.totalCost, 0);
    
    return supplementDebt.amount - totalPayments + totalSupplyCosts;
  };

  const renderDashboard = () => {
    const activeShift = shifts.find(s => s.status === 'active');
    const todayShifts = shifts.filter(s => {
      const today = new Date().toDateString();
      return new Date(s.startTime).toDateString() === today;
    });
    
    const todayRevenue = todayShifts.reduce((sum, shift) => {
      return sum + shift.purchases.reduce((total, purchase) => total + (purchase.price * purchase.quantity), 0);
    }, 0);

    const todayProfit = todayShifts.reduce((sum, shift) => {
      return sum + shift.purchases.reduce((total, purchase) => {
        const item = items.find(i => i.id === purchase.itemId);
        const cost = item ? item.costPrice * purchase.quantity : 0;
        const revenue = purchase.price * purchase.quantity;
        return total + (revenue - cost);
      }, 0);
    }, 0);

    const totalCustomerDebt = customerPurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);
    const lowStockItems = items.filter(item => item.currentAmount < 10);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today's Profit</p>
                <p className="text-2xl font-bold text-gray-900">{todayProfit} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-full">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{todayRevenue} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-full">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Customer Debt</p>
                <p className="text-2xl font-bold text-gray-900">{totalCustomerDebt} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${activeShift ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Clock className={`h-6 w-6 ${activeShift ? 'text-green-600' : 'text-gray-600'}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Shift Status</p>
                <p className="text-2xl font-bold text-gray-900">{activeShift ? 'Active' : 'Closed'}</p>
              </div>
            </div>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-800">Low Stock Alert</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStockItems.map(item => (
                <div key={item.id} className="bg-white rounded p-3 border border-yellow-300">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-yellow-700">Stock: {item.currentAmount}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInventory = () => {
    const filteredItems = items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowNewCategoryModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </button>
            <button
              onClick={() => setShowNewItemModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map(category => {
                  const itemCount = items.filter(i => i.categoryId === category.id).length;
                  return (
                    <tr key={category.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {itemCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setEditingCategory(category)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCategory(category.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sell Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map(item => {
                  const category = categories.find(c => c.id === item.categoryId);
                  const profit = item.sellPrice - item.costPrice;
                  const totalCost = item.costPrice * item.currentAmount;
                  const totalProfit = profit * item.currentAmount;
                  
                  return (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {category?.name || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.costPrice} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.sellPrice} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {profit} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={item.currentAmount < 10 ? 'text-red-600 font-semibold' : ''}>
                          {item.currentAmount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {totalCost} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {totalProfit} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
  };

  const renderShifts = () => {
    if (selectedShift) {
      return renderShiftDetails();
    }

    const filteredShifts = shifts.filter(shift => 
      shift.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Shifts History</h2>
          <button
            onClick={() => generateShiftsPDF(shifts, section)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search shifts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ended</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Opened</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Closed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredShifts.map(shift => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shift.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(shift.startTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Active'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.totalAmount} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.purchases.reduce((total, p) => total + p.quantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.expenses.reduce((total, e) => total + e.amount, 0)} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        shift.validationStatus === 'balanced' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {shift.validationStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.status === 'closed' ? shift.username : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedShift(shift)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
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
  };

  const renderShiftDetails = () => {
    if (!selectedShift) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Shift Details</h2>
          <button
            onClick={() => setSelectedShift(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Shift Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Shift Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Shift ID</p>
              <p className="text-lg font-semibold text-gray-900">{selectedShift.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Date/Time Started</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(selectedShift.startTime).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Date/Time Ended</p>
              <p className="text-lg font-semibold text-gray-900">
                {selectedShift.endTime ? new Date(selectedShift.endTime).toLocaleString() : 'Active'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Cash</p>
              <p className="text-lg font-semibold text-gray-900">{selectedShift.totalAmount} EGP</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Items Sold</p>
              <p className="text-lg font-semibold text-gray-900">
                {selectedShift.purchases.reduce((total, p) => total + p.quantity, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Validation Status</p>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                selectedShift.validationStatus === 'balanced' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {selectedShift.validationStatus}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">User Opened</p>
              <p className="text-lg font-semibold text-gray-900">{selectedShift.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">User Closed</p>
              <p className="text-lg font-semibold text-gray-900">
                {selectedShift.status === 'closed' ? selectedShift.username : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Expenses</h3>
          </div>
          {selectedShift.expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    {selectedShift.status === 'active' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedShift.expenses.map(expense => (
                    <tr key={expense.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {expense.amount} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(expense.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.createdBy}
                      </td>
                      {selectedShift.status === 'active' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => removeExpenseFromShift(selectedShift, expense.id)}
                            className="text-red-600 hover:text-red-900 flex items-center"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No expenses recorded for this shift
            </div>
          )}
        </div>

        {/* Close Reason Note */}
        {selectedShift.closeReason && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-800">Close Reason</h3>
            </div>
            <p className="text-yellow-700">{selectedShift.closeReason}</p>
          </div>
        )}

        {/* Discrepancies */}
        {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-red-800">Discrepancies Found</h3>
            </div>
            <ul className="list-disc list-inside text-red-700">
              {selectedShift.discrepancies.map((discrepancy, index) => (
                <li key={index}>{discrepancy}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderCustomers = () => {
    if (selectedCustomer) {
      return renderCustomerDetails();
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map(customer => {
            const customerDebt = customerPurchases
              .filter(cp => cp.customerId === customer.id && !cp.isPaid)
              .reduce((total, cp) => total + cp.totalAmount, 0);

            return (
              <div 
                key={customer.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    customerDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {customerDebt > 0 ? `${customerDebt} EGP debt` : 'Paid up'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div>Created: {new Date(customer.createdAt).toLocaleDateString()}</div>
                  <div>Total purchases: {customerPurchases.filter(cp => cp.customerId === customer.id).length}</div>
                  <div>Outstanding debt: {customerDebt} EGP</div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => deleteCustomer(customer)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCustomerDetails = () => {
    if (!selectedCustomer) return null;

    const todayPurchases = customerPurchases.filter(cp => 
      cp.customerId === selectedCustomer.id && 
      !cp.isPaid && 
      cp.shiftId === shifts.find(s => s.status === 'active')?.id
    );

    const allTimePurchases = customerPurchases.filter(cp => 
      cp.customerId === selectedCustomer.id && 
      !cp.isPaid
    );

    const todayTotal = todayPurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);
    const allTimeTotal = allTimePurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h2>
          <button
            onClick={() => setSelectedCustomer(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Customer Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setCustomerTab('today')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                customerTab === 'today'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Today's Items ({todayTotal} EGP)
            </button>
            <button
              onClick={() => setCustomerTab('alltime')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                customerTab === 'alltime'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All-Time Items ({allTimeTotal} EGP)
            </button>
          </nav>
        </div>

        {/* Today's Items */}
        {customerTab === 'today' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Today's Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {todayPurchases.flatMap(purchase => 
                    purchase.items.map((item, index) => (
                      <tr key={`${purchase.id}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingCustomerPurchase?.id === purchase.id ? (
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQuantity = parseInt(e.target.value) || 0;
                                const updatedPurchase = { ...purchase };
                                updatedPurchase.items[index].quantity = newQuantity;
                                updatedPurchase.totalAmount = updatedPurchase.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                setEditingCustomerPurchase(updatedPurchase);
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price * item.quantity} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingCustomerPurchase?.id === purchase.id ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateCustomerPurchase(editingCustomerPurchase)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingCustomerPurchase(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingCustomerPurchase(purchase)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All-Time Items */}
        {customerTab === 'alltime' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">All-Time Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Taken</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allTimePurchases.flatMap(purchase => 
                    purchase.items.map((item, index) => (
                      <tr key={`${purchase.id}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingCustomerPurchase?.id === purchase.id ? (
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQuantity = parseInt(e.target.value) || 0;
                                const updatedPurchase = { ...purchase };
                                updatedPurchase.items[index].quantity = newQuantity;
                                updatedPurchase.totalAmount = updatedPurchase.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                setEditingCustomerPurchase(updatedPurchase);
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price * item.quantity} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(purchase.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingCustomerPurchase?.id === purchase.id ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateCustomerPurchase(editingCustomerPurchase)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingCustomerPurchase(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingCustomerPurchase(purchase)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPayments = () => {
    if (section !== 'supplement') return null;

    const currentDebt = calculateCurrentDebt();

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Supplement Payments</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowEditDebtModal(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Debt
            </button>
            <button
              onClick={() => setShowNewPaymentModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Person/Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Debt Row */}
                {supplementDebt && (
                  <tr className="bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-900">
                      Debt
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-900">
                      {supplementDebt.amount} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">
                      Updated by {supplementDebt.updatedBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">
                      {new Date(supplementDebt.lastUpdated).toLocaleDateString()}
                    </td>
                  </tr>
                )}

                {/* Payment Rows */}
                {payments.map(payment => (
                  <tr key={payment.id} className="bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                      Payment
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-900">
                      -{payment.amount} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700">
                      {payment.paidBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700">
                      {new Date(payment.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {/* Supply Cost Rows */}
                {supplies.map(supply => (
                  <tr key={supply.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                      New Supply
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                      +{supply.totalCost} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700">
                      Total cost of new supply
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700">
                      {new Date(supply.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {/* Current Debt Row */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    Current Debt
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {currentDebt} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    Calculated Balance
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date().toLocaleDateString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderProfit = () => {
    const monthlyShifts = shifts.filter(shift => {
      const shiftMonth = new Date(shift.startTime).toISOString().slice(0, 7);
      return shiftMonth === selectedMonth;
    });

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

    const totalRevenue = Object.values(itemTotals).reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalCost = Object.values(itemTotals).reduce((sum, item) => sum + item.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalExpenses = monthlyShifts.reduce((sum, shift) => sum + shift.expenses.reduce((total, e) => total + e.amount, 0), 0);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Profit Analysis</h2>
          <div className="flex items-center space-x-4">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => generateMonthlySummaryPDF(monthlyShifts, items, section, selectedMonth)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{totalRevenue} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-red-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">{totalCost} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Profit</p>
                <p className="text-2xl font-bold text-gray-900">{totalProfit} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-orange-100 p-3 rounded-full">
                <Receipt className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900">{totalExpenses} EGP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Item Details Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Item Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit Margin</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.values(itemTotals)
                  .sort((a, b) => b.totalProfit - a.totalProfit)
                  .map((item, index) => {
                    const profitMargin = item.totalRevenue > 0 ? ((item.totalProfit / item.totalRevenue) * 100).toFixed(1) : '0';
                    return (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.totalSold}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.totalCost} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.totalRevenue} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.totalProfit} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {profitMargin}%
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
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'inventory'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {section === 'supplement' ? 'Storage' : 'Inventory'}
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shifts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {section === 'supplement' ? 'Daily Shifts' : 'Shifts History'}
          </button>
          <button
            onClick={() => setActiveTab('profit')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profit'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {section === 'supplement' ? 'Monthly Summary' : 'Profit'}
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'customers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Customers
          </button>
          {section === 'supplement' && (
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Payments
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'inventory' && renderInventory()}
      {activeTab === 'shifts' && renderShifts()}
      {activeTab === 'profit' && renderProfit()}
      {activeTab === 'customers' && renderCustomers()}
      {activeTab === 'payments' && renderPayments()}

      {/* Modals */}
      {showNewItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
            <ItemForm
              item={null}
              categories={categories}
              section={section}
              onSave={saveItem}
              onCancel={() => setShowNewItemModal(false)}
            />
          </div>
        </div>
      )}

      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Category</h3>
            <CategoryForm
              category={null}
              section={section}
              onSave={saveCategory}
              onCancel={() => setShowNewCategoryModal(false)}
            />
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Item</h3>
            <ItemForm
              item={editingItem}
              categories={categories}
              section={section}
              onSave={saveItem}
              onCancel={() => setEditingItem(null)}
            />
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Category</h3>
            <CategoryForm
              category={editingCategory}
              section={section}
              onSave={saveCategory}
              onCancel={() => setEditingCategory(null)}
            />
          </div>
        </div>
      )}

      {showNewPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input
                  type="number"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
                <input
                  type="text"
                  value={newPaymentPerson}
                  onChange={(e) => setNewPaymentPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Person name"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={addSupplementPayment}
                disabled={newPaymentAmount <= 0 || !newPaymentPerson}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Add Payment
              </button>
              <button
                onClick={() => {
                  setShowNewPaymentModal(false);
                  setNewPaymentAmount(0);
                  setNewPaymentPerson('');
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Debt</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debt Amount (EGP)</label>
                <input
                  type="number"
                  value={newDebtAmount}
                  onChange={(e) => setNewDebtAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={updateSupplementDebt}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Update Debt
              </button>
              <button
                onClick={() => {
                  setShowEditDebtModal(false);
                  setNewDebtAmount(0);
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

// Item Form Component
interface ItemFormProps {
  item: Item | null;
  categories: Category[];
  section: 'store' | 'supplement';
  onSave: (item: Item) => void;
  onCancel: () => void;
}

const ItemForm: React.FC<ItemFormProps> = ({ item, categories, section, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    costPrice: item?.costPrice || 0,
    sellPrice: item?.sellPrice || 0,
    currentAmount: item?.currentAmount || 0,
    categoryId: item?.categoryId || '',
    image: item?.image || ''
  });

  const handleSubmit = () => {
    const newItem: Item = {
      id: item?.id || `${section}-${Date.now()}`,
      name: formData.name,
      costPrice: formData.costPrice,
      sellPrice: formData.sellPrice,
      currentAmount: formData.currentAmount,
      categoryId: formData.categoryId || undefined,
      image: formData.image || undefined,
      section,
      createdAt: item?.createdAt || new Date(),
      updatedAt: new Date()
    };

    onSave(newItem);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={formData.categoryId}
          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Category</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (EGP)</label>
          <input
            type="number"
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="0"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price (EGP)</label>
          <input
            type="number"
            value={formData.sellPrice}
            onChange={(e) => setFormData({ ...formData, sellPrice: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="0"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
        <input
          type="number"
          value={formData.currentAmount}
          onChange={(e) => setFormData({ ...formData, currentAmount: parseInt(e.target.value) || 0 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min="0"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
        <input
          type="url"
          value={formData.image}
          onChange={(e) => setFormData({ ...formData, image: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div className="flex space-x-3 mt-6">
        <button
          onClick={handleSubmit}
          disabled={!formData.name || formData.costPrice <= 0 || formData.sellPrice <= 0}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {item ? 'Update' : 'Create'} Item
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Category Form Component
interface CategoryFormProps {
  category: Category | null;
  section: 'store' | 'supplement';
  onSave: (category: Category) => void;
  onCancel: () => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ category, section, onSave, onCancel }) => {
  const [name, setName] = useState(category?.name || '');

  const handleSubmit = () => {
    const newCategory: Category = {
      id: category?.id || `${section}-category-${Date.now()}`,
      name,
      section,
      createdAt: category?.createdAt || new Date()
    };

    onSave(newCategory);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter category name"
          required
        />
      </div>

      <div className="flex space-x-3 mt-6">
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {category ? 'Update' : 'Create'} Category
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AdminView;