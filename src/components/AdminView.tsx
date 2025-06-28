import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Package, BarChart3, FileText, DollarSign, AlertTriangle, Download, TrendingUp, Calendar, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { Item, User, Shift, Category, Customer, AdminLog, SupplementDebt, Supply, Expense } from '../types';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';
import { v4 as uuidv4 } from 'uuid';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'users' | 'shifts' | 'customers' | 'logs' | 'debt' | 'supplies' | 'reports'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

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
  const [supplyForm, setSupplyForm] = useState({
    items: [] as Array<{ itemId: string; quantity: number; cost: number }>,
    totalCost: ''
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
    if (event.data?.table === 'supplies' || event.type === 'SUPPLY_ADDED') {
      loadSupplies();
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
        loadSupplies(),
        section === 'supplement' ? loadSupplementDebt() : Promise.resolve()
      ]);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('فشل في تحميل البيانات. يرجى المحاولة مرة أخرى.');
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

  const loadSupplies = async () => {
    try {
      const data = await db_service.getSuppliesBySection(section);
      setSupplies(data);
    } catch (err) {
      console.error('Error loading supplies:', err);
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
        alert('يرجى ملء جميع الحقول المطلوبة');
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
        changeDetails: editingItem ? 'تم تحديث المنتج' : 'تم إنشاء منتج جديد',
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section
      };
      await db_service.saveAdminLog(log);

      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({ name: '', sellPrice: '', costPrice: '', currentAmount: '', categoryId: '', image: '' });
      loadItems();
    } catch (err) {
      console.error('Error saving item:', err);
      alert('فشل في حفظ المنتج');
    }
  };

  const handleSaveUser = async () => {
    try {
      if (!userForm.username || !userForm.password) {
        alert('يرجى ملء جميع الحقول المطلوبة');
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
        changeDetails: editingUser ? 'تم تحديث المستخدم' : 'تم إنشاء مستخدم جديد',
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف'
      };
      await db_service.saveAdminLog(log);

      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', role: 'normal' });
      loadUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert('فشل في حفظ المستخدم');
    }
  };

  const handleSaveCustomer = async () => {
    try {
      if (!customerForm.name) {
        alert('يرجى إدخال اسم العميل');
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
        changeDetails: editingCustomer ? 'تم تحديث العميل' : 'تم إنشاء عميل جديد',
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section
      };
      await db_service.saveAdminLog(log);

      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ name: '' });
      loadCustomers();
    } catch (err) {
      console.error('Error saving customer:', err);
      alert('فشل في حفظ العميل');
    }
  };

  const handleSaveCategory = async () => {
    try {
      if (!categoryForm.name) {
        alert('يرجى إدخال اسم الفئة');
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
        changeDetails: 'تم إنشاء فئة جديدة',
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section
      };
      await db_service.saveAdminLog(log);

      setShowCategoryModal(false);
      setCategoryForm({ name: '' });
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      alert('فشل في حفظ الفئة');
    }
  };

  const handleUpdateDebt = async () => {
    try {
      if (!debtForm.amount) {
        alert('يرجى إدخال مبلغ الدين');
        return;
      }

      const debt: SupplementDebt = {
        amount: parseFloat(debtForm.amount),
        lastUpdated: new Date(),
        updatedBy: user?.username || 'غير معروف'
      };

      await db_service.saveSupplementDebt(debt);

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'UPDATE_DEBT',
        itemOrShiftAffected: 'دين المكملات الغذائية',
        changeDetails: `تم تحديث الدين إلى ${debt.amount} جنيه`,
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      setShowDebtModal(false);
      setDebtForm({ amount: '' });
      loadSupplementDebt();
    } catch (err) {
      console.error('Error updating debt:', err);
      alert('فشل في تحديث الدين');
    }
  };

  const handleSaveSupply = async () => {
    try {
      if (supplyForm.items.length === 0 || !supplyForm.totalCost) {
        alert('يرجى إضافة منتجات وإدخال التكلفة الإجمالية');
        return;
      }

      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyForm.items.reduce((acc, item) => {
          acc[item.itemId] = item.quantity;
          return acc;
        }, {} as Record<string, number>),
        totalCost: parseFloat(supplyForm.totalCost),
        timestamp: new Date(),
        createdBy: user?.username || 'غير معروف'
      };

      await db_service.saveSupply(supply);

      // Update item quantities
      for (const supplyItem of supplyForm.items) {
        const item = items.find(i => i.id === supplyItem.itemId);
        if (item) {
          const updatedItem: Item = {
            ...item,
            currentAmount: item.currentAmount + supplyItem.quantity,
            updatedAt: new Date()
          };
          await db_service.saveItem(updatedItem);
        }
      }

      // Log admin action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'ADD_SUPPLY',
        itemOrShiftAffected: 'إضافة مخزون',
        changeDetails: `تم إضافة مخزون بقيمة ${supply.totalCost} جنيه`,
        timestamp: new Date(),
        adminName: user?.username || 'غير معروف',
        section
      };
      await db_service.saveAdminLog(log);

      setShowSupplyModal(false);
      setSupplyForm({ items: [], totalCost: '' });
      loadSupplies();
      loadItems();
    } catch (err) {
      console.error('Error saving supply:', err);
      alert('فشل في حفظ المخزون');
    }
  };

  const handleDeleteItem = async (item: Item) => {
    if (confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) {
      try {
        await db_service.deleteItem(item.id);

        // Log admin action
        const log: AdminLog = {
          id: uuidv4(),
          actionType: 'DELETE_ITEM',
          itemOrShiftAffected: item.name,
          changeDetails: 'تم حذف المنتج',
          timestamp: new Date(),
          adminName: user?.username || 'غير معروف',
          section
        };
        await db_service.saveAdminLog(log);

        loadItems();
      } catch (err) {
        console.error('Error deleting item:', err);
        alert('فشل في حذف المنتج');
      }
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.id === user?.id) {
      alert('لا يمكنك حذف حسابك الخاص');
      return;
    }

    if (confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) {
      try {
        await db_service.deleteUser(userToDelete.id);

        // Log admin action
        const log: AdminLog = {
          id: uuidv4(),
          actionType: 'DELETE_USER',
          itemOrShiftAffected: userToDelete.username,
          changeDetails: 'تم حذف المستخدم',
          timestamp: new Date(),
          adminName: user?.username || 'غير معروف'
        };
        await db_service.saveAdminLog(log);

        loadUsers();
      } catch (err) {
        console.error('Error deleting user:', err);
        alert('فشل في حذف المستخدم');
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

  const addSupplyItem = () => {
    setSupplyForm({
      ...supplyForm,
      items: [...supplyForm.items, { itemId: '', quantity: 0, cost: 0 }]
    });
  };

  const updateSupplyItem = (index: number, field: string, value: any) => {
    const updatedItems = [...supplyForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setSupplyForm({ ...supplyForm, items: updatedItems });
  };

  const removeSupplyItem = (index: number) => {
    const updatedItems = supplyForm.items.filter((_, i) => i !== index);
    setSupplyForm({ ...supplyForm, items: updatedItems });
  };

  const generateReports = () => {
    if (activeTab === 'shifts') {
      generateShiftsPDF(shifts, section);
    } else if (activeTab === 'reports') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      generateMonthlySummaryPDF(shifts, items, section, currentMonth);
    }
  };

  const openShiftDetails = (shift: Shift) => {
    setSelectedShift(shift);
    setShowShiftDetailsModal(true);
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
          حاول مرة أخرى
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
              { id: 'items', label: 'المنتجات', icon: Package },
              { id: 'users', label: 'المستخدمين', icon: Users },
              { id: 'shifts', label: 'الورديات', icon: BarChart3 },
              { id: 'customers', label: 'العملاء', icon: Users },
              { id: 'supplies', label: 'المخزون', icon: TrendingUp },
              { id: 'reports', label: 'التقارير', icon: FileText },
              { id: 'logs', label: 'سجل الأنشطة', icon: FileText },
              ...(section === 'supplement' ? [{ id: 'debt', label: 'إدارة الديون', icon: DollarSign }] : [])
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
                <h3 className="text-lg font-medium">إدارة المنتجات</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    إضافة فئة
                  </button>
                  <button
                    onClick={() => setShowItemModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر البيع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر التكلفة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المخزون</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.image && (
                              <img className="h-10 w-10 rounded-lg object-cover ml-3" src={item.image} alt={item.name} />
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.sellPrice} جنيه</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.costPrice} جنيه</td>
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
                <h3 className="text-lg font-medium">إدارة المستخدمين</h3>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة مستخدم</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الدور</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
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
                            {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userItem.createdAt.toLocaleDateString('ar-EG')}
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
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">تاريخ الورديات</h3>
                <button
                  onClick={generateReports}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير PDF</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">وقت البداية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">وقت النهاية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ الإجمالي</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shift.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.startTime.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشط'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.totalAmount} جنيه</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            shift.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shift.status === 'active' ? 'نشط' : 'مغلق'}
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

          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">إدارة العملاء</h3>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة عميل</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">القسم</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.section === 'store' ? 'البار' : 'المكملات الغذائية'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.createdAt.toLocaleDateString('ar-EG')}
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

          {activeTab === 'supplies' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">إدارة المخزون</h3>
                <button
                  onClick={() => setShowSupplyModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة مخزون</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التكلفة الإجمالية</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">أضيف بواسطة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عدد المنتجات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplies.map((supply) => (
                      <tr key={supply.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supply.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {supply.totalCost} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supply.createdBy}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Object.keys(supply.items).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">التقارير</h3>
                <button
                  onClick={generateReports}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير تقرير شهري</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="mr-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {shifts.reduce((total, shift) => total + shift.totalAmount, 0)} جنيه
                      </div>
                      <div className="text-sm text-gray-600">إجمالي المبيعات</div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="mr-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {shifts.reduce((total, shift) => total + shift.purchases.reduce((sum, p) => sum + p.quantity, 0), 0)}
                      </div>
                      <div className="text-sm text-gray-600">المنتجات المباعة</div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Users className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="mr-4">
                      <div className="text-2xl font-bold text-gray-900">{customers.length}</div>
                      <div className="text-sm text-gray-600">إجمالي العملاء</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">سجل أنشطة المدير</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراء</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الهدف</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التفاصيل</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المدير</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوقت</th>
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
                          {log.timestamp.toLocaleString('ar-EG')}
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
                <h3 className="text-lg font-medium">إدارة ديون المكملات الغذائية</h3>
                <button
                  onClick={() => {
                    setDebtForm({ amount: supplementDebt?.amount.toString() || '0' });
                    setShowDebtModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span>تحديث الدين</span>
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {supplementDebt?.amount || 0} جنيه
                  </div>
                  <div className="text-sm text-gray-500">
                    دين المكملات الغذائية الحالي
                  </div>
                  {supplementDebt && (
                    <div className="text-xs text-gray-400 mt-2">
                      آخر تحديث بواسطة {supplementDebt.updatedBy} في {supplementDebt.lastUpdated.toLocaleString('ar-EG')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All modals with Arabic text... */}
      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingItem ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الحالية</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm({ ...itemForm, currentAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">بدون فئة</option>
                  {categories.map((category) => (
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
                إلغاء
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingItem ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">إضافة مخزون جديد</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">المنتجات</label>
                <button
                  onClick={addSupplyItem}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  إضافة منتج
                </button>
              </div>
              
              {supplyForm.items.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">المنتج</label>
                    <select
                      value={item.itemId}
                      onChange={(e) => updateSupplyItem(index, 'itemId', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">اختر منتج</option>
                      {items.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">الكمية</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateSupplyItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">التكلفة</label>
                    <input
                      type="number"
                      value={item.cost}
                      onChange={(e) => updateSupplyItem(index, 'cost', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => removeSupplyItem(index)}
                    className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    حذف
                  </button>
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة الإجمالية</label>
                <input
                  type="number"
                  value={supplyForm.totalCost}
                  onChange={(e) => setSupplyForm({ ...supplyForm, totalCost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSupplyModal(false);
                  setSupplyForm({ items: [], totalCost: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSupply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetailsModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">تفاصيل الوردية</h3>
              <button
                onClick={() => setShowShiftDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">معلومات الوردية</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">المستخدم:</span> {selectedShift.username}</div>
                  <div><span className="font-medium">بداية الوردية:</span> {selectedShift.startTime.toLocaleString('ar-EG')}</div>
                  <div><span className="font-medium">نهاية الوردية:</span> {selectedShift.endTime ? selectedShift.endTime.toLocaleString('ar-EG') : 'نشط'}</div>
                  <div><span className="font-medium">المبلغ الإجمالي:</span> {selectedShift.totalAmount} جنيه</div>
                  <div><span className="font-medium">الحالة:</span> {selectedShift.status === 'active' ? 'نشط' : 'مغلق'}</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">المبيعات</h4>
                <div className="max-h-40 overflow-y-auto">
                  {selectedShift.purchases.map((purchase, index) => (
                    <div key={index} className="flex justify-between text-sm py-1">
                      <span>{purchase.name} x{purchase.quantity}</span>
                      <span>{(purchase.price * purchase.quantity).toFixed(2)} جنيه</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">المصروفات</h4>
                <div className="max-h-40 overflow-y-auto">
                  {selectedShift.expenses.map((expense, index) => (
                    <div key={index} className="flex justify-between text-sm py-1">
                      <span>{expense.reason}</span>
                      <span>{expense.amount} جنيه</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedShift.discrepancies && selectedShift.discrepancies.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">التناقضات</h4>
                  <div className="space-y-1">
                    {selectedShift.discrepancies.map((discrepancy, index) => (
                      <div key={index} className="text-sm text-red-600">{discrepancy}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Other modals (User, Customer, Category, Debt) with Arabic translations... */}
      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'normal' | 'admin' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">مستخدم عادي</option>
                  <option value="admin">مدير</option>
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
                إلغاء
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingUser ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">إضافة فئة جديدة</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة</label>
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
                إلغاء
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                إنشاء
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
              {editingCustomer ? 'تعديل العميل' : 'إضافة عميل جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
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
                إلغاء
              </button>
              <button
                onClick={handleSaveCustomer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingCustomer ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">تحديث دين المكملات الغذائية</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ الدين (جنيه)</label>
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
                إلغاء
              </button>
              <button
                onClick={handleUpdateDebt}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                تحديث
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;