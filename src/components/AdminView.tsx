import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Package, DollarSign, FileText, Download, Calendar, Archive, Eye, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { 
  Item, Category, Customer, CustomerPurchase, Shift, Supply, User, AdminLog, 
  SupplementDebt, SupplementDebtTransaction, MonthlyArchive 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsPDF, generateMonthlySummaryPDF } from '../utils/pdfGenerator';

interface AdminViewProps {
  section: 'store' | 'supplement';
}

const AdminView: React.FC<AdminViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'customers' | 'shifts' | 'supplies' | 'users' | 'logs' | 'debt'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [supplementDebt, setSupplementDebt] = useState<SupplementDebt | null>(null);
  const [debtTransactions, setDebtTransactions] = useState<SupplementDebtTransaction[]>([]);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  
  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [showEditDebtTransactionModal, setShowEditDebtTransactionModal] = useState(false);
  
  // Edit states
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingDebtTransaction, setEditingDebtTransaction] = useState<SupplementDebtTransaction | null>(null);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  
  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    sellPrice: '',
    costPrice: '',
    currentAmount: '',
    image: '',
    categoryId: ''
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: ''
  });
  
  const [customerForm, setCustomerForm] = useState({
    name: ''
  });
  
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'normal' as 'normal' | 'admin'
  });
  
  const [supplyForm, setSupplyForm] = useState({
    items: {} as Record<string, number>,
    totalCost: ''
  });
  
  const [debtForm, setDebtForm] = useState({
    type: 'debt' as 'payment' | 'debt',
    amount: '',
    note: ''
  });

  const [debtTransactionForm, setDebtTransactionForm] = useState({
    type: 'debt' as 'payment' | 'debt',
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
      setIsLoading(true);
      
      const [itemsData, categoriesData, customersData, shiftsData, suppliesData] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCategoriesBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getShiftsBySection(section),
        db_service.getSuppliesBySection(section)
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setCustomers(customersData);
      setShifts(shiftsData);
      setSupplies(suppliesData);

      if (activeTab === 'users') {
        const usersData = await db_service.getAllUsers();
        setUsers(usersData);
      }

      if (activeTab === 'logs') {
        const logsData = await db_service.getAllAdminLogs();
        setAdminLogs(logsData);
      }

      if (activeTab === 'debt' && section === 'supplement') {
        const [debtData, transactionsData] = await Promise.all([
          db_service.getSupplementDebt(),
          db_service.getSupplementDebtTransactions()
        ]);
        setSupplementDebt(debtData);
        setDebtTransactions(transactionsData);
      }

      const archivesData = await db_service.getMonthlyArchives(section);
      setMonthlyArchives(archivesData);
      
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      setError('فشل في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      loadData();
    }
  }, [section, activeTab]);

  // Customer management functions
  const openCustomerDetails = async (customer: Customer) => {
    try {
      setSelectedCustomerForDetails(customer);
      const purchases = await db_service.getCustomerPurchases(customer.id);
      setCustomerPurchases(purchases);
      setShowCustomerDetailsModal(true);
    } catch (error) {
      console.error('خطأ في تحميل تفاصيل العميل:', error);
      setError('فشل في تحميل تفاصيل العميل');
    }
  };

  const saveCustomer = async () => {
    if (!customerForm.name.trim()) return;

    try {
      setIsLoading(true);
      
      const customer: Customer = {
        id: editingCustomer?.id || uuidv4(),
        name: customerForm.name.trim(),
        section,
        createdAt: editingCustomer?.createdAt || new Date()
      };

      await db_service.saveCustomer(customer);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingCustomer ? 'customer_edit' : 'customer_create',
        itemOrShiftAffected: `Customer: ${customer.name}`,
        changeDetails: editingCustomer 
          ? `Customer updated: ${customer.name}`
          : `New customer created: ${customer.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetCustomerForm();
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ العميل:', error);
      setError('فشل في حفظ العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customer.name}"؟`)) return;

    try {
      setIsLoading(true);
      
      // Check if customer has purchases
      const purchases = await db_service.getCustomerPurchases(customer.id);
      if (purchases.length > 0) {
        if (!confirm(`هذا العميل لديه ${purchases.length} عملية شراء. هل تريد المتابعة؟`)) {
          setIsLoading(false);
          return;
        }
        
        // Delete all customer purchases
        for (const purchase of purchases) {
          await db_service.deleteCustomerPurchase(purchase.id);
        }
      }

      await db_service.deleteCustomer(customer.id);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'customer_delete',
        itemOrShiftAffected: `Customer: ${customer.name}`,
        changeDetails: `Customer deleted: ${customer.name} (${purchases.length} purchases also deleted)`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('خطأ في حذف العميل:', error);
      setError('فشل في حذف العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const editCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name
    });
    setShowCustomerModal(true);
  };

  const resetCustomerForm = () => {
    setCustomerForm({ name: '' });
    setEditingCustomer(null);
    setShowCustomerModal(false);
  };

  // Debt management functions
  const saveDebtTransaction = async () => {
    if (!debtForm.amount || !debtForm.note.trim()) return;

    try {
      setIsLoading(true);
      
      const amount = parseFloat(debtForm.amount);
      const transaction: SupplementDebtTransaction = {
        id: uuidv4(),
        type: debtForm.type,
        amount,
        note: debtForm.note.trim(),
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveSupplementDebtTransaction(transaction);

      // Update total debt
      const currentDebt = supplementDebt?.amount || 0;
      const newDebtAmount = debtForm.type === 'debt' 
        ? currentDebt + amount 
        : Math.max(0, currentDebt - amount);

      const updatedDebt: SupplementDebt = {
        amount: newDebtAmount,
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'debt_transaction',
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `${debtForm.type === 'debt' ? 'Added debt' : 'Payment received'}: ${amount} EGP. Note: ${debtForm.note}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      resetDebtForm();
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ معاملة الدين:', error);
      setError('فشل في حفظ معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  const editDebtTransaction = (transaction: SupplementDebtTransaction) => {
    setEditingDebtTransaction(transaction);
    setDebtTransactionForm({
      type: transaction.type,
      amount: transaction.amount.toString(),
      note: transaction.note
    });
    setShowEditDebtTransactionModal(true);
  };

  const updateDebtTransaction = async () => {
    if (!editingDebtTransaction || !debtTransactionForm.amount || !debtTransactionForm.note.trim()) return;

    try {
      setIsLoading(true);
      
      const oldAmount = editingDebtTransaction.amount;
      const oldType = editingDebtTransaction.type;
      const newAmount = parseFloat(debtTransactionForm.amount);
      const newType = debtTransactionForm.type;

      // Update the transaction
      const updatedTransaction: SupplementDebtTransaction = {
        ...editingDebtTransaction,
        type: newType,
        amount: newAmount,
        note: debtTransactionForm.note.trim(),
        timestamp: new Date()
      };

      await db_service.saveSupplementDebtTransaction(updatedTransaction);

      // Recalculate total debt
      const currentDebt = supplementDebt?.amount || 0;
      
      // Reverse the old transaction effect
      let adjustedDebt = oldType === 'debt' 
        ? currentDebt - oldAmount 
        : currentDebt + oldAmount;
      
      // Apply the new transaction effect
      const newDebtAmount = newType === 'debt' 
        ? adjustedDebt + newAmount 
        : Math.max(0, adjustedDebt - newAmount);

      const updatedDebt: SupplementDebt = {
        amount: newDebtAmount,
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'debt_transaction_edit',
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `Transaction updated: ${oldType} ${oldAmount} EGP -> ${newType} ${newAmount} EGP. Note: ${debtTransactionForm.note}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      resetDebtTransactionForm();
      await loadData();
    } catch (error) {
      console.error('خطأ في تحديث معاملة الدين:', error);
      setError('فشل في تحديث معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDebtTransaction = async (transaction: SupplementDebtTransaction) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) return;

    try {
      setIsLoading(true);
      
      // Update total debt by reversing this transaction
      const currentDebt = supplementDebt?.amount || 0;
      const newDebtAmount = transaction.type === 'debt' 
        ? Math.max(0, currentDebt - transaction.amount)
        : currentDebt + transaction.amount;

      const updatedDebt: SupplementDebt = {
        amount: newDebtAmount,
        lastUpdated: new Date(),
        updatedBy: user?.username || ''
      };

      await db_service.saveSupplementDebt(updatedDebt);

      // Delete the transaction (Note: This would need to be implemented in the database service)
      // For now, we'll just reload the data
      
      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'debt_transaction_delete',
        itemOrShiftAffected: 'Supplement Debt',
        changeDetails: `Transaction deleted: ${transaction.type} ${transaction.amount} EGP. Note: ${transaction.note}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section: 'supplement'
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('خطأ في حذف معاملة الدين:', error);
      setError('فشل في حذف معاملة الدين');
    } finally {
      setIsLoading(false);
    }
  };

  const resetDebtForm = () => {
    setDebtForm({ type: 'debt', amount: '', note: '' });
    setShowDebtModal(false);
  };

  const resetDebtTransactionForm = () => {
    setDebtTransactionForm({ type: 'debt', amount: '', note: '' });
    setEditingDebtTransaction(null);
    setShowEditDebtTransactionModal(false);
  };

  // Item management functions
  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.sellPrice || !itemForm.costPrice) return;

    try {
      setIsLoading(true);
      
      const item: Item = {
        id: editingItem?.id || uuidv4(),
        name: itemForm.name.trim(),
        sellPrice: parseFloat(itemForm.sellPrice),
        costPrice: parseFloat(itemForm.costPrice),
        currentAmount: parseInt(itemForm.currentAmount) || 0,
        image: itemForm.image || undefined,
        categoryId: itemForm.categoryId || undefined,
        section,
        createdAt: editingItem?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await db_service.saveItem(item);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingItem ? 'item_edit' : 'item_create',
        itemOrShiftAffected: `Item: ${item.name}`,
        changeDetails: editingItem 
          ? `Item updated: ${item.name} - Sell: ${item.sellPrice}, Cost: ${item.costPrice}, Amount: ${item.currentAmount}`
          : `New item created: ${item.name} - Sell: ${item.sellPrice}, Cost: ${item.costPrice}, Amount: ${item.currentAmount}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetItemForm();
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

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'item_delete',
        itemOrShiftAffected: `Item: ${item.name}`,
        changeDetails: `Item deleted: ${item.name}`,
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

  const editItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sellPrice: item.sellPrice.toString(),
      costPrice: item.costPrice.toString(),
      currentAmount: item.currentAmount.toString(),
      image: item.image || '',
      categoryId: item.categoryId || ''
    });
    setShowItemModal(true);
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      sellPrice: '',
      costPrice: '',
      currentAmount: '',
      image: '',
      categoryId: ''
    });
    setEditingItem(null);
    setShowItemModal(false);
  };

  // Category management functions
  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    try {
      setIsLoading(true);
      
      const category: Category = {
        id: editingCategory?.id || uuidv4(),
        name: categoryForm.name.trim(),
        section,
        createdAt: editingCategory?.createdAt || new Date()
      };

      await db_service.saveCategory(category);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingCategory ? 'category_edit' : 'category_create',
        itemOrShiftAffected: `Category: ${category.name}`,
        changeDetails: editingCategory 
          ? `Category updated: ${category.name}`
          : `New category created: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetCategoryForm();
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

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'category_delete',
        itemOrShiftAffected: `Category: ${category.name}`,
        changeDetails: `Category deleted: ${category.name}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('خطأ في حذف الفئة:', error);
      setError('فشل في حذف الفئة');
    } finally {
      setIsLoading(false);
    }
  };

  const editCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryModal(true);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '' });
    setEditingCategory(null);
    setShowCategoryModal(false);
  };

  // User management functions
  const saveUser = async () => {
    if (!userForm.username.trim() || !userForm.password.trim()) return;

    try {
      setIsLoading(true);
      
      const newUser: User = {
        id: editingUser?.id || uuidv4(),
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        createdAt: editingUser?.createdAt || new Date()
      };

      if (editingUser) {
        await db_service.updateUser(newUser);
      } else {
        await db_service.createUser(newUser);
      }

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: editingUser ? 'user_edit' : 'user_create',
        itemOrShiftAffected: `User: ${newUser.username}`,
        changeDetails: editingUser 
          ? `User updated: ${newUser.username} (${newUser.role})`
          : `New user created: ${newUser.username} (${newUser.role})`,
        timestamp: new Date(),
        adminName: user?.username || ''
      };
      await db_service.saveAdminLog(log);

      resetUserForm();
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ المستخدم:', error);
      setError('فشل في حفظ المستخدم');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (userToDelete.id === user?.id) {
      setError('لا يمكنك حذف حسابك الخاص');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userToDelete.username}"؟`)) return;

    try {
      setIsLoading(true);
      await db_service.deleteUser(userToDelete.id);

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'user_delete',
        itemOrShiftAffected: `User: ${userToDelete.username}`,
        changeDetails: `User deleted: ${userToDelete.username}`,
        timestamp: new Date(),
        adminName: user?.username || ''
      };
      await db_service.saveAdminLog(log);

      await loadData();
    } catch (error) {
      console.error('خطأ في حذف المستخدم:', error);
      setError('فشل في حذف المستخدم');
    } finally {
      setIsLoading(false);
    }
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

  const resetUserForm = () => {
    setUserForm({ username: '', password: '', role: 'normal' });
    setEditingUser(null);
    setShowUserModal(false);
  };

  // Supply management functions
  const saveSupply = async () => {
    if (!supplyForm.totalCost || Object.keys(supplyForm.items).length === 0) return;

    try {
      setIsLoading(true);
      
      const supply: Supply = {
        id: uuidv4(),
        section,
        items: supplyForm.items,
        totalCost: parseFloat(supplyForm.totalCost),
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      // Get active shift to deduct cost
      const activeShift = await db_service.getActiveShift(section);
      await db_service.saveSupply(supply, activeShift || undefined);

      // Update item quantities
      for (const [itemId, quantity] of Object.entries(supplyForm.items)) {
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

      // Log the action
      const log: AdminLog = {
        id: uuidv4(),
        actionType: 'supply_add',
        itemOrShiftAffected: 'Supply',
        changeDetails: `Supply added: ${supplyForm.totalCost} EGP. Items: ${Object.entries(supplyForm.items).map(([id, qty]) => {
          const item = items.find(i => i.id === id);
          return `${item?.name}: ${qty}`;
        }).join(', ')}`,
        timestamp: new Date(),
        adminName: user?.username || '',
        section
      };
      await db_service.saveAdminLog(log);

      resetSupplyForm();
      await loadData();
    } catch (error) {
      console.error('خطأ في حفظ التوريد:', error);
      setError('فشل في حفظ التوريد');
    } finally {
      setIsLoading(false);
    }
  };

  const resetSupplyForm = () => {
    setSupplyForm({ items: {}, totalCost: '' });
    setShowSupplyModal(false);
  };

  // Month reset function
  const resetMonth = async () => {
    if (!confirm(`هل أنت متأكد من إعادة تعيين شهر ${section}؟ سيتم أرشفة جميع البيانات الحالية وحذفها.`)) return;

    try {
      setIsLoading(true);
      await db_service.resetMonth(section, user?.username || '');
      await loadData();
      alert('تم إعادة تعيين الشهر بنجاح');
    } catch (error) {
      console.error('خطأ في إعادة تعيين الشهر:', error);
      setError('فشل في إعادة تعيين الشهر');
    } finally {
      setIsLoading(false);
    }
  };

  // PDF generation functions
  const generateShiftReport = () => {
    generateShiftsPDF(shifts, section);
  };

  const generateMonthlyReport = () => {
    generateMonthlySummaryPDF(shifts, items, section, new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'items':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">إدارة المنتجات</h3>
              <button
                onClick={() => setShowItemModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة منتج</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-white border rounded-lg p-4">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="w-full h-32 object-cover rounded-md mb-2" />
                  )}
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-600">سعر البيع: {item.sellPrice} جنيه</div>
                  <div className="text-sm text-gray-600">سعر التكلفة: {item.costPrice} جنيه</div>
                  <div className="text-sm text-gray-600">المخزون: {item.currentAmount}</div>
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={() => editItem(item)}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'customers':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">إدارة العملاء</h3>
              <button
                onClick={() => setShowCustomerModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة عميل</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      اسم العميل
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
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.createdAt.toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => openCustomerDetails(customer)}
                          className="bg-green-600 hover:bg-green-700 text-white p-2 rounded"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => editCustomer(customer)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer)}
                          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded"
                          title="حذف"
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
        );

      case 'debt':
        if (section !== 'supplement') {
          return (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">إدارة الديون</h3>
              <p className="text-gray-600">إدارة الديون متاحة فقط لقسم المكملات الغذائية</p>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">إدارة ديون المكملات الغذائية</h3>
              <button
                onClick={() => setShowDebtModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة معاملة</span>
              </button>
            </div>

            {/* Current Debt Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">إجمالي الدين الحالي</h4>
              <div className="text-3xl font-bold text-red-600">
                {supplementDebt?.amount?.toFixed(2) || '0.00'} جنيه
              </div>
              {supplementDebt && (
                <div className="text-sm text-gray-500 mt-2">
                  آخر تحديث: {supplementDebt.lastUpdated.toLocaleString('ar-EG')} بواسطة {supplementDebt.updatedBy}
                </div>
              )}
            </div>

            {/* Debt Transactions */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">معاملات الديون</h4>
              </div>
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
                        بواسطة
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
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.type === 'debt' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {transaction.type === 'debt' ? 'دين' : 'دفع'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.amount.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {transaction.note}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.timestamp.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.createdBy}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => editDebtTransaction(transaction)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteDebtTransaction(transaction)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded"
                            title="حذف"
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
          </div>
        );

      case 'shifts':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">إدارة الورديات</h3>
              <div className="flex space-x-2">
                <button
                  onClick={generateShiftReport}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>تقرير الورديات</span>
                </button>
                <button
                  onClick={generateMonthlyReport}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>التقرير الشهري</span>
                </button>
                <button
                  onClick={resetMonth}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Archive className="h-4 w-4" />
                  <span>إعادة تعيين الشهر</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المستخدم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      بداية الوردية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      نهاية الوردية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      إجمالي النقدية
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
                        {shift.endTime ? shift.endTime.toLocaleString('ar-EG') : 'نشطة'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.totalAmount.toFixed(2)} جنيه
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          shift.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {shift.status === 'active' ? 'نشطة' : 'مغلقة'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          shift.validationStatus === 'balanced' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {shift.validationStatus === 'balanced' ? 'متوازنة' : 'تضارب'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'supplies':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">إدارة التوريدات</h3>
              <button
                onClick={() => setShowSupplyModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة توريد</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      إجمالي التكلفة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      بواسطة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المنتجات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplies.map(supply => (
                    <tr key={supply.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supply.timestamp.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {supply.totalCost.toFixed(2)} جنيه
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supply.createdBy}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {Object.entries(supply.items).map(([itemId, quantity]) => {
                          const item = items.find(i => i.id === itemId);
                          return `${item?.name || 'منتج محذوف'}: ${quantity}`;
                        }).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">إدارة المستخدمين</h3>
              <button
                onClick={() => setShowUserModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة مستخدم</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      اسم المستخدم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الدور
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
                  {users.map(userItem => (
                    <tr key={userItem.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {userItem.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userItem.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {userItem.role === 'admin' ? 'مدير' : 'مستخدم عادي'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {userItem.createdAt.toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => editUser(userItem)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {userItem.id !== user?.id && (
                          <button
                            onClick={() => deleteUser(userItem)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded"
                            title="حذف"
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
        );

      case 'logs':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">سجل أنشطة المدير</h3>
            
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      نوع الإجراء
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العنصر المتأثر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تفاصيل التغيير
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المدير
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      القسم
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.changeDetails}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.timestamp.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.adminName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.section || 'عام'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError('')}
            className="float-right text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'items', label: 'المنتجات', icon: Package },
            { id: 'customers', label: 'العملاء', icon: Users },
            { id: 'shifts', label: 'الورديات', icon: FileText },
            { id: 'supplies', label: 'التوريدات', icon: Package },
            { id: 'users', label: 'المستخدمين', icon: Users },
            { id: 'logs', label: 'السجلات', icon: FileText },
            ...(section === 'supplement' ? [{ id: 'debt', label: 'إدارة الديون', icon: DollarSign }] : [])
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
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
      <div className="bg-gray-50 rounded-lg p-6">
        {renderTabContent()}
      </div>

      {/* Customer Details Modal */}
      {showCustomerDetailsModal && selectedCustomerForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">تفاصيل العميل: {selectedCustomerForDetails.name}</h3>
              <button
                onClick={() => setShowCustomerDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                  <input
                    type="text"
                    value={selectedCustomerForDetails.name}
                    onChange={(e) => setSelectedCustomerForDetails({
                      ...selectedCustomerForDetails,
                      name: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإنشاء</label>
                  <input
                    type="text"
                    value={selectedCustomerForDetails.createdAt.toLocaleDateString('ar-EG')}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 mb-2">مشتريات العميل</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  {customerPurchases.length > 0 ? (
                    <div className="space-y-3">
                      {customerPurchases.map(purchase => (
                        <div key={purchase.id} className="bg-white rounded-lg p-3 border">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">المبلغ: {purchase.totalAmount.toFixed(2)} جنيه</div>
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
                                  <span>{(item.price * item.quantity).toFixed(2)} جنيه</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      لا توجد مشتريات لهذا العميل
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCustomerDetailsModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  await db_service.saveCustomer(selectedCustomerForDetails);
                  setShowCustomerDetailsModal(false);
                  await loadData();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingCustomer ? 'تعديل العميل' : 'إضافة عميل جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم العميل"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetCustomerForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveCustomer}
                disabled={!customerForm.name.trim() || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : editingCustomer ? 'تحديث' : 'إضافة'}
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
                  value={debtForm.type}
                  onChange={(e) => setDebtForm({ ...debtForm, type: e.target.value as 'payment' | 'debt' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="debt">إضافة دين</option>
                  <option value="payment">دفع</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الملاحظة</label>
                <textarea
                  value={debtForm.note}
                  onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="أدخل ملاحظة..."
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetDebtForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveDebtTransaction}
                disabled={!debtForm.amount || !debtForm.note.trim() || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'إضافة معاملة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Debt Transaction Modal */}
      {showEditDebtTransactionModal && editingDebtTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">تعديل معاملة الدين</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المعاملة</label>
                <select
                  value={debtTransactionForm.type}
                  onChange={(e) => setDebtTransactionForm({ ...debtTransactionForm, type: e.target.value as 'payment' | 'debt' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="debt">إضافة دين</option>
                  <option value="payment">دفع</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={debtTransactionForm.amount}
                  onChange={(e) => setDebtTransactionForm({ ...debtTransactionForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الملاحظة</label>
                <textarea
                  value={debtTransactionForm.note}
                  onChange={(e) => setDebtTransactionForm({ ...debtTransactionForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="أدخل ملاحظة..."
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetDebtTransactionForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={updateDebtTransaction}
                disabled={!debtTransactionForm.amount || !debtTransactionForm.note.trim() || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري التحديث...' : 'تحديث المعاملة'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المنتج"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (جنيه)</label>
                  <input
                    type="number"
                    value={itemForm.sellPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة (جنيه)</label>
                  <input
                    type="number"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الحالية</label>
                <input
                  type="number"
                  value={itemForm.currentAmount}
                  onChange={(e) => setItemForm({ ...itemForm, currentAmount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة (اختياري)</label>
                <input
                  type="url"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة (اختياري)</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
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
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetItemForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveItem}
                disabled={!itemForm.name.trim() || !itemForm.sellPrice || !itemForm.costPrice || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : editingItem ? 'تحديث' : 'إضافة'}
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
              {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم الفئة"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetCategoryForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveCategory}
                disabled={!categoryForm.name.trim() || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : editingCategory ? 'تحديث' : 'إضافة'}
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
              {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل اسم المستخدم"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'normal' | 'admin' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="normal">مستخدم عادي</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetUserForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveUser}
                disabled={!userForm.username.trim() || !userForm.password.trim() || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : editingUser ? 'تحديث' : 'إضافة'}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">المنتجات والكميات</label>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">المخزون الحالي: {item.currentAmount}</div>
                      </div>
                      <input
                        type="number"
                        value={supplyForm.items[item.id] || ''}
                        onChange={(e) => {
                          const quantity = parseInt(e.target.value) || 0;
                          setSupplyForm({
                            ...supplyForm,
                            items: {
                              ...supplyForm.items,
                              [item.id]: quantity
                            }
                          });
                        }}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">إجمالي التكلفة (جنيه)</label>
                <input
                  type="number"
                  value={supplyForm.totalCost}
                  onChange={(e) => setSupplyForm({ ...supplyForm, totalCost: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={resetSupplyForm}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={saveSupply}
                disabled={!supplyForm.totalCost || Object.keys(supplyForm.items).length === 0 || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'جاري الحفظ...' : 'إضافة توريد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;