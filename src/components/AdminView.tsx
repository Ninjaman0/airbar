import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Users, DollarSign, FileText, Settings, Download, Eye, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { 
  Item, Shift, Supply, Category, Customer, CustomerPurchase, AdminLog, User, 
  SupplementDebt, SupplementDebtTransaction 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [debtTransactions, setDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);
  const [showEditDebtModal, setShowEditDebtModal] = useState(false);
  const [showDebtTransactionModal, setShowDebtTransactionModal] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    categoryId: '',
    image: ''
  });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });
  const [supplyForm, setSupplyForm] = useState<Record<string, string>>({});
  const [baseDebtForm, setBaseDebtForm] = useState('');
  const [debtTransactionForm, setDebtTransactionForm] = useState({
    type: 'payment' as 'payment' | 'debt',
    amount: '',
    note: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, [section, activeTab]);

  const loadData = async () => {
    try {
      const [
        itemsData, categoriesData, customersData, shiftsData, 
        suppliesData, adminLogsData, usersData, unpaidData
      ] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section),
        db_service.getAllAdminLogs(),
        db_service.getAllUsers(),
        db_service.getUnpaidCustomerPurchases(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);
      setAdminLogs(adminLogsData.filter(log => !log.section || log.section === section));
      setUsers(usersData);
      setUnpaidPurchases(unpaidData);

      // Load supplement debt data if in supplement section
      if (section === 'supplement') {
        const [debtData, transactionsData] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debtData);
        setDebtTransactions(transactionsData);
      }

      // Initialize supply form
      const supplyFormInit: Record<string, string> = {};
      itemsData.forEach(item => {
        supplyFormInit[item.id] = '';
      });
      setSupplyForm(supplyFormInit);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    }
  };

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      loadData();
    }
  }, [section, activeTab]);

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.sellPrice || !itemForm.costPrice) {
      setError('Please fill in all required fields');
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
        categoryId: itemForm.categoryId || undefined,
        image: itemForm.image || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db_service.saveItem(item);

      // Log admin action
      const log: AdminLog = {
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
      setError('');
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Failed to save item');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteItem(item.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'item_deleted',
        itemOrShiftAffected: item.name,
        changeDetails: `Deleted item: ${item.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      setError('');
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item');
    } finally {
      setIsLoading(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name) {
      setError('Please enter a category name');
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

      // Log admin action
      const log: AdminLog = {
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
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteCategory(category.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'category_deleted',
        itemOrShiftAffected: category.name,
        changeDetails: `Deleted category: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      setError('');
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSupply = async () => {
    const supplyItems = Object.entries(supplyForm)
      .filter(([_, quantity]) => quantity && parseInt(quantity) > 0)
      .reduce((acc, [itemId, quantity]) => {
        acc[itemId] = parseInt(quantity);
        return acc;
      }, {} as Record<string, number>);

    if (Object.keys(supplyItems).length === 0) {
      setError('Please enter at least one item quantity');
      return;
    }

    try {
      setIsLoading(true);

      // Calculate total cost
      let totalCost = 0;
      for (const [itemId, quantity] of Object.entries(supplyItems)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          totalCost += item.costPrice * quantity;
        }
      }

      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyItems,
        totalCost,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupply(supply);

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

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'supply_added',
        itemOrShiftAffected: `${Object.keys(supplyItems).length} items`,
        changeDetails: `Added supply: ${totalCost} EGP total cost`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      // Reset form
      const resetForm: Record<string, string> = {};
      items.forEach(item => {
        resetForm[item.id] = '';
      });
      setSupplyForm(resetForm);
      setShowSupplyModal(false);
      setError('');
    } catch (error) {
      console.error('Error saving supply:', error);
      setError('Failed to save supply');
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async () => {
    if (!userForm.username || !userForm.password) {
      setError('Please fill in all required fields');
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

      await db_service.createUser(newUser);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingUser ? 'user_updated' : 'user_created',
        itemOrShiftAffected: newUser.username,
        changeDetails: editingUser 
          ? `Updated user: ${newUser.username}` 
          : `Created new user: ${newUser.username}`,
        timestamp: new Date(),
        adminName: user?.username || ''
      };
      await db_service.saveAdminLog(log);

      resetUserForm();
      setShowUserModal(false);
      setError('');
    } catch (error) {
      console.error('Error saving user:', error);
      setError('Failed to save user');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (!confirm(`Are you sure you want to delete user "${userToDelete.username}"?`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteUser(userToDelete.id);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'user_deleted',
        itemOrShiftAffected: userToDelete.username,
        changeDetails: `Deleted user: ${userToDelete.username}`,
        timestamp: new Date(),
        adminName: user?.username || ''
      };
      await db_service.saveAdminLog(log);

      setError('');
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
    } finally {
      setIsLoading(false);
    }
  };

  const markCustomerPurchaseAsPaid = async (purchase: CustomerPurchase) => {
    try {
      setIsLoading(true);

      const updatedPurchase = { ...purchase, isPaid: true };
      await db_service.saveCustomerPurchase(updatedPurchase);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'customer_payment',
        itemOrShiftAffected: purchase.customerName,
        changeDetails: `Marked purchase as paid: ${purchase.totalAmount} EGP`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      setError('');
    } catch (error) {
      console.error('Error marking purchase as paid:', error);
      setError('Failed to mark purchase as paid');
    } finally {
      setIsLoading(false);
    }
  };

  // Supplement debt management
  const saveBaseDebt = async () => {
    if (!baseDebtForm) {
      setError('Please enter a debt amount');
      return;
    }

    try {
      setIsLoading(true);

      const debt: SupplementDebt = {
        amount: parseFloat(baseDebtForm),
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(debt);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'debt_base_updated',
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `Updated base debt to: ${debt.amount} EGP`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setBaseDebtForm('');
      setShowEditDebtModal(false);
      setError('');
    } catch (error) {
      console.error('Error saving base debt:', error);
      setError('Failed to save base debt');
    } finally {
      setIsLoading(false);
    }
  };

  const saveDebtTransaction = async () => {
    if (!debtTransactionForm.amount || !debtTransactionForm.note) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);

      const transaction: SupplementDebtTransaction = {
        id: uuidv4(),
        type: debtTransactionForm.type,
        amount: parseFloat(debtTransactionForm.amount),
        note: debtTransactionForm.note,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Update current debt
      if (supplementDebt) {
        const newAmount = debtTransactionForm.type === 'payment' 
          ? supplementDebt.amount - transaction.amount
          : supplementDebt.amount + transaction.amount;

        const updatedDebt: SupplementDebt = {
          amount: newAmount,
          lastUpdated: new Date(),
          updatedBy: user?.username || ''
        };

        await db_service.saveSupplementDebt(updatedDebt);
      }

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: `debt_${debtTransactionForm.type}`,
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `${debtTransactionForm.type === 'payment' ? 'Payment' : 'Debt'} of ${transaction.amount} EGP: ${transaction.note}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setDebtTransactionForm({ type: 'payment', amount: '', note: '' });
      setShowDebtTransactionModal(false);
      setError('');
    } catch (error) {
      console.error('Error saving debt transaction:', error);
      setError('Failed to save debt transaction');
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
      categoryId: '',
      image: ''
    });
    setEditingItem(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '' });
    setEditingCategory(null);
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      password: '',
      role: 'normal'
    });
    setEditingUser(null);
  };

  const editItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sellPrice: item.sellPrice.toString(),
      costPrice: item.costPrice.toString(),
      currentAmount: item.currentAmount.toString(),
      categoryId: item.categoryId || '',
      image: item.image || ''
    });
    setShowItemModal(true);
  };

  const editCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryModal(true);
  };

  const editUser = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setUserForm({
      username: userToEdit.username,
      password: userToEdit.password,
      role: userToEdit.role
    });
    setShowUserModal(true);
  };

  const viewShiftDetails = (shift: Shift) => {
    setSelectedShift(shift);
    setShowShiftDetailsModal(true);
  };

  const calculateCurrentDebt = () => {
    if (!supplementDebt) return 0;
    
    const transactionTotal = debtTransactions.reduce((total, transaction) => {
      return transaction.type === 'payment' 
        ? total - transaction.amount 
        : total + transaction.amount;
    }, 0);
    
    return supplementDebt.amount + transactionTotal;
  };

  const renderItemsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Items Management</h3>
        <button
          onClick={() => setShowItemModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Item</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sell Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => {
              const category = categories.find(c => c.id === item.categoryId);
              return (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {category?.name || 'No Category'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {item.sellPrice} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {item.costPrice} EGP
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.currentAmount > 10 
                        ? 'bg-green-100 text-green-800'
                        : item.currentAmount > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.currentAmount}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editItem(item)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        className="text-red-600 hover:text-red-700"
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
  );

  const renderCategoriesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Categories Management</h3>
        <button
          onClick={() => setShowCategoryModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items Count</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map(category => {
              const itemCount = items.filter(item => item.categoryId === category.id).length;
              return (
                <tr key={category.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{category.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {itemCount} items
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {category.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editCategory(category)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(category)}
                        className="text-red-600 hover:text-red-700"
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
  );

  const renderShiftsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Shifts Management</h3>
        <button
          onClick={() => generateShiftsPDF(shifts, section)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export PDF</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cash</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shifts.map(shift => (
              <tr key={shift.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-mono text-sm">{shift.id.substring(0, 8)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {shift.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {shift.startTime.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {shift.endTime ? shift.endTime.toLocaleString() : 'Active'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {shift.totalAmount.toFixed(2)} EGP
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    shift.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : shift.validationStatus === 'balanced'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {shift.status === 'active' ? 'Active' : 
                     shift.validationStatus === 'balanced' ? 'Balanced' : 'Discrepancy'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => viewShiftDetails(shift)}
                    className="text-blue-600 hover:text-blue-700"
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
  );

  const renderCustomersTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Customer Management</h3>

      {/* Unpaid Purchases */}
      {unpaidPurchases.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Unpaid Customer Purchases</h4>
          <div className="space-y-3">
            {unpaidPurchases.map(purchase => (
              <div key={purchase.id} className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                <div>
                  <div className="font-medium">{purchase.customerName}</div>
                  <div className="text-sm text-gray-600">
                    {purchase.items.length} items - {purchase.totalAmount.toFixed(2)} EGP
                  </div>
                  <div className="text-xs text-gray-500">
                    {purchase.timestamp.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => markCustomerPurchaseAsPaid(purchase)}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  Mark as Paid
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Purchases</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.map(customer => {
              const customerPurchases = unpaidPurchases.filter(p => p.customerId === customer.id);
              const totalAmount = customerPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
              
              return (
                <tr key={customer.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {customer.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {customerPurchases.length} purchases ({totalAmount.toFixed(2)} EGP)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSuppliesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Supplies Management</h3>
        <button
          onClick={() => setShowSupplyModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Supply</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {supplies.map(supply => (
              <tr key={supply.id}>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {supply.timestamp.toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
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
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {supply.totalCost.toFixed(2)} EGP
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {supply.createdBy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Users Management</h3>
        <button
          onClick={() => setShowUserModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(userItem => (
              <tr key={userItem.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{userItem.username}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    userItem.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {userItem.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {userItem.createdAt.toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => editUser(userItem)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteUser(userItem)}
                      className="text-red-600 hover:text-red-700"
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
  );

  const renderDebtTab = () => {
    if (section !== 'supplement') return null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Debt Management</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowEditDebtModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Base Debt</span>
            </button>
            <button
              onClick={() => setShowDebtTransactionModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Current Debt Display */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {calculateCurrentDebt().toFixed(2)} EGP
            </div>
            <div className="text-gray-600">Current Total Debt</div>
            {supplementDebt && (
              <div className="text-sm text-gray-500 mt-2">
                Base Debt: {supplementDebt.amount.toFixed(2)} EGP
                <br />
                Last Updated: {supplementDebt.lastUpdated.toLocaleString()} by {supplementDebt.updatedBy}
              </div>
            )}
          </div>
        </div>

        {/* Debt Transactions */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-medium">Transaction History</h4>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {supplementDebt && (
                <tr className="bg-blue-50">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {supplementDebt.lastUpdated.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {supplementDebt.updatedBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      Base Debt
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {supplementDebt.amount.toFixed(2)} EGP
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    Base debt amount
                  </td>
                </tr>
              )}
              {debtTransactions.map(transaction => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {transaction.timestamp.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {transaction.createdBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      transaction.type === 'payment' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {transaction.type === 'payment' ? '-' : '+'}{transaction.amount.toFixed(2)} EGP
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {transaction.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLogsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Admin Logs</h3>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {adminLogs.map(log => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {log.timestamp.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {log.adminName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {log.actionType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {log.itemOrShiftAffected}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {log.changeDetails}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tabs = [
    { id: 'items', label: 'Items', icon: Package },
    { id: 'categories', label: 'Categories', icon: Settings },
    { id: 'shifts', label: 'Shifts', icon: Clock },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'supplies', label: 'Supplies', icon: Package },
    { id: 'users', label: 'Users', icon: Users },
    ...(section === 'supplement' ? [{ id: 'debt', label: 'Debt Management', icon: DollarSign }] : []),
    { id: 'logs', label: 'Logs', icon: FileText }
  ];

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
      {activeTab === 'items' && renderItemsTab()}
      {activeTab === 'categories' && renderCategoriesTab()}
      {activeTab === 'shifts' && renderShiftsTab()}
      {activeTab === 'customers' && renderCustomersTab()}
      {activeTab === 'supplies' && renderSuppliesTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'debt' && renderDebtTab()}
      {activeTab === 'logs' && renderLogsTab()}

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
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">No Category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm({ ...itemForm, currentAmount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
                <input
                  type="text"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                Cancel
              </button>
              <button
                onClick={saveItem}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save'}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
                  resetCategoryForm();
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveCategory}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add Supply</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-600">
                      Current: {item.currentAmount} | Cost: {item.costPrice} EGP
                    </div>
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
                onClick={() => setShowSupplyModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveSupply}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Supply'}
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
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'normal' | 'admin' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="normal">Normal User</option>
                  <option value="admin">Admin</option>
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
                Cancel
              </button>
              <button
                onClick={saveUser}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Base Debt Modal */}
      {showEditDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Base Debt</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Debt Amount (EGP)</label>
              <input
                type="number"
                value={baseDebtForm}
                onChange={(e) => setBaseDebtForm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="0.00"
              />
              {supplementDebt && (
                <div className="text-sm text-gray-500 mt-1">
                  Current: {supplementDebt.amount.toFixed(2)} EGP
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowEditDebtModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveBaseDebt}
                disabled={isLoading || !baseDebtForm}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Transaction Modal */}
      {showDebtTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Debt Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={debtTransactionForm.type}
                  onChange={(e) => setDebtTransactionForm({ 
                    ...debtTransactionForm, 
                    type: e.target.value as 'payment' | 'debt' 
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="payment">Payment (Reduce Debt)</option>
                  <option value="debt">Debt (Increase Debt)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input
                  type="number"
                  value={debtTransactionForm.amount}
                  onChange={(e) => setDebtTransactionForm({ 
                    ...debtTransactionForm, 
                    amount: e.target.value 
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={debtTransactionForm.note}
                  onChange={(e) => setDebtTransactionForm({ 
                    ...debtTransactionForm, 
                    note: e.target.value 
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter note..."
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowDebtTransactionModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveDebtTransaction}
                disabled={isLoading || !debtTransactionForm.amount || !debtTransactionForm.note}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetailsModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Shift Details</h3>
              <button
                onClick={() => setShowShiftDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shift Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Shift Information</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div><strong>ID:</strong> {selectedShift.id.substring(0, 8)}</div>
                    <div><strong>User:</strong> {selectedShift.username}</div>
                    <div><strong>Status:</strong> {selectedShift.status}</div>
                    <div><strong>Started:</strong> {selectedShift.startTime.toLocaleString()}</div>
                    {selectedShift.endTime && (
                      <div><strong>Ended:</strong> {selectedShift.endTime.toLocaleString()}</div>
                    )}
                    <div><strong>Total Cash:</strong> {selectedShift.totalAmount.toFixed(2)} EGP</div>
                    <div><strong>Validation:</strong> {selectedShift.validationStatus}</div>
                  </div>
                </div>

                {/* Purchases */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Purchases</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                    {selectedShift.purchases.length > 0 ? (
                      selectedShift.purchases.map((purchase, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{purchase.name} x{purchase.quantity}</span>
                          <span>{(purchase.price * purchase.quantity).toFixed(2)} EGP</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm">No purchases</div>
                    )}
                  </div>
                </div>

                {/* Expenses */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Expenses</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                    {selectedShift.expenses.length > 0 ? (
                      selectedShift.expenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between text-sm">
                          <span>{expense.reason}</span>
                          <span>-{expense.amount.toFixed(2)} EGP</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm">No expenses</div>
                    )}
                  </div>
                </div>
              </div>

              {/* External Money & Discrepancies */}
              <div className="space-y-4">
                {/* External Money */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">External Money</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                    {selectedShift.externalMoney.length > 0 ? (
                      selectedShift.externalMoney.map((money) => (
                        <div key={money.id} className="flex justify-between text-sm">
                          <span>{money.reason}</span>
                          <span>+{money.amount.toFixed(2)} EGP</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm">No external money</div>
                    )}
                  </div>
                </div>

                {/* Final Counts */}
                {selectedShift.status === 'closed' && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Final Counts</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div><strong>Final Cash:</strong> {selectedShift.finalCash?.toFixed(2)} EGP</div>
                      {selectedShift.closeReason && (
                        <div className="mt-2"><strong>Notes:</strong> {selectedShift.closeReason}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Discrepancies */}
                {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Discrepancies</h4>
                    <div className="bg-red-50 p-4 rounded-lg">
                      {selectedShift.discrepancies.map((discrepancy, index) => (
                        <div key={index} className="text-sm text-red-700">
                          • {discrepancy}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;