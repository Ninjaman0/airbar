import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Save, X, Package, DollarSign, 
  TrendingUp, Calendar, Users, FileText, Settings, Receipt, 
  Download, Eye, AlertCircle, CheckCircle, UserPlus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Item, Category, Shift, Supply, Payment, DailySummary, 
  MonthlySummary, SupplementDebt, Customer, CustomerPurchase, 
  User, AdminLog
} from '../types';
import { db } from '../services/database';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'Bar' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'shifts' | 'profit' | 'payments' | 'customers' | 'users' | 'adminlog'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditDebt, setShowEditDebt] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Item>>({});
  const [newCategory, setNewCategory] = useState<Partial<Category>>({});
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [newPayment, setNewPayment] = useState({ amount: 0, paidBy: '' });
  const [newDebtAmount, setNewDebtAmount] = useState(0);
  const [supplyItems, setSupplyItems] = useState<Record<string, number>>({});
  const [supplyCost, setSupplyCost] = useState(0);

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [
        itemsData, categoriesData, shiftsData, suppliesData, 
        paymentsData, customersData, customerPurchasesData,
        usersData, adminLogsData
      ] = await Promise.all([
        db.getItemsBySection(section),
        db.getCategoriesBySection(section),
        db.getShiftsBySection(section),
        db.getSuppliesBySection(section),
        db.getAllPayments(),
        db.getCustomersBySection(section),
        db.getUnpaidCustomerPurchases(section),
        db.getAllUsers(),
        db.getAllAdminLogs()
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setPayments(paymentsData);
      setCustomers(customersData);
      setCustomerPurchases(customerPurchasesData);
      setUsers(usersData);
      setAdminLogs(adminLogsData);

      if (section === 'supplement') {
        const debt = await db.getSupplementDebt();
        setSupplementDebt(debt);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const logAdminAction = async (actionType: string, itemOrShiftAffected: string, changeDetails: string) => {
    if (!user) return;
    
    const log: AdminLog = {
      id: `log-${Date.now()}`,
      actionType,
      itemOrShiftAffected,
      changeDetails,
      timestamp: new Date(),
      adminName: user.username,
      section
    };

    await db.saveAdminLog(log);
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
        image: newItem.image,
        categoryId: newItem.categoryId,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db.saveItem(item);
      
      // Log admin action
      const action = editingItem ? 'Edit Item' : 'Add Item';
      const details = editingItem 
        ? `Updated ${item.name}: Price ${item.sellPrice} EGP, Cost ${item.costPrice} EGP, Stock ${item.currentAmount}`
        : `Added ${item.name}: Price ${item.sellPrice} EGP, Cost ${item.costPrice} EGP, Stock ${item.currentAmount}`;
      await logAdminAction(action, item.name, details);

      await loadData();
      setShowAddItem(false);
      setEditingItem(null);
      setNewItem({});
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (item: Item) => {
    if (!user || !confirm(`Are you sure you want to delete ${item.name}?`)) return;

    setIsLoading(true);
    try {
      await db.deleteItem(item.id);
      await logAdminAction('Delete Item', item.name, `Deleted item: ${item.name}`);
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
        id: editingCategory?.id || `cat-${Date.now()}`,
        name: newCategory.name,
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db.saveCategory(category);
      
      const action = editingCategory ? 'Edit Category' : 'Add Category';
      await logAdminAction(action, category.name, `${action}: ${category.name}`);

      await loadData();
      setShowAddCategory(false);
      setEditingCategory(null);
      setNewCategory({});
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!user || !confirm(`Are you sure you want to delete ${category.name}?`)) return;

    setIsLoading(true);
    try {
      await db.deleteCategory(category.id);
      await logAdminAction('Delete Category', category.name, `Deleted category: ${category.name}`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async () => {
    if (!user || !newUser.username || !newUser.password || !newUser.role) return;

    setIsLoading(true);
    try {
      const userToSave: User = {
        id: editingUser?.id || `user-${Date.now()}`,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        createdAt: editingUser?.createdAt || new Date()
      };

      if (editingUser) {
        await db.updateUser(userToSave);
      } else {
        await db.createUser(userToSave);
      }
      
      const action = editingUser ? 'Edit User' : 'Add User';
      await logAdminAction(action, userToSave.username, `${action}: ${userToSave.username} (${userToSave.role})`);

      await loadData();
      setShowAddUser(false);
      setEditingUser(null);
      setNewUser({});
    } catch (error) {
      console.error('Failed to save user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (!user || userToDelete.id === user.id || !confirm(`Are you sure you want to delete ${userToDelete.username}?`)) return;

    setIsLoading(true);
    try {
      await db.deleteUser(userToDelete.id);
      await logAdminAction('Delete User', userToDelete.username, `Deleted user: ${userToDelete.username}`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addSupply = async () => {
    if (!user || Object.keys(supplyItems).length === 0 || supplyCost <= 0) return;

    setIsLoading(true);
    try {
      const supply: Supply = {
        id: `supply-${Date.now()}`,
        section,
        items: supplyItems,
        totalCost: supplyCost,
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.saveSupply(supply);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyItems)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          item.currentAmount += quantity;
          item.updatedAt = new Date();
          await db.saveItem(item);
        }
      }

      // Update supplement debt if applicable
      if (section === 'supplement') {
        const currentDebt = supplementDebt?.amount || 0;
        const newDebt: SupplementDebt = {
          amount: currentDebt + supplyCost,
          lastUpdated: new Date(),
          updatedBy: user.username
        };
        await db.saveSupplementDebt(newDebt);
        setSupplementDebt(newDebt);
      }

      const itemDetails = Object.entries(supplyItems)
        .map(([itemId, qty]) => {
          const item = items.find(i => i.id === itemId);
          return `${item?.name}: +${qty}`;
        })
        .join(', ');
      
      await logAdminAction('Add Supply', 'Multiple Items', `Added supply: ${itemDetails}, Total Cost: ${supplyCost} EGP`);

      await loadData();
      setShowAddSupply(false);
      setSupplyItems({});
      setSupplyCost(0);
    } catch (error) {
      console.error('Failed to add supply:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addPayment = async () => {
    if (!user || newPayment.amount <= 0 || !newPayment.paidBy) return;

    setIsLoading(true);
    try {
      const payment: Payment = {
        id: `payment-${Date.now()}`,
        amount: newPayment.amount,
        paidBy: newPayment.paidBy,
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.savePayment(payment);

      // Update supplement debt
      if (section === 'supplement') {
        const currentDebt = supplementDebt?.amount || 0;
        const newDebt: SupplementDebt = {
          amount: currentDebt - newPayment.amount,
          lastUpdated: new Date(),
          updatedBy: user.username
        };
        await db.saveSupplementDebt(newDebt);
        setSupplementDebt(newDebt);
      }

      await logAdminAction('Add Payment', 'Supplement Debt', `Payment: ${newPayment.amount} EGP by ${newPayment.paidBy}`);

      await loadData();
      setShowPaymentModal(false);
      setNewPayment({ amount: 0, paidBy: '' });
    } catch (error) {
      console.error('Failed to add payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDebt = async () => {
    if (!user || newDebtAmount < 0) return;

    setIsLoading(true);
    try {
      const newDebt: SupplementDebt = {
        amount: newDebtAmount,
        lastUpdated: new Date(),
        updatedBy: user.username
      };

      await db.saveSupplementDebt(newDebt);
      setSupplementDebt(newDebt);
      
      await logAdminAction('Edit Debt', 'Supplement Debt', `Updated debt to: ${newDebtAmount} EGP`);

      setShowEditDebt(false);
      setNewDebtAmount(0);
    } catch (error) {
      console.error('Failed to update debt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!user || !confirm(`Are you sure you want to delete ${customer.name} and all their data?`)) return;

    setIsLoading(true);
    try {
      // Get all customer purchases
      const allPurchases = await db.getCustomerPurchases(customer.id);
      
      // Delete all customer purchases
      for (const purchase of allPurchases) {
        // Note: In a real implementation, you'd need a delete method for customer purchases
        // For now, we'll mark them as deleted or handle differently
      }

      // Delete customer
      // Note: You'd need to implement deleteCustomer in the database service
      
      await logAdminAction('Delete Customer', customer.name, `Deleted customer: ${customer.name} and all associated data`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderDashboard = () => {
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
        const profit = item ? (purchase.price - item.costPrice) * purchase.quantity : 0;
        return total + profit;
      }, 0);
    }, 0);

    const activeShift = shifts.find(s => s.status === 'active');
    const totalCustomers = customers.length;
    const pendingDebt = customerPurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Profit</p>
                <p className="text-2xl font-bold text-gray-900">{todayProfit} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{todayRevenue} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Debt</p>
                <p className="text-2xl font-bold text-gray-900">{pendingDebt} EGP</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Shifts</h3>
            <div className="space-y-3">
              {shifts.slice(0, 5).map(shift => (
                <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{shift.username}</p>
                    <p className="text-sm text-gray-600">{new Date(shift.startTime).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{shift.totalAmount} EGP</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shift.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Items</h3>
            <div className="space-y-3">
              {items.filter(item => item.currentAmount < 10).slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.sellPrice} EGP</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-red-600">{item.currentAmount} left</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAddSupply(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <Package className="h-4 w-4 mr-2" />
              Add Supply
            </button>
            <button
              onClick={() => setShowAddCategory(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(category.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setNewCategory(category);
                            setShowAddCategory(true);
                          }}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sell Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map(item => {
                  const totalCost = item.costPrice * item.currentAmount;
                  const totalProfit = (item.sellPrice - item.costPrice) * item.currentAmount;
                  return (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.costPrice} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.sellPrice} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.currentAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {totalCost} EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
  };

  const renderUsers = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <button
            onClick={() => setShowAddUser(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(userItem => (
                  <tr key={userItem.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {userItem.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        userItem.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {userItem.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(userItem.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setEditingUser(userItem);
                          setNewUser(userItem);
                          setShowAddUser(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {userItem.id !== user?.id && (
                        <button
                          onClick={() => deleteUser(userItem)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
  };

  const renderAdminLog = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Admin Log</h2>
          <p className="text-sm text-gray-600">All admin actions are permanently logged</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500  uppercase tracking-wider">Item/Shift Affected</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adminLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.adminName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.actionType.includes('Delete') ? 'bg-red-100 text-red-800' :
                        log.actionType.includes('Add') ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.itemOrShiftAffected}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {log.changeDetails}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.section || 'General'}
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

  const renderShifts = () => {
    if (selectedShift) {
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

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shift Summary</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Shift ID:</span> {selectedShift.id}</div>
                  <div><span className="font-medium">Started:</span> {new Date(selectedShift.startTime).toLocaleString()}</div>
                  <div><span className="font-medium">Ended:</span> {selectedShift.endTime ? new Date(selectedShift.endTime).toLocaleString() : 'Active'}</div>
                  <div><span className="font-medium">Total Cash:</span> {selectedShift.totalAmount} EGP</div>
                  <div><span className="font-medium">Items Sold:</span> {selectedShift.purchases.reduce((total, p) => total + p.quantity, 0)}</div>
                  <div><span className="font-medium">User Opened:</span> {selectedShift.username}</div>
                  <div><span className="font-medium">User Closed:</span> {selectedShift.status === 'closed' ? selectedShift.username : '-'}</div>
                  <div>
                    <span className="font-medium">Validation Status:</span>
                    <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedShift.validationStatus === 'balanced' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedShift.validationStatus}
                    </span>
                  </div>
                </div>
              </div>

              {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Discrepancies</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <ul className="space-y-1 text-sm text-red-700">
                      {selectedShift.discrepancies.map((discrepancy, index) => (
                        <li key={index}>• {discrepancy}</li>
                      ))}
                    </ul>
                    {selectedShift.closeReason && (
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <p className="font-medium text-red-800">Reason:</p>
                        <p className="text-red-700">{selectedShift.closeReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedShift.expenses.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Shifts History</h2>
          <button
            onClick={() => generateShiftsPDF(shifts, section)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
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
                {shifts.map(shift => (
                  <tr key={shift.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shift.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(shift.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.endTime ? new Date(shift.endTime).toLocaleDateString() : 'Active'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        shift.validationStatus === 'balanced' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
  };

  const renderPayments = () => {
    if (section !== 'supplement') return null;

    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalSupplyCosts = supplies.reduce((sum, s) => sum + s.totalCost, 0);
    const currentDebt = (supplementDebt?.amount || 0) - totalPayments + totalSupplyCosts;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Supplement Payments</h2>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Debt Row */}
                <tr className="bg-red-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-900">
                    Debt
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900">
                    {supplementDebt?.amount || 0} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900">
                    Initial debt amount
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900">
                    {supplementDebt?.lastUpdated ? new Date(supplementDebt.lastUpdated).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setNewDebtAmount(supplementDebt?.amount || 0);
                        setShowEditDebt(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </td>
                </tr>

                {/* Payment Rows */}
                {payments.map(payment => (
                  <tr key={payment.id} className="bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                      Payment
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                      -{payment.amount} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                      {payment.paidBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                      {new Date(payment.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      -
                    </td>
                  </tr>
                ))}

                {/* Supply Rows */}
                {supplies.map(supply => (
                  <tr key={supply.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                      New Supply
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                      +{supply.totalCost} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                      Supply cost
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                      {new Date(supply.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      -
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Calculated balance
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    -
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
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyShifts = shifts.filter(shift => {
      const shiftMonth = new Date(shift.startTime).toISOString().slice(0, 7);
      return shiftMonth === currentMonth;
    });

    const monthlyRevenue = monthlyShifts.reduce((sum, shift) => {
      return sum + shift.purchases.reduce((total, purchase) => total + (purchase.price * purchase.quantity), 0);
    }, 0);

    const monthlyProfit = monthlyShifts.reduce((sum, shift) => {
      return sum + shift.purchases.reduce((total, purchase) => {
        const item = items.find(i => i.id === purchase.itemId);
        const profit = item ? (purchase.price - item.costPrice) * purchase.quantity : 0;
        return total + profit;
      }, 0);
    }, 0);

    const monthlyExpenses = monthlyShifts.reduce((sum, shift) => {
      return sum + shift.expenses.reduce((total, expense) => total + expense.amount, 0);
    }, 0);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Monthly Summary</h2>
          <button
            onClick={() => generateMonthlySummaryPDF(monthlyShifts, items, section, currentMonth)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Profit</p>
                <p className="text-2xl font-bold text-gray-900">{monthlyProfit} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{monthlyRevenue} EGP</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Expenses</p>
                <p className="text-2xl font-bold text-gray-900">{monthlyExpenses} EGP</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Shifts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ended</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Opened</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Closed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyShifts.map(shift => (
                  <tr key={shift.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shift.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(shift.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.endTime ? new Date(shift.endTime).toLocaleDateString() : 'Active'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.status === 'closed' ? shift.username : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shift.totalAmount} EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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

  const renderCustomers = () => {
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
              <div key={customer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                    onClick={() => deleteCustomer(customer)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Customer
                  </button>
                </div>
              </div>
            );
          })}
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
            { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
            { id: 'inventory', name: 'Inventory', icon: Package },
            { id: 'shifts', name: 'Shifts History', icon: Calendar },
            { id: 'profit', name: 'Monthly Summary', icon: DollarSign },
            ...(section === 'supplement' ? [{ id: 'payments', name: 'Payments', icon: Receipt }] : []),
            { id: 'customers', name: 'Customers', icon: Users },
            { id: 'users', name: 'Users', icon: Settings },
            { id: 'adminlog', name: 'Admin Log', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
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
      {activeTab === 'inventory' && renderInventory()}
      {activeTab === 'shifts' && renderShifts()}
      {activeTab === 'profit' && renderProfit()}
      {activeTab === 'payments' && renderPayments()}
      {activeTab === 'customers' && renderCustomers()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'adminlog' && renderAdminLog()}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (EGP)</label>
                <input
                  type="number"
                  value={newItem.costPrice || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, costPrice: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price (EGP)</label>
                <input
                  type="number"
                  value={newItem.sellPrice || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, sellPrice: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                <input
                  type="number"
                  value={newItem.currentAmount || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, currentAmount: parseInt(e.target.value) || 0 }))}
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
                  <option value="">No Category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input
                  type="url"
                  value={newItem.image || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveItem}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save Item'}
              </button>
              <button
                onClick={() => {
                  setShowAddItem(false);
                  setEditingItem(null);
                  setNewItem({});
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
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
            <h3 className="text-lg font-semibold mb-4">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name || ''}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter category name"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveCategory}
                disabled={isLoading || !newCategory.name}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save Category'}
              </button>
              <button
                onClick={() => {
                  setShowAddCategory(false);
                  setEditingCategory(null);
                  setNewCategory({});
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUser.username || ''}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password || ''}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role || ''}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as 'normal' | 'admin' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Role</option>
                  <option value="normal">Normal User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveUser}
                disabled={isLoading || !newUser.username || !newUser.password || !newUser.role}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save User'}
              </button>
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setEditingUser(null);
                  setNewUser({});
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
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Items and Quantities</label>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">Current: {item.currentAmount}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Add:</label>
                        <input
                          type="number"
                          value={supplyItems[item.id] || 0}
                          onChange={(e) => setSupplyItems(prev => ({
                            ...prev,
                            [item.id]: parseInt(e.target.value) || 0
                          }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Cost (EGP)</label>
                <input
                  type="number"
                  value={supplyCost}
                  onChange={(e) => setSupplyCost(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={addSupply}
                disabled={isLoading || Object.keys(supplyItems).length === 0 || supplyCost <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add Supply'}
              </button>
              <button
                onClick={() => {
                  setShowAddSupply(false);
                  setSupplyItems({});
                  setSupplyCost(0);
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
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
                <input
                  type="text"
                  value={newPayment.paidBy}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, paidBy: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter person name"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={addPayment}
                disabled={isLoading || newPayment.amount <= 0 || !newPayment.paidBy}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add Payment'}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setNewPayment({ amount: 0, paidBy: '' });
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {showEditDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Debt Amount</h3>
            
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
                onClick={updateDebt}
                disabled={isLoading || newDebtAmount < 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Updating...' : 'Update Debt'}
              </button>
              <button
                onClick={() => {
                  setShowEditDebt(false);
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

export default AdminView;