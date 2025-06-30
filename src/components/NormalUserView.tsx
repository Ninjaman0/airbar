import React, { useState, useEffect } from 'react';
import { Plus, Package, Users, DollarSign, Clock, AlertTriangle, CheckCircle, X, Edit, Trash2, Camera, Upload, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db_service } from '../services/database';
import { useRealtime } from '../hooks/useRealtime';
import { Item, Shift, PurchaseItem, Customer, CustomerPurchase, Expense, ExternalMoney } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface NormalUserViewProps {
  section: 'store' | 'supplement';
}

const NormalUserView: React.FC<NormalUserViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerPurchase, setIsCustomerPurchase] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showExternalMoneyModal, setShowExternalMoneyModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [externalAmount, setExternalAmount] = useState('');
  const [externalReason, setExternalReason] = useState('');
  const [finalInventory, setFinalInventory] = useState<Record<string, number>>({});
  const [finalCash, setFinalCash] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [showCloseWithReason, setShowCloseWithReason] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentCash, setCurrentCash] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<CustomerPurchase | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'customers'>('sales');

  // Load data
  useEffect(() => {
    loadData();
  }, [section]);

  // Calculate current cash
  useEffect(() => {
    if (activeShift) {
      const totalSales = activeShift.purchases.reduce((sum, p) => sum + (p.price * p.quantity), 0);
      const totalExpenses = activeShift.expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalExternal = activeShift.externalMoney.reduce((sum, e) => sum + e.amount, 0);
      setCurrentCash(totalSales - totalExpenses + totalExternal);
    }
  }, [activeShift]);

  const loadData = async () => {
    try {
      const [itemsData, customersData, activeShiftData, unpaidData] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getActiveShift(section),
        db_service.getUnpaidCustomerPurchases(section)
      ]);

      setItems(itemsData);
      setCustomers(customersData);
      setActiveShift(activeShiftData);
      setUnpaidPurchases(unpaidData);

      // Initialize final inventory with current amounts
      const inventoryMap: Record<string, number> = {};
      itemsData.forEach(item => {
        inventoryMap[item.id] = item.currentAmount;
      });
      setFinalInventory(inventoryMap);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      setError('فشل في تحميل البيانات');
    }
  };

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      switch (event.type) {
        case 'ITEM_UPDATED':
        case 'SHIFT_UPDATED':
        case 'CUSTOMER_UPDATED':
        case 'EXPENSE_ADDED':
        case 'EXTERNAL_MONEY_UPDATED':
          loadData();
          break;
      }
    }
  }, [section]);

  const startShift = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Get the last closed shift to carry over remaining cash
      const allShifts = await db_service.getShiftsBySection(section);
      const lastClosedShift = allShifts.find(s => s.status === 'closed');
      const startingCash = lastClosedShift?.finalCash || 0;

      const newShift: Shift = {
        id: uuidv4(),
        userId: user.id,
        username: user.username,
        section,
        status: 'active',
        purchases: [],
        expenses: [],
        externalMoney: startingCash > 0 ? [{
          id: uuidv4(),
          amount: startingCash,
          reason: 'مبلغ محول من الوردية السابقة',
          shiftId: '',
          section,
          timestamp: new Date(),
          createdBy: user.username
        }] : [],
        totalAmount: startingCash,
        startTime: new Date(),
        validationStatus: 'balanced'
      };

      // Update shift ID in external money
      if (newShift.externalMoney.length > 0) {
        newShift.externalMoney[0].shiftId = newShift.id;
      }

      await db_service.saveShift(newShift);
      
      // Save external money record if there's starting cash
      if (startingCash > 0) {
        await db_service.saveExternalMoney(newShift.externalMoney[0]);
      }

      setActiveShift(newShift);
      setError('');
    } catch (error) {
      console.error('خطأ في بدء الوردية:', error);
      setError('فشل في بدء الوردية');
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: Item) => {
    if (item.currentAmount <= 0) {
      setError('المنتج غير متوفر في المخزون');
      return;
    }

    const existingItem = cart.find(cartItem => cartItem.itemId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.currentAmount) {
        setError('لا يمكن إضافة أكثر من الكمية المتوفرة');
        return;
      }
      setCart(cart.map(cartItem =>
        cartItem.itemId === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, {
        itemId: item.id,
        quantity: 1,
        price: item.sellPrice,
        name: item.name
      }]);
    }
    setError('');
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.itemId !== itemId));
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    if (quantity > item.currentAmount) {
      setError('لا يمكن تجاوز الكمية المتوفرة');
      return;
    }

    setCart(cart.map(cartItem =>
      cartItem.itemId === itemId
        ? { ...cartItem, quantity }
        : cartItem
    ));
    setError('');
  };

  const processSale = async () => {
    if (!activeShift || cart.length === 0) return;

    try {
      setIsLoading(true);

      if (isCustomerPurchase && !selectedCustomer) {
        setError('يرجى اختيار عميل');
        return;
      }

      // Update inventory
      for (const cartItem of cart) {
        const item = items.find(i => i.id === cartItem.itemId);
        if (item) {
          const updatedItem = {
            ...item,
            currentAmount: item.currentAmount - cartItem.quantity,
            updatedAt: new Date()
          };
          await db_service.saveItem(updatedItem);
        }
      }

      if (isCustomerPurchase && selectedCustomer) {
        // Create customer purchase
        const purchase: CustomerPurchase = {
          id: uuidv4(),
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          items: cart,
          totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          section,
          shiftId: activeShift.id,
          isPaid: false,
          timestamp: new Date()
        };

        await db_service.saveCustomerPurchase(purchase);
      } else {
        // Regular sale - add to shift purchases and update cash
        const updatedShift = {
          ...activeShift,
          purchases: [...activeShift.purchases, ...cart],
          totalAmount: activeShift.totalAmount + cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };

        await db_service.saveShift(updatedShift);
      }

      setCart([]);
      setSelectedCustomer(null);
      setIsCustomerPurchase(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في معالجة البيع:', error);
      setError('فشل في معالجة البيع');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsPaid = async (purchase: CustomerPurchase, amount?: number) => {
    if (!activeShift) return;

    try {
      setIsLoading(true);

      const paymentAmount = amount || purchase.totalAmount;

      // Mark purchase as paid
      const updatedPurchase = { ...purchase, isPaid: true };
      await db_service.saveCustomerPurchase(updatedPurchase);

      // Add to shift purchases and update cash
      const updatedShift = {
        ...activeShift,
        purchases: [...activeShift.purchases, ...purchase.items],
        totalAmount: activeShift.totalAmount + paymentAmount
      };

      await db_service.saveShift(updatedShift);
      await loadData();
      setShowPaymentModal(false);
      setSelectedPurchaseForPayment(null);
      setPaymentAmount('');
    } catch (error) {
      console.error('خطأ في تحديد كمدفوع:', error);
      setError('فشل في تحديد كمدفوع');
    } finally {
      setIsLoading(false);
    }
  };

  const openPaymentModal = (purchase: CustomerPurchase) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentAmount(purchase.totalAmount.toString());
    setShowPaymentModal(true);
  };

  const addExpense = async () => {
    if (!activeShift || !expenseAmount || !expenseReason) return;

    const amount = parseFloat(expenseAmount);
    if (amount > currentCash) {
      setError('لا يمكن أن تتجاوز المصروفات المبلغ الموجود في الصندوق');
      return;
    }

    try {
      setIsLoading(true);

      const expense: Expense = {
        id: uuidv4(),
        amount,
        reason: expenseReason,
        shiftId: activeShift.id,
        section,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveExpense(expense);

      setExpenseAmount('');
      setExpenseReason('');
      setShowExpenseModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في إضافة المصروف:', error);
      setError('فشل في إضافة المصروف');
    } finally {
      setIsLoading(false);
    }
  };

  const editExpense = async () => {
    if (!activeShift || !editingExpense || !expenseAmount || !expenseReason) return;

    const amount = parseFloat(expenseAmount);
    const currentCashWithoutExpense = currentCash + editingExpense.amount;
    
    if (amount > currentCashWithoutExpense) {
      setError('لا يمكن أن تتجاوز المصروفات المبلغ الموجود في الصندوق');
      return;
    }

    try {
      setIsLoading(true);

      const updatedExpense: Expense = {
        ...editingExpense,
        amount,
        reason: expenseReason,
        timestamp: new Date()
      };

      await db_service.saveExpense(updatedExpense);

      setExpenseAmount('');
      setExpenseReason('');
      setEditingExpense(null);
      setShowEditExpenseModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في تعديل المصروف:', error);
      setError('فشل في تعديل المصروف');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteExpense = async (expense: Expense) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
      setIsLoading(true);
      await db_service.deleteExpense(expense.id);
      await loadData();
    } catch (error) {
      console.error('خطأ في حذف المصروف:', error);
      setError('فشل في حذف المصروف');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditExpenseModal = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseAmount(expense.amount.toString());
    setExpenseReason(expense.reason);
    setShowEditExpenseModal(true);
  };

  const addExternalMoney = async () => {
    if (!activeShift || !externalAmount || !externalReason) return;

    try {
      setIsLoading(true);

      const amount = parseFloat(externalAmount);
      const externalMoney: ExternalMoney = {
        id: uuidv4(),
        amount,
        reason: externalReason,
        shiftId: activeShift.id,
        section,
        timestamp: new Date(),
        createdBy: user?.username || ''
      };

      await db_service.saveExternalMoney(externalMoney);

      setExternalAmount('');
      setExternalReason('');
      setShowExternalMoneyModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في إضافة الأموال الخارجية:', error);
      setError('فشل في إضافة الأموال الخارجية');
    } finally {
      setIsLoading(false);
    }
  };

  const validateShiftClose = () => {
    const finalCashAmount = parseFloat(finalCash) || 0;
    const expectedCash = currentCash;
    const discrepancies: string[] = [];

    // Check cash discrepancy
    if (Math.abs(finalCashAmount - expectedCash) > 0.01) {
      discrepancies.push(`تضارب في النقدية: متوقع ${expectedCash.toFixed(2)} جنيه، موجود ${finalCashAmount.toFixed(2)} جنيه`);
    }

    // Check inventory discrepancies
    for (const item of items) {
      const reportedAmount = finalInventory[item.id] || 0;
      const expectedAmount = item.currentAmount;

      if (reportedAmount !== expectedAmount) {
        discrepancies.push(`${item.name}: متوقع ${expectedAmount}، موجود ${reportedAmount}`);
      }
    }

    return discrepancies;
  };

  const closeShift = async (forceClose = false) => {
    if (!activeShift) return;

    try {
      setIsLoading(true);

      const discrepancies = validateShiftClose();

      // If there are discrepancies and not forcing close, show error
      if (discrepancies.length > 0 && !forceClose) {
        setError('يوجد تضارب في البيانات. يرجى مراجعة المدخلات أو استخدام زر "إغلاق مع سبب"');
        setShowCloseWithReason(true);
        setIsLoading(false);
        return;
      }

      // If forcing close, require a reason
      if (forceClose && !closeReason.trim()) {
        setError('يجب إدخال سبب صالح لإغلاق الوردية مع وجود تضارب');
        setIsLoading(false);
        return;
      }

      const finalCashAmount = parseFloat(finalCash) || 0;

      // Update item inventory to reported amounts
      for (const item of items) {
        const reportedAmount = finalInventory[item.id] || 0;
        const updatedItem = {
          ...item,
          currentAmount: reportedAmount,
          updatedAt: new Date()
        };
        await db_service.saveItem(updatedItem);
      }

      const updatedShift: Shift = {
        ...activeShift,
        status: 'closed',
        endTime: new Date(),
        finalInventory,
        finalCash: finalCashAmount,
        discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
        closeReason: closeReason || undefined,
        validationStatus: discrepancies.length > 0 ? 'discrepancy' : 'balanced'
      };

      await db_service.saveShift(updatedShift);

      setActiveShift(null);
      setShowCloseShiftModal(false);
      setShowCloseWithReason(false);
      setFinalCash('');
      setCloseReason('');
      setError('');
      await loadData();
    } catch (error) {
      console.error('خطأ في إغلاق الوردية:', error);
      setError('فشل في إغلاق الوردية');
    } finally {
      setIsLoading(false);
    }
  };

  const createCustomer = async () => {
    if (!newCustomerName.trim()) return;

    try {
      setIsLoading(true);

      const customer: Customer = {
        id: uuidv4(),
        name: newCustomerName.trim(),
        section,
        createdAt: new Date()
      };

      await db_service.saveCustomer(customer);
      setNewCustomerName('');
      setShowNewCustomerModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في إنشاء العميل:', error);
      setError('فشل في إنشاء العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerDetails = async (customer: Customer) => {
    try {
      setSelectedCustomerDetails(customer);
      const purchases = await db_service.getCustomerPurchases(customer.id);
      setCustomerPurchases(purchases.filter(p => !p.isPaid));
      setShowCustomerDetailsModal(true);
    } catch (error) {
      console.error('خطأ في تحميل تفاصيل العميل:', error);
      setError('فشل في تحميل تفاصيل العميل');
    }
  };

  const payAllCustomerDebt = async (customer: Customer) => {
    if (!activeShift) return;

    try {
      setIsLoading(true);
      const purchases = await db_service.getCustomerPurchases(customer.id);
      const unpaidPurchases = purchases.filter(p => !p.isPaid);
      
      let totalDebt = 0;
      for (const purchase of unpaidPurchases) {
        totalDebt += purchase.totalAmount;
        await markAsPaid(purchase);
      }
      
      setShowCustomerDetailsModal(false);
      await loadData();
    } catch (error) {
      console.error('خطأ في دفع جميع ديون العميل:', error);
      setError('فشل في دفع جميع ديون العميل');
    } finally {
      setIsLoading(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!activeShift) {
    return (
      <div className="text-center py-12">
        <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">لا توجد وردية نشطة</h2>
        <p className="text-gray-600 mb-6">ابدأ وردية جديدة لبدء بيع المنتجات</p>
        <button
          onClick={startShift}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
        >
          {isLoading ? 'جاري البدء...' : 'بدء الوردية'}
        </button>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shift Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">الوردية النشطة</h2>
            <p className="text-gray-600">بدأت: {activeShift.startTime.toLocaleString('ar-EG')}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">{currentCash.toFixed(2)} جنيه</div>
            <div className="text-sm text-gray-600">النقدية الحالية</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {activeShift.purchases.reduce((sum, p) => sum + p.quantity, 0)}
            </div>
            <div className="text-sm text-blue-600">المنتجات المباعة</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {activeShift.purchases.reduce((sum, p) => sum + (p.price * p.quantity), 0).toFixed(2)} جنيه
            </div>
            <div className="text-sm text-green-600">إجمالي المبيعات</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {activeShift.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} جنيه
            </div>
            <div className="text-sm text-red-600">المصروفات</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {activeShift.externalMoney.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} جنيه
            </div>
            <div className="text-sm text-purple-600">الأموال الخارجية</div>
          </div>
        </div>

        <div className="flex space-x-4 mt-4">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            إضافة مصروف
          </button>
          <button
            onClick={() => setShowExternalMoneyModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            إضافة أموال خارجية
          </button>
          <button
            onClick={() => setShowCloseShiftModal(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            إغلاق الوردية
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('sales')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sales'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              المبيعات
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              العملاء
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'sales' ? (
            <>
              {/* Current Shift Expenses */}
              {activeShift.expenses.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">مصروفات الوردية الحالية</h3>
                  <div className="space-y-3">
                    {activeShift.expenses.map(expense => (
                      <div key={expense.id} className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                        <div>
                          <div className="font-medium">{expense.reason}</div>
                          <div className="text-sm text-gray-600">{expense.amount.toFixed(2)} جنيه</div>
                          <div className="text-xs text-gray-500">
                            {expense.timestamp.toLocaleString('ar-EG')} - {expense.createdBy}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditExpenseModal(expense)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteExpense(expense)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Debt Summary */}
              {unpaidPurchases.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">ديون العملاء</h3>
                  <div className="space-y-3">
                    {customers.map(customer => {
                      const customerDebt = unpaidPurchases
                        .filter(p => p.customerId === customer.id)
                        .reduce((sum, p) => sum + p.totalAmount, 0);
                      
                      if (customerDebt === 0) return null;

                      return (
                        <div key={customer.id} className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                          <div>
                            <button
                              onClick={() => openCustomerDetails(customer)}
                              className="font-medium text-blue-600 hover:text-blue-800"
                            >
                              {customer.name}
                            </button>
                            <div className="text-sm text-gray-600">
                              إجمالي الدين: {customerDebt.toFixed(2)} جنيه
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => payAllCustomerDebt(customer)}
                              disabled={isLoading}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                            >
                              دفع الكل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Items Grid */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">المنتجات</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            item.currentAmount > 0
                              ? 'hover:bg-blue-50 border-gray-200'
                              : 'bg-gray-50 border-gray-300 cursor-not-allowed'
                          }`}
                          onClick={() => item.currentAmount > 0 && addToCart(item)}
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-32 object-cover rounded-md mb-2"
                            />
                          )}
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-lg font-bold text-blue-600">{item.sellPrice} جنيه</div>
                          <div className={`text-sm ${item.currentAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            المخزون: {item.currentAmount}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cart */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">السلة</h3>
                  
                  {/* Customer Purchase Toggle */}
                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isCustomerPurchase}
                        onChange={(e) => setIsCustomerPurchase(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">شراء عميل (غير مدفوع)</span>
                    </label>
                  </div>

                  {/* Customer Selection */}
                  {isCustomerPurchase && (
                    <div className="mb-4">
                      <div className="flex space-x-2 mb-2">
                        <select
                          value={selectedCustomer?.id || ''}
                          onChange={(e) => {
                            const customer = customers.find(c => c.id === e.target.value);
                            setSelectedCustomer(customer || null);
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value="">اختر عميل</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowNewCustomerModal(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cart Items */}
                  <div className="space-y-3 mb-4">
                    {cart.map(cartItem => (
                      <div key={cartItem.itemId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{cartItem.name}</div>
                          <div className="text-sm text-gray-600">{cartItem.price} جنيه للقطعة</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartQuantity(cartItem.itemId, cartItem.quantity - 1)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(cartItem.itemId, cartItem.quantity + 1)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(cartItem.itemId)}
                            className="text-red-600 hover:text-red-700 ml-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cart Total */}
                  {cart.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold">الإجمالي:</span>
                        <span className="text-xl font-bold text-blue-600">{cartTotal.toFixed(2)} جنيه</span>
                      </div>
                      <button
                        onClick={processSale}
                        disabled={isLoading || (isCustomerPurchase && !selectedCustomer)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium disabled:opacity-50"
                      >
                        {isLoading ? 'جاري المعالجة...' : isCustomerPurchase ? 'إضافة لحساب العميل' : 'إتمام البيع'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Customers Tab */
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">العملاء وديونهم</h3>
                <button
                  onClick={() => setShowNewCustomerModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة عميل</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map(customer => {
                  const customerDebt = unpaidPurchases
                    .filter(p => p.customerId === customer.id)
                    .reduce((sum, p) => sum + p.totalAmount, 0);
                  
                  const customerPurchasesList = unpaidPurchases.filter(p => p.customerId === customer.id);

                  return (
                    <div key={customer.id} className="bg-white border rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{customer.name}</h4>
                          <p className="text-sm text-gray-600">
                            تاريخ الإنشاء: {customer.createdAt.toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                        <button
                          onClick={() => openCustomerDetails(customer)}
                          className="text-blue-600 hover:text-blue-800"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">إجمالي الدين:</span>
                          <span className={`font-semibold ${customerDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {customerDebt.toFixed(2)} جنيه
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">عدد المشتريات غير المدفوعة:</span>
                          <span className="font-semibold text-gray-900">{customerPurchasesList.length}</span>
                        </div>
                      </div>

                      {customerDebt > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs text-gray-500">المنتجات المستحقة:</div>
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {customerPurchasesList.slice(0, 3).map((purchase, index) => (
                              <div key={index} className="text-xs text-gray-600">
                                • {purchase.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                              </div>
                            ))}
                            {customerPurchasesList.length > 3 && (
                              <div className="text-xs text-gray-500">
                                ... و {customerPurchasesList.length - 3} مشتريات أخرى
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => payAllCustomerDebt(customer)}
                            disabled={isLoading || !activeShift}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm disabled:opacity-50 mt-3"
                          >
                            دفع جميع الديون ({customerDebt.toFixed(2)} جنيه)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {customers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">لا يوجد عملاء مسجلين</p>
                  <button
                    onClick={() => setShowNewCustomerModal(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    إضافة أول عميل
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Customer Details Modal */}
      {showCustomerDetailsModal && selectedCustomerDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">تفاصيل ديون العميل: {selectedCustomerDetails.name}</h3>
            
            <div className="space-y-4">
              {customerPurchases.map(purchase => (
                <div key={purchase.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">المبلغ: {purchase.totalAmount.toFixed(2)} جنيه</div>
                      <div className="text-sm text-gray-600">
                        التاريخ: {purchase.timestamp.toLocaleString('ar-EG')}
                      </div>
                    </div>
                    <button
                      onClick={() => openPaymentModal(purchase)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    >
                      دفع
                    </button>
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

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCustomerDetailsModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
              >
                إغلاق
              </button>
              <button
                onClick={() => payAllCustomerDebt(selectedCustomerDetails)}
                disabled={isLoading || customerPurchases.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                دفع جميع الديون
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPurchaseForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">دفع دين العميل</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المدفوع (جنيه)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
                <div className="text-xs text-gray-500 mt-1">
                  إجمالي الدين: {selectedPurchaseForPayment.totalAmount.toFixed(2)} جنيه
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={() => markAsPaid(selectedPurchaseForPayment, parseFloat(paymentAmount))}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                تأكيد الدفع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة مصروف</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  max={currentCash}
                />
                <div className="text-xs text-gray-500 mt-1">
                  الحد الأقصى: {currentCash.toFixed(2)} جنيه
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل سبب المصروف"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={addExpense}
                disabled={!expenseAmount || !expenseReason || parseFloat(expenseAmount) > currentCash}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                إضافة مصروف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditExpenseModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">تعديل المصروف</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  max={currentCash + editingExpense.amount}
                />
                <div className="text-xs text-gray-500 mt-1">
                  الحد الأقصى: {(currentCash + editingExpense.amount).toFixed(2)} جنيه
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل سبب المصروف"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditExpenseModal(false);
                  setEditingExpense(null);
                  setExpenseAmount('');
                  setExpenseReason('');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={editExpense}
                disabled={!expenseAmount || !expenseReason || parseFloat(expenseAmount) > (currentCash + editingExpense.amount)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Money Modal */}
      {showExternalMoneyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة أموال خارجية</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={externalAmount}
                  onChange={(e) => setExternalAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={externalReason}
                  onChange={(e) => setExternalReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="أدخل سبب الأموال الخارجية"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowExternalMoneyModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={addExternalMoney}
                disabled={!externalAmount || !externalReason}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                إضافة أموال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">إغلاق الوردية</h3>
            
            <div className="space-y-6">
              {/* Final Cash */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  عدد النقدية النهائي (جنيه)
                </label>
                <input
                  type="number"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>

              {/* Final Inventory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  عدد المخزون النهائي
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          الحالي: {item.currentAmount}
                        </div>
                      </div>
                      <input
                        type="number"
                        value={finalInventory[item.id] || 0}
                        onChange={(e) => setFinalInventory({
                          ...finalInventory,
                          [item.id]: parseInt(e.target.value) || 0
                        })}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Close Reason - only show if forcing close */}
              {showCloseWithReason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    سبب الإغلاق (مطلوب)
                  </label>
                  <textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="يجب إدخال سبب صالح لإغلاق الوردية مع وجود تضارب..."
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCloseShiftModal(false);
                  setShowCloseWithReason(false);
                  setCloseReason('');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              {!showCloseWithReason ? (
                <button
                  onClick={() => closeShift(false)}
                  disabled={!finalCash}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50"
                >
                  إغلاق الوردية
                </button>
              ) : (
                <button
                  onClick={() => closeShift(true)}
                  disabled={!finalCash || !closeReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
                >
                  إغلاق مع السبب
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة عميل جديد</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="أدخل اسم العميل"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowNewCustomerModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={createCustomer}
                disabled={!newCustomerName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                إضافة عميل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalUserView;