import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, History, Settings, Users, Receipt, Plus, Edit, Trash2, Save, X, DollarSign, FileText, AlertCircle, CheckCircle, Clock, Store, Apple as Supplement } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Item, Shift, Supply, Category, Customer, CustomerPurchase, Expense, ShiftEdit } from '../types';
import { db } from '../services/database';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';
import NormalUserView from './NormalUserView';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'storage' | 'inventory' | 'profit' | 'customers' | 'shifts' | 'supplies' | 'settings' | 'adminLog' | 'supplement'>('current');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [adminLogs, setAdminLogs] = useState<ShiftEdit[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<number>(0);
  const [supplementPayments, setSupplementPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Item>>({
    name: '',
    sellPrice: 0,
    costPrice: 0,
    currentAmount: 0,
    section
  });
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: '',
    section
  });
  const [newSupply, setNewSupply] = useState<Record<string, number>>({});
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentPerson, setPaymentPerson] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [itemsData, categoriesData, shiftsData, suppliesData, customersData, customerPurchasesData, adminLogsData] = await Promise.all([
        db.getItemsBySection(section),
        db.getCategoriesBySection(section),
        db.getShiftsBySection(section),
        db.getSuppliesBySection(section),
        db.getCustomersBySection(section),
        db.getUnpaidCustomerPurchases(section),
        db.getShiftEdits('all')
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setCustomers(customersData);
      setCustomerPurchases(customerPurchasesData);
      setAdminLogs(adminLogsData);

      // Load supplement debt if in supplement section
      if (section === 'supplement') {
        const debt = await db.getSupplementDebt();
        setSupplementDebt(debt?.amount || 0);
        
        // Load supplement payments (stored as settings)
        const payments = await db.getSetting('supplementPayments') || [];
        setSupplementPayments(payments);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const logAdminAction = async (action: string, details: string, itemId?: string, shiftId?: string) => {
    if (!user) return;

    const log: ShiftEdit = {
      id: `admin-log-${Date.now()}`,
      shiftId: shiftId || 'admin-action',
      field: action,
      oldValue: '',
      newValue: details,
      reason: 'Admin action',
      timestamp: new Date(),
      editedBy: user.username
    };

    await db.saveShiftEdit(log);
    await loadData();
  };

  const saveItem = async () => {
    if (!user || !newItem.name || !newItem.sellPrice || !newItem.costPrice) return;

    setIsLoading(true);
    try {
      const item: Item = {
        id: editingItem?.id || `${section}-${Date.now()}`,
        name: newItem.name,
        sellPrice: newItem.sellPrice,
        costPrice: newItem.costPrice,
        currentAmount: newItem.currentAmount || 0,
        categoryId: newItem.categoryId,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db.saveItem(item);
      
      const action = editingItem ? 'Edit Item' : 'Add Item';
      const details = editingItem 
        ? `Modified ${item.name}: Price ${editingItem.sellPrice} → ${item.sellPrice} EGP`
        : `Added ${item.name}: ${item.sellPrice} EGP, Stock: ${item.currentAmount}`;
      
      await logAdminAction(action, details, item.id);
      
      setEditingItem(null);
      setShowAddItem(false);
      setNewItem({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, section });
      await loadData();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (item: Item) => {
    if (!user || !confirm(`Delete ${item.name}?`)) return;

    setIsLoading(true);
    try {
      await db.deleteItem(item.id);
      await logAdminAction('Delete Item', `Deleted ${item.name}`, item.id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCategory = async () => {
    if (!user || !newCategory.name) return;

    setIsLoading(true);
    try {
      const category: Category = {
        id: `${section}-cat-${Date.now()}`,
        name: newCategory.name,
        section,
        createdAt: new Date()
      };

      await db.saveCategory(category);
      await logAdminAction('Add Category', `Added category: ${category.name}`);
      
      setShowAddCategory(false);
      setNewCategory({ name: '', section });
      await loadData();
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSupply = async () => {
    if (!user || Object.keys(newSupply).length === 0) return;

    setIsLoading(true);
    try {
      const totalCost = Object.entries(newSupply).reduce((total, [itemId, quantity]) => {
        const item = items.find(i => i.id === itemId);
        return total + (item ? item.costPrice * quantity : 0);
      }, 0);

      const supply: Supply = {
        id: `${section}-supply-${Date.now()}`,
        section,
        items: newSupply,
        totalCost,
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.saveSupply(supply);

      // Update item amounts
      for (const [itemId, quantity] of Object.entries(newSupply)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          item.currentAmount += quantity;
          item.updatedAt = new Date();
          await db.saveItem(item);
        }
      }

      // Update supplement debt if in supplement section
      if (section === 'supplement') {
        const newDebt = supplementDebt + totalCost;
        await db.saveSupplementDebt({
          amount: newDebt,
          lastUpdated: new Date(),
          updatedBy: user.username
        });
        
        // Add to payments list
        const newPayments = [...supplementPayments, {
          id: `supply-${Date.now()}`,
          type: 'supply',
          amount: totalCost,
          description: `New supply cost`,
          date: new Date(),
          createdBy: user.username
        }];
        
        await db.saveSetting('supplementPayments', newPayments);
        setSupplementPayments(newPayments);
        setSupplementDebt(newDebt);
      }

      await logAdminAction('Add Supply', `Added supply worth ${totalCost} EGP`);
      
      setShowAddSupply(false);
      setNewSupply({});
      await loadData();
    } catch (error) {
      console.error('Failed to save supply:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addSupplementPayment = async () => {
    if (!user || paymentAmount <= 0 || !paymentPerson) return;

    setIsLoading(true);
    try {
      const newDebt = supplementDebt - paymentAmount;
      
      await db.saveSupplementDebt({
        amount: newDebt,
        lastUpdated: new Date(),
        updatedBy: user.username
      });

      const newPayments = [...supplementPayments, {
        id: `payment-${Date.now()}`,
        type: 'payment',
        amount: paymentAmount,
        person: paymentPerson,
        description: `Payment by ${paymentPerson}`,
        date: new Date(),
        createdBy: user.username
      }];
      
      await db.saveSetting('supplementPayments', newPayments);
      
      setSupplementPayments(newPayments);
      setSupplementDebt(newDebt);
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentPerson('');
      
      await logAdminAction('Supplement Payment', `Payment: ${paymentAmount} EGP by ${paymentPerson}`);
    } catch (error) {
      console.error('Failed to add payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDailySummary = () => {
    const today = new Date().toDateString();
    const todayShifts = shifts.filter(s => 
      new Date(s.startTime).toDateString() === today && s.status === 'closed'
    );

    const summary = {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalExpenses: 0,
      itemsSold: {} as Record<string, { quantity: number; revenue: number; cost: number; profit: number; name: string }>
    };

    todayShifts.forEach(shift => {
      shift.purchases.forEach(purchase => {
        const item = items.find(i => i.id === purchase.itemId);
        const cost = item ? item.costPrice * purchase.quantity : 0;
        const revenue = purchase.price * purchase.quantity;
        const profit = revenue - cost;

        summary.totalRevenue += revenue;
        summary.totalCost += cost;
        summary.totalProfit += profit;

        if (!summary.itemsSold[purchase.itemId]) {
          summary.itemsSold[purchase.itemId] = {
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            name: purchase.name
          };
        }

        summary.itemsSold[purchase.itemId].quantity += purchase.quantity;
        summary.itemsSold[purchase.itemId].revenue += revenue;
        summary.itemsSold[purchase.itemId].cost += cost;
        summary.itemsSold[purchase.itemId].profit += profit;
      });

      summary.totalExpenses += shift.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    });

    // Add customer payments from today
    const todayCustomerPayments = customerPurchases.filter(cp => 
      cp.isPaid && new Date(cp.timestamp).toDateString() === today
    );

    todayCustomerPayments.forEach(payment => {
      payment.items.forEach(item => {
        const itemData = items.find(i => i.id === item.itemId);
        const cost = itemData ? itemData.costPrice * item.quantity : 0;
        const revenue = item.price * item.quantity;
        const profit = revenue - cost;

        summary.totalRevenue += revenue;
        summary.totalCost += cost;
        summary.totalProfit += profit;

        if (!summary.itemsSold[item.itemId]) {
          summary.itemsSold[item.itemId] = {
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            name: item.name
          };
        }

        summary.itemsSold[item.itemId].quantity += item.quantity;
        summary.itemsSold[item.itemId].revenue += revenue;
        summary.itemsSold[item.itemId].cost += cost;
        summary.itemsSold[item.itemId].profit += profit;
      });
    });

    return summary;
  };

  const calculateMonthlySummary = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyShifts = shifts.filter(s => {
      const shiftDate = new Date(s.startTime);
      return shiftDate.getMonth() === currentMonth && 
             shiftDate.getFullYear() === currentYear && 
             s.status === 'closed';
    });

    const summary = {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalExpenses: 0,
      itemsSold: {} as Record<string, { quantity: number; revenue: number; cost: number; profit: number; name: string }>
    };

    monthlyShifts.forEach(shift => {
      shift.purchases.forEach(purchase => {
        const item = items.find(i => i.id === purchase.itemId);
        const cost = item ? item.costPrice * purchase.quantity : 0;
        const revenue = purchase.price * purchase.quantity;
        const profit = revenue - cost;

        summary.totalRevenue += revenue;
        summary.totalCost += cost;
        summary.totalProfit += profit;

        if (!summary.itemsSold[purchase.itemId]) {
          summary.itemsSold[purchase.itemId] = {
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            name: purchase.name
          };
        }

        summary.itemsSold[purchase.itemId].quantity += purchase.quantity;
        summary.itemsSold[purchase.itemId].revenue += revenue;
        summary.itemsSold[purchase.itemId].cost += cost;
        summary.itemsSold[purchase.itemId].profit += profit;
      });

      summary.totalExpenses += shift.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    });

    // Add all customer payments from this month
    const monthlyCustomerPayments = customerPurchases.filter(cp => {
      const paymentDate = new Date(cp.timestamp);
      return cp.isPaid && 
             paymentDate.getMonth() === currentMonth && 
             paymentDate.getFullYear() === currentYear;
    });

    monthlyCustomerPayments.forEach(payment => {
      payment.items.forEach(item => {
        const itemData = items.find(i => i.id === item.itemId);
        const cost = itemData ? itemData.costPrice * item.quantity : 0;
        const revenue = item.price * item.quantity;
        const profit = revenue - cost;

        summary.totalRevenue += revenue;
        summary.totalCost += cost;
        summary.totalProfit += profit;

        if (!summary.itemsSold[item.itemId]) {
          summary.itemsSold[item.itemId] = {
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            name: item.name
          };
        }

        summary.itemsSold[item.itemId].quantity += item.quantity;
        summary.itemsSold[item.itemId].revenue += revenue;
        summary.itemsSold[item.itemId].cost += cost;
        summary.itemsSold[item.itemId].profit += profit;
      });
    });

    return summary;
  };

  const renderCurrentShiftTab = () => {
    return <NormalUserView section={section} />;
  };

  const renderStorageTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Storage Management</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAddCategory(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </button>
          <button
            onClick={() => setShowAddSupply(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Package className="h-4 w-4 mr-2" />
            Add Supply
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map(category => (
            <div key={category.id} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900">{category.name}</h4>
              <p className="text-sm text-gray-500">
                {items.filter(i => i.categoryId === category.id).length} items
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Items Table */}
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
              {items.map(item => {
                const category = categories.find(c => c.id === item.categoryId);
                const profit = item.sellPrice - item.costPrice;
                const totalCost = item.costPrice * item.currentAmount;
                const totalProfit = profit * item.currentAmount;
                
                return (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {category?.name || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.costPrice} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.sellPrice} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {profit} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.currentAmount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {totalCost} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {totalProfit} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setNewItem(item);
                          setShowAddItem(true);
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

  const renderInventoryTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Inventory Overview</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Stock Levels</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.currentAmount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.currentAmount === 0 
                        ? 'bg-red-100 text-red-800'
                        : item.currentAmount < 10
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.currentAmount === 0 ? 'Out of Stock' : item.currentAmount < 10 ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderProfitTab = () => {
    const dailySummary = calculateDailySummary();
    const monthlySummary = calculateMonthlySummary();

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Profit Analysis</h2>

        {/* Daily Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{dailySummary.totalRevenue} EGP</div>
              <div className="text-sm text-blue-800">Total Revenue</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{dailySummary.totalCost} EGP</div>
              <div className="text-sm text-red-800">Total Cost</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{dailySummary.totalProfit} EGP</div>
              <div className="text-sm text-green-800">Total Profit</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{dailySummary.totalExpenses} EGP</div>
              <div className="text-sm text-orange-800">Total Expenses</div>
            </div>
          </div>

          {Object.keys(dailySummary.itemsSold).length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.values(dailySummary.itemsSold).map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.revenue} EGP</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.cost} EGP</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{item.profit} EGP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Monthly Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month's Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{monthlySummary.totalRevenue} EGP</div>
              <div className="text-sm text-blue-800">Total Revenue</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{monthlySummary.totalCost} EGP</div>
              <div className="text-sm text-red-800">Total Cost</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{monthlySummary.totalProfit} EGP</div>
              <div className="text-sm text-green-800">Total Profit</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{monthlySummary.totalExpenses} EGP</div>
              <div className="text-sm text-orange-800">Total Expenses</div>
            </div>
          </div>

          {Object.keys(monthlySummary.itemsSold).length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sold</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.values(monthlySummary.itemsSold).map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.revenue} EGP</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.cost} EGP</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{item.profit} EGP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomersTab = () => (
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
            <div key={customer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  customerDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {customerDebt > 0 ? `${customerDebt} EGP debt` : 'Paid up'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div>Created: {new Date(customer.createdAt).toLocaleDateString()}</div>
                <div>Total purchases: {customerPurchases.filter(cp => cp.customerId === customer.id).length}</div>
                <div>Outstanding debt: {customerDebt} EGP</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderShiftsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Shifts History</h2>
        <button
          onClick={() => generateShiftsPDF(shifts, section)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ended</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cash</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.map(shift => (
                <tr key={shift.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {shift.id.split('-').pop()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(shift.startTime).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Active'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shift.username}
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : shift.validationStatus === 'balanced'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {shift.status === 'active' ? 'Active' : 
                       shift.validationStatus === 'balanced' ? 'Balanced' : 'Discrepancy'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAdminLogTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Admin Activity Log</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {adminLogs
                .filter(log => log.shiftId === 'admin-action')
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map(log => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.field}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.newValue}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.editedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSupplementTab = () => {
    if (section !== 'supplement') return null;

    const currentDebt = supplementDebt - 
      supplementPayments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0) +
      supplementPayments.filter(p => p.type === 'supply').reduce((sum, p) => sum + p.amount, 0);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Supplement Management</h2>
        </div>

        {/* Sub-tabs for supplement section */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['storage', 'profit', 'shifts', 'payments'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Supplement Payments</h3>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Add Payment
              </button>
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
                    <tr className="bg-red-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-900">Initial Debt</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900">{supplementDebt} EGP</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900">Starting balance</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900">-</td>
                    </tr>
                    {supplementPayments.map(payment => (
                      <tr key={payment.id} className={payment.type === 'payment' ? 'bg-green-50' : 'bg-orange-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {payment.type === 'payment' ? 'Payment' : 'New Supply'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {payment.type === 'payment' ? '-' : '+'}{payment.amount} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {payment.person || payment.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-semibold">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">Current Debt</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">{currentDebt} EGP</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">Outstanding balance</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'storage' && renderStorageTab()}
        {activeTab === 'profit' && renderProfitTab()}
        {activeTab === 'shifts' && renderShiftsTab()}
      </div>
    );
  };

  const tabs = [
    { id: 'current', label: 'Current Shift', icon: Clock },
    { id: 'storage', label: 'Storage', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'profit', label: 'Profit', icon: TrendingUp },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'shifts', label: 'Shifts History', icon: History },
    { id: 'adminLog', label: 'Admin Log', icon: FileText },
    ...(section === 'supplement' ? [{ id: 'supplement', label: 'Supplement', icon: Supplement }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
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
      {activeTab === 'current' && renderCurrentShiftTab()}
      {activeTab === 'storage' && renderStorageTab()}
      {activeTab === 'inventory' && renderInventoryTab()}
      {activeTab === 'profit' && renderProfitTab()}
      {activeTab === 'customers' && renderCustomersTab()}
      {activeTab === 'shifts' && renderShiftsTab()}
      {activeTab === 'adminLog' && renderAdminLogTab()}
      {activeTab === 'supplement' && renderSupplementTab()}

      {/* Add Item Modal */}
      {showAddItem && (
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
                  value={newItem.name || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newItem.categoryId || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, categoryId: e.target.value }))}
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
                    value={newItem.costPrice || 0}
                    onChange={(e) => setNewItem(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price (EGP)</label>
                  <input
                    type="number"
                    value={newItem.sellPrice || 0}
                    onChange={(e) => setNewItem(prev => ({ ...prev, sellPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                <input
                  type="number"
                  value={newItem.currentAmount || 0}
                  onChange={(e) => setNewItem(prev => ({ ...prev, currentAmount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveItem}
                disabled={isLoading || !newItem.name || !newItem.sellPrice || !newItem.costPrice}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingItem ? 'Update' : 'Save'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddItem(false);
                  setEditingItem(null);
                  setNewItem({ name: '', sellPrice: 0, costPrice: 0, currentAmount: 0, section });
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Category</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name || ''}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Beverages, Snacks"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveCategory}
                disabled={isLoading || !newCategory.name}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save Category'}
              </button>
              <button
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategory({ name: '', section });
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supply Modal */}
      {showAddSupply && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Add Supply</h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({item.costPrice} EGP each)</span>
                  </div>
                  <input
                    type="number"
                    value={newSupply[item.id] || 0}
                    onChange={(e) => setNewSupply(prev => ({
                      ...prev,
                      [item.id]: parseInt(e.target.value) || 0
                    }))}
                    className="w-20 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">
                Total Cost: {Object.entries(newSupply).reduce((total, [itemId, quantity]) => {
                  const item = items.find(i => i.id === itemId);
                  return total + (item ? item.costPrice * quantity : 0);
                }, 0)} EGP
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveSupply}
                disabled={isLoading || Object.keys(newSupply).length === 0}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Add Supply'}
              </button>
              <button
                onClick={() => {
                  setShowAddSupply(false);
                  setNewSupply({});
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Payment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Person Name</label>
                <input
                  type="text"
                  value={paymentPerson}
                  onChange={(e) => setPaymentPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., James"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={addSupplementPayment}
                disabled={isLoading || paymentAmount <= 0 || !paymentPerson}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add Payment'}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount(0);
                  setPaymentPerson('');
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