import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Package, BarChart3, FileText, DollarSign, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { Item, User, Shift, Category, Customer, AdminLog, SupplementDebt } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'users' | 'shifts' | 'customers' | 'logs' | 'debt'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    categoryId: '',
    image: ''
  });
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });
  const [categoryForm, setCategoryForm] = useState({
    name: ''
  });
  const [customerForm, setCustomerForm] = useState({
    name: ''
  });
  const [debtForm, setDebtForm] = useState({
    amount: ''
  });

  // Real-time updates
  useRealtime((event) => {
    if (event.data?.table === 'items' || event.type === 'ITEM_UPDATED') {
      loadItems();
    }
    if (event.data?.table === 'users') {
      loadUsers();
    }
    if (event.data?.table === 'shifts' || event.type === 'SHIFT_UPDATED') {
      loadShifts();
    }
    if (event.data?.table === 'customers' || event.type === 'CUSTOMER_UPDATED') {
      loadCustomers();
    }
    if (event.data?.table === 'categories') {
      loadCategories();
    }
    if (event.data?.table === 'admin_logs') {
      loadAdminLogs();
    }
    if (event.data?.table === 'supplement_debt' && section === 'supplement') {
      loadSupplementDebt();
    }
  }, [section]);

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadItems(),
        loadUsers(),
        loadShifts(),
        loadCustomers(),
        loadCategories(),
        loadAdminLogs(),
        section === 'supplement' ? loadSupplementDebt() : Promise.resolve()
      ]);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const data = await db_service.getItemsBySection(section);
      setItems(data);
    } catch (err) {
      console.error('Error loading items:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await db_service.getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadShifts = async () => {
    try {
      const data = await db_service.getShiftsBySection(section);
      setShifts(data);
    } catch (err) {
      console.error('Error loading shifts:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await db_service.getCustomersBySection(section);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await db_service.getCategoriesBySection(section);
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadAdminLogs = async () => {
    try {
      const data = await db_service.getAllAdminLogs();
      setAdminLogs(data.filter(log => !log.section || log.section === section));
    } catch (err) {
      console.error('Error loading admin logs:', err);
    }
  };

  const loadSupplementDebt = async () => {
    try {
      const data = await db_service.getSupplementDebt();
      setSupplementDebt(data);
    } catch (err) {
      console.error('Error loading supplement debt:', err);
    }
  };

  const handleSaveItem = async () => {
    try {
      if (!itemForm.name || !itemForm.sellPrice || !itemForm.costPrice) {
        alert('Please fill in all required fields');
        return;
      }

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
        actionType: editingItem ? 'UPDATE_ITEM' : 'CREATE_ITEM',
        itemOrShiftAffected: item.name,
        changeDetails: editingItem ? 'Item updated' : 'Item created',
        timestamp: new Date(),
        adminName: user?.username || 'Unknown',
        section
      };
      await db_service.saveAdminLog(log);

      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({ name: '', sellPrice: '', costPrice: '', currentAmount: '', categoryId: '', image: '' });
      loadItems();
    } catch (err) {
      console.error('Error saving item:', err);
      alert('Failed to save item');
    }
  };

  const handleSaveUser = async () => {
    try {
      if (!userForm.username || !userForm.password) {
        alert('Please fill in all required fields');
        return;
      }

      const newUser: User = {
        id: editingUser?.id || uuidv4(),
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        createdAt: editingUser?.createdAt || new Date()
      };

      if (editingUser) {
        await db_service.updateUser(newUser);
      } else {
        await db_service.createUser(newUser);
      }

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingUser ? 'UPDATE_USER' : 'CREATE_USER',
        itemOrShiftAffected: newUser.username,
        changeDetails: editingUser ? 'User updated' : 'User created',
        timestamp: new Date(),
        adminName: user?.username || 'Unknown'
      };
      await db_service.saveAdminLog(log);

      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', role: 'normal' });
      loadUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert('Failed to save user');
    }
  };

  const handleSaveCustomer = async () => {
    try {
      if (!customerForm.name) {
        alert('Please enter customer name');
        return;
      }

      const customer: Customer = {
        id: editingCustomer?.id || uuidv4(),
        name: customerForm.name,
        section,
        createdAt: editingCustomer?.createdAt || new Date()
      };

      await db_service.saveCustomer(customer);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingCustomer ? 'UPDATE_CUSTOMER' : 'CREATE_CUSTOMER',
        itemOrShiftAffected: customer.name,
        changeDetails: editingCustomer ? 'Customer updated' : 'Customer created',
        timestamp: new Date(),
        adminName: user?.username || 'Unknown',
        section
      };
      await db_service.saveAdminLog(log);

      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ name: '' });
      loadCustomers();
    } catch (err) {
      console.error('Error saving customer:', err);
      alert('Failed to save customer');
    }
  };

  const handleSaveCategory = async () => {
    try {
      if (!categoryForm.name) {
        alert('Please enter category name');
        return;
      }

      const category: Category = {
        id: uuidv4(),
        name: categoryForm.name,
        section,
        createdAt: new Date()
      };

      await db_service.saveCategory(category);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'CREATE_CATEGORY',
        itemOrShiftAffected: category.name,
        changeDetails: 'Category created',
        timestamp: new Date(),
        adminName: user?.username || 'Unknown',
        section
      };
      await db_service.saveAdminLog(log);

      setShowCategoryModal(false);
      setCategoryForm({ name: '' });
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      alert('Failed to save category');
    }
  };

  const handleUpdateDebt = async () => {
    try {
      if (!debtForm.amount) {
        alert('Please enter debt amount');
        return;
      }

      const debt: SupplementDebt = {
        amount: parseFloat(debtForm.amount),
        lastUpdated: new Date(),
        updatedBy: user?.username || 'Unknown'
      };

      await db_service.saveSupplementDebt(debt);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'UPDATE_DEBT',
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `Debt updated to ${debt.amount} EGP`,
        timestamp: new Date(),
        adminName: user?.username || 'Unknown',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setShowDebtModal(false);
      setDebtForm({ amount: '' });
      loadSupplementDebt();
    } catch (err) {
      console.error('Error updating debt:', err);
      alert('Failed to update debt');
    }
  };

  const handleDeleteItem = async (item: Item) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      try {
        await db_service.deleteItem(item.id);

        // Log admin action
        const log: AdminLog = {
          id: uuidv4(),
          actionType: 'DELETE_ITEM',
          itemOrShiftAffected: item.name,
          changeDetails: 'Item deleted',
          timestamp: new Date(),
          adminName: user?.username || 'Unknown',
          section
        };
        await db_service.saveAdminLog(log);

        loadItems();
      } catch (err) {
        console.error('Error deleting item:', err);
        alert('Failed to delete item');
      }
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.id === user?.id) {
      alert('You cannot delete your own account');
      return;
    }

    if (confirm(`Are you sure you want to delete user "${userToDelete.username}"?`)) {
      try {
        await db_service.deleteUser(userToDelete.id);

        // Log admin action
        const log: AdminLog = {
          id: uuidv4(),
          actionType: 'DELETE_USER',
          itemOrShiftAffected: userToDelete.username,
          changeDetails: 'User deleted',
          timestamp: new Date(),
          adminName: user?.username || 'Unknown'
        };
        await db_service.saveAdminLog(log);

        loadUsers();
      } catch (err) {
        console.error('Error deleting user:', err);
        alert('Failed to delete user');
      }
    }
  };

  const openEditItem = (item: Item) => {
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

  const openEditUser = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setUserForm({
      username: userToEdit.username,
      password: userToEdit.password,
      role: userToEdit.role
    });
    setShowUserModal(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name
    });
    setShowCustomerModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
        <button
          onClick={loadData}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'items', label: 'Items', icon: Package },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'shifts', label: 'Shifts', icon: BarChart3 },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'logs', label: 'Admin Logs', icon: FileText },
              ...(section === 'supplement' ? [{ id: 'debt', label: 'Debt Management', icon: DollarSign }] : [])
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
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

        <div className="p-6">
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Items Management</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Add Category
                  </button>
                  <button
                    onClick={() => setShowItemModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sell Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.image && (
                              <img className="h-10 w-10 rounded-lg object-cover mr-3" src={item.image} alt={item.name} />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              {item.categoryId && (
                                <div className="text-sm text-gray-500">
                                  {categories.find(c => c.id === item.categoryId)?.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.sellPrice} EGP</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.costPrice} EGP</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.currentAmount > 10 ? 'bg-green-100 text-green-800' :
                            item.currentAmount > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.currentAmount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => openEditItem(item)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
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

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Users Management</h3>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add User</span>
                </button>
              </div>

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
                    {users.map((userItem) => (
                      <tr key={userItem.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{userItem.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            userItem.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {userItem.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userItem.createdAt.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => openEditUser(userItem)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {userItem.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(userItem)}
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
          )}

          {activeTab === 'shifts' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Shifts History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shift.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.startTime.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.endTime ? shift.endTime.toLocaleString() : 'Active'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.totalAmount} EGP</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            shift.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shift.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Customers Management</h3>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Customer</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.section}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.createdAt.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => openEditCustomer(customer)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Admin Activity Logs</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {adminLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.actionType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.itemOrShiftAffected}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.changeDetails}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.adminName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.timestamp.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'debt' && section === 'supplement' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Supplement Debt Management</h3>
                <button
                  onClick={() => {
                    setDebtForm({ amount: supplementDebt?.amount.toString() || '0' });
                    setShowDebtModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span>Update Debt</span>
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {supplementDebt?.amount || 0} EGP
                  </div>
                  <div className="text-sm text-gray-500">
                    Current Supplement Debt
                  </div>
                  {supplementDebt && (
                    <div className="text-xs text-gray-400 mt-2">
                      Last updated by {supplementDebt.updatedBy} on {supplementDebt.lastUpdated.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm({ ...itemForm, currentAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                  setItemForm({ name: '', sellPrice: '', costPrice: '', currentAmount: '', categoryId: '', image: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'normal' | 'admin' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">Normal User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                  setUserForm({ username: '', password: '', role: 'normal' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add New Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setCategoryForm({ name: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setEditingCustomer(null);
                  setCustomerForm({ name: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingCustomer ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Update Supplement Debt</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debt Amount (EGP)</label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDebtModal(false);
                  setDebtForm({ amount: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDebt}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;