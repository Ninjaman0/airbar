import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Users, DollarSign, Package, Clock, AlertTriangle, CheckCircle, Receipt, Edit, Trash2, PlusCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { Item, Shift, Customer, CustomerPurchase, Expense, PurchaseItem, ExternalMoney, CustomerDebt } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface NormalUserViewProps {
  section: 'store' | 'supplement';
}

const NormalUserView: React.FC<NormalUserViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [unpaidPurchases, setUnpaidPurchases] = useState<CustomerPurchase[]>([]);
  const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'pos' | 'customers'>('pos');

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showExternalMoneyModal, setShowExternalMoneyModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);
  const [showCustomerDebtModal, setShowCustomerDebtModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [showEditExternalMoneyModal, setShowEditExternalMoneyModal] = useState(false);
  const [showCustomerPaymentModal, setShowCustomerPaymentModal] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    reason: ''
  });
  const [externalMoneyForm, setExternalMoneyForm] = useState({
    amount: '',
    reason: ''
  });
  const [customerForm, setCustomerForm] = useState({
    name: ''
  });
  const [closeShiftForm, setCloseShiftForm] = useState({
    finalCash: '',
    finalInventory: {} as Record<string, number>,
    closeReason: ''
  });
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingExternalMoney, setEditingExternalMoney] = useState<ExternalMoney | null>(null);
  const [selectedCustomerDebt, setSelectedCustomerDebt] = useState<CustomerDebt | null>(null);
  const [customPaymentAmount, setCustomPaymentAmount] = useState('');
  const [showCloseWithReason, setShowCloseWithReason] = useState(false);

  // Real-time updates
  useRealtime((event) => {
    if (event.data?.table === 'items' || event.type === 'ITEM_UPDATED') {
      loadItems();
    }
    if (event.data?.table === 'shifts' || event.type === 'SHIFT_UPDATED') {
      loadActiveShift();
    }
    if (event.data?.table === 'customers' || event.type === 'CUSTOMER_UPDATED') {
      loadCustomers();
      loadUnpaidPurchases();
      loadCustomerDebts();
    }
    if (event.data?.table === 'customer_purchases') {
      loadUnpaidPurchases();
      loadCustomerDebts();
    }
    if (event.data?.table === 'expenses' || event.data?.table === 'external_money') {
      loadActiveShift();
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
        loadCustomers(),
        loadActiveShift(),
        loadUnpaidPurchases(),
        loadCustomerDebts()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
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

  const loadCustomers = async () => {
    try {
      const data = await db_service.getCustomersBySection(section);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadActiveShift = async () => {
    try {
      const shift = await db_service.getActiveShift(section);
      setActiveShift(shift);
      if (shift) {
        // Initialize final inventory form with current item amounts
        const inventory: Record<string, number> = {};
        items.forEach(item => {
          inventory[item.id] = item.currentAmount;
        });
        setCloseShiftForm(prev => ({
          ...prev,
          finalInventory: inventory,
          finalCash: shift.totalAmount.toString()
        }));
      }
    } catch (err) {
      console.error('Error loading active shift:', err);
    }
  };

  const loadUnpaidPurchases = async () => {
    try {
      const data = await db_service.getUnpaidCustomerPurchases(section);
      setUnpaidPurchases(data);
    } catch (err) {
      console.error('Error loading unpaid purchases:', err);
    }
  };

  const loadCustomerDebts = async () => {
    try {
      const unpaid = await db_service.getUnpaidCustomerPurchases(section);
      const debtsMap: Record<string, CustomerDebt> = {};

      unpaid.forEach(purchase => {
        if (!debtsMap[purchase.customerId]) {
          debtsMap[purchase.customerId] = {
            customerId: purchase.customerId,
            customerName: purchase.customerName,
            totalAmount: 0,
            totalCost: 0,
            totalProfit: 0,
            items: []
          };
        }

        const debt = debtsMap[purchase.customerId];
        debt.totalAmount += purchase.totalAmount;
        debt.items.push(purchase);

        // Calculate cost and profit
        purchase.items.forEach(item => {
          const itemData = items.find(i => i.id === item.itemId);
          if (itemData) {
            const cost = itemData.costPrice * item.quantity;
            debt.totalCost += cost;
            debt.totalProfit += (item.price * item.quantity) - cost;
          }
        });
      });

      setCustomerDebts(Object.values(debtsMap));
    } catch (err) {
      console.error('Error loading customer debts:', err);
    }
  };

  const startShift = async () => {
    if (!user) return;

    try {
      const newShift: Shift = {
        id: uuidv4(),
        userId: user.id,
        username: user.username,
        section,
        status: 'active',
        purchases: [],
        expenses: [],
        externalMoney: [],
        totalAmount: 0,
        startTime: new Date(),
        validationStatus: 'balanced'
      };

      await db_service.saveShift(newShift);
      setActiveShift(newShift);
    } catch (err) {
      console.error('Error starting shift:', err);
      alert('فشل في بدء الوردية');
    }
  };

  const addToCart = (item: Item) => {
    if (item.currentAmount <= 0) {
      alert('المنتج غير متوفر في المخزون');
      return;
    }

    const existingItem = cart.find(cartItem => cartItem.itemId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.currentAmount) {
        alert('لا يمكن إضافة كمية أكبر من المتوفر في المخزون');
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
  };

  const removeFromCart = (itemId: string) => {
    const existingItem = cart.find(cartItem => cartItem.itemId === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(cartItem =>
        cartItem.itemId === itemId
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      ));
    } else {
      setCart(cart.filter(cartItem => cartItem.itemId !== itemId));
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const processSale = async (isPaid: boolean = true) => {
    if (!activeShift || cart.length === 0) return;

    try {
      // Update inventory
      for (const cartItem of cart) {
        const item = items.find(i => i.id === cartItem.itemId);
        if (item) {
          const updatedItem: Item = {
            ...item,
            currentAmount: item.currentAmount - cartItem.quantity,
            updatedAt: new Date()
          };
          await db_service.saveItem(updatedItem);
        }
      }

      // If customer selected and not paid, create customer purchase record
      if (selectedCustomer && !isPaid) {
        const customerPurchase: CustomerPurchase = {
          id: uuidv4(),
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          items: cart,
          totalAmount: getCartTotal(),
          section,
          shiftId: activeShift.id,
          isPaid: false,
          timestamp: new Date()
        };
        await db_service.saveCustomerPurchase(customerPurchase);
      }

      // Update shift - only add to cash if paid
      const updatedShift: Shift = {
        ...activeShift,
        purchases: [...activeShift.purchases, ...cart],
        totalAmount: isPaid ? activeShift.totalAmount + getCartTotal() : activeShift.totalAmount
      };
      await db_service.saveShift(updatedShift);

      setActiveShift(updatedShift);
      clearCart();
      setSelectedCustomer(null);
      loadItems();
      loadUnpaidPurchases();
      loadCustomerDebts();

      alert(isPaid ? 'تم إتمام البيع بنجاح!' : 'تم تسجيل البيع كدين غير مدفوع');
    } catch (err) {
      console.error('Error processing sale:', err);
      alert('فشل في معالجة البيع');
    }
  };

  const addExpense = async () => {
    if (!activeShift || !expenseForm.amount || !expenseForm.reason) {
      alert('يرجى ملء جميع حقول المصروفات');
      return;
    }

    try {
      const expense: Expense = {
        id: uuidv4(),
        amount: parseFloat(expenseForm.amount),
        reason: expenseForm.reason,
        shiftId: activeShift.id,
        section,
        timestamp: new Date(),
        createdBy: user?.username || 'غير معروف'
      };

      await db_service.saveExpense(expense);

      // Update shift
      const updatedShift: Shift = {
        ...activeShift,
        expenses: [...activeShift.expenses, expense]
      };
      await db_service.saveShift(updatedShift);

      setActiveShift(updatedShift);
      setShowExpenseModal(false);
      setExpenseForm({ amount: '', reason: '' });
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('فشل في إضافة المصروف');
    }
  };

  const addExternalMoney = async () => {
    if (!activeShift || !externalMoneyForm.amount || !externalMoneyForm.reason) {
      alert('يرجى ملء جميع حقول الأموال الخارجية');
      return;
    }

    try {
      const externalMoney: ExternalMoney = {
        id: uuidv4(),
        amount: parseFloat(externalMoneyForm.amount),
        reason: externalMoneyForm.reason,
        shiftId: activeShift.id,
        section,
        timestamp: new Date(),
        createdBy: user?.username || 'غير معروف'
      };

      await db_service.saveExternalMoney(externalMoney);

      // Update shift
      const updatedShift: Shift = {
        ...activeShift,
        externalMoney: [...(activeShift.externalMoney || []), externalMoney],
        totalAmount: activeShift.totalAmount + parseFloat(externalMoneyForm.amount)
      };
      await db_service.saveShift(updatedShift);

      setActiveShift(updatedShift);
      setShowExternalMoneyModal(false);
      setExternalMoneyForm({ amount: '', reason: '' });
    } catch (err) {
      console.error('Error adding external money:', err);
      alert('فشل في إضافة الأموال الخارجية');
    }
  };

  const editExpense = async () => {
    if (!editingExpense || !expenseForm.amount || !expenseForm.reason) {
      alert('يرجى ملء جميع الحقول');
      return;
    }

    try {
      const updatedExpense: Expense = {
        ...editingExpense,
        amount: parseFloat(expenseForm.amount),
        reason: expenseForm.reason
      };

      await db_service.saveExpense(updatedExpense);
      loadActiveShift();
      setShowEditExpenseModal(false);
      setEditingExpense(null);
      setExpenseForm({ amount: '', reason: '' });
    } catch (err) {
      console.error('Error editing expense:', err);
      alert('فشل في تعديل المصروف');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
      await db_service.deleteExpense(expenseId);
      loadActiveShift();
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('فشل في حذف المصروف');
    }
  };

  const editExternalMoney = async () => {
    if (!editingExternalMoney || !externalMoneyForm.amount || !externalMoneyForm.reason) {
      alert('يرجى ملء جميع الحقول');
      return;
    }

    try {
      const updatedExternalMoney: ExternalMoney = {
        ...editingExternalMoney,
        amount: parseFloat(externalMoneyForm.amount),
        reason: externalMoneyForm.reason
      };

      await db_service.saveExternalMoney(updatedExternalMoney);
      loadActiveShift();
      setShowEditExternalMoneyModal(false);
      setEditingExternalMoney(null);
      setExternalMoneyForm({ amount: '', reason: '' });
    } catch (err) {
      console.error('Error editing external money:', err);
      alert('فشل في تعديل الأموال الخارجية');
    }
  };

  const deleteExternalMoney = async (externalMoneyId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الأموال الخارجية؟')) return;

    try {
      await db_service.deleteExternalMoney(externalMoneyId);
      loadActiveShift();
    } catch (err) {
      console.error('Error deleting external money:', err);
      alert('فشل في حذف الأموال الخارجية');
    }
  };

  const validateShiftClose = () => {
    if (!activeShift) return false;

    const expectedCash = activeShift.totalAmount - activeShift.expenses.reduce((total, exp) => total + exp.amount, 0);
    const actualCash = parseFloat(closeShiftForm.finalCash);
    const cashDiscrepancy = Math.abs(actualCash - expectedCash) >= 0.01;

    let inventoryDiscrepancy = false;
    for (const item of items) {
      const expectedAmount = item.currentAmount;
      const actualAmount = closeShiftForm.finalInventory[item.id] || 0;
      if (expectedAmount !== actualAmount) {
        inventoryDiscrepancy = true;
        break;
      }
    }

    return cashDiscrepancy || inventoryDiscrepancy;
  };

  const closeShift = async (withReason: boolean = false) => {
    if (!activeShift || !closeShiftForm.finalCash) {
      alert('يرجى إدخال مبلغ النقدية النهائي');
      return;
    }

    if (!withReason && validateShiftClose()) {
      setShowCloseWithReason(true);
      return;
    }

    if (withReason && !closeShiftForm.closeReason) {
      alert('يرجى إدخال سبب الإغلاق');
      return;
    }

    try {
      const finalCash = parseFloat(closeShiftForm.finalCash);
      const expectedCash = activeShift.totalAmount - activeShift.expenses.reduce((total, exp) => total + exp.amount, 0);
      const discrepancies: string[] = [];

      // Check cash discrepancy
      const cashDiscrepancy = finalCash - expectedCash;
      if (Math.abs(cashDiscrepancy) >= 0.01) {
        discrepancies.push(`تناقض في النقدية: ${cashDiscrepancy.toFixed(2)} جنيه`);
      }

      // Check inventory discrepancies
      for (const item of items) {
        const expectedAmount = item.currentAmount;
        const actualAmount = closeShiftForm.finalInventory[item.id] || 0;
        if (expectedAmount !== actualAmount) {
          discrepancies.push(`تناقض في المخزون - ${item.name}: متوقع ${expectedAmount}، فعلي ${actualAmount}`);
        }
      }

      const updatedShift: Shift = {
        ...activeShift,
        status: 'closed',
        endTime: new Date(),
        finalCash,
        finalInventory: closeShiftForm.finalInventory,
        closeReason: closeShiftForm.closeReason || undefined,
        validationStatus: discrepancies.length > 0 ? 'discrepancy' : 'balanced',
        discrepancies
      };

      await db_service.saveShift(updatedShift);
      setActiveShift(null);
      setShowCloseShiftModal(false);
      setShowCloseWithReason(false);
      setCloseShiftForm({ finalCash: '', finalInventory: {}, closeReason: '' });
    } catch (err) {
      console.error('Error closing shift:', err);
      alert('فشل في إغلاق الوردية');
    }
  };

  const addCustomer = async () => {
    if (!customerForm.name) {
      alert('يرجى إدخال اسم العميل');
      return;
    }

    try {
      const customer: Customer = {
        id: uuidv4(),
        name: customerForm.name,
        section,
        createdAt: new Date()
      };

      await db_service.saveCustomer(customer);
      setShowCustomerModal(false);
      setCustomerForm({ name: '' });
      loadCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      alert('فشل في إضافة العميل');
    }
  };

  const payCustomerDebt = async (customerId: string, amount: number, isFullPayment: boolean = false) => {
    if (!activeShift) {
      alert('لا توجد وردية نشطة');
      return;
    }

    try {
      const customerDebt = customerDebts.find(d => d.customerId === customerId);
      if (!customerDebt) return;

      let remainingAmount = amount;
      const updatedPurchases: CustomerPurchase[] = [];

      // Pay off purchases starting from oldest
      for (const purchase of customerDebt.items) {
        if (remainingAmount <= 0) break;

        if (remainingAmount >= purchase.totalAmount) {
          // Pay full purchase
          remainingAmount -= purchase.totalAmount;
          const updatedPurchase: CustomerPurchase = {
            ...purchase,
            isPaid: true
          };
          await db_service.saveCustomerPurchase(updatedPurchase);
          updatedPurchases.push(updatedPurchase);
        } else if (isFullPayment) {
          // Partial payment for full payment option
          const updatedPurchase: CustomerPurchase = {
            ...purchase,
            totalAmount: purchase.totalAmount - remainingAmount,
            isPaid: false
          };
          await db_service.saveCustomerPurchase(updatedPurchase);
          remainingAmount = 0;
        }
      }

      // Add payment to current shift
      const updatedShift: Shift = {
        ...activeShift,
        totalAmount: activeShift.totalAmount + amount
      };
      await db_service.saveShift(updatedShift);

      // Log customer payment
      await db_service.logCustomerPayment(customerId, customerDebt.customerName, amount, updatedPurchases, activeShift.id, section);

      setActiveShift(updatedShift);
      loadCustomerDebts();
      setShowCustomerPaymentModal(false);
      setCustomPaymentAmount('');
      alert('تم تسجيل الدفع بنجاح');
    } catch (err) {
      console.error('Error processing customer payment:', err);
      alert('فشل في معالجة الدفع');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(items.filter(item => item.categoryId).map(item => item.categoryId))];

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

  if (!activeShift && currentTab === 'pos') {
    return (
      <div className="text-center py-12">
        <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد وردية نشطة</h3>
        <p className="text-gray-600 mb-6">ابدأ وردية جديدة لبدء بيع المنتجات</p>
        <button
          onClick={startShift}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          بدء الوردية
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setCurrentTab('pos')}
          className={`px-4 py-2 font-medium ${
            currentTab === 'pos'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          نقطة البيع
        </button>
        <button
          onClick={() => setCurrentTab('customers')}
          className={`px-4 py-2 font-medium ${
            currentTab === 'customers'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          العملاء
        </button>
      </div>

      {currentTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items Grid */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">المنتجات</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowUnpaidModal(true)}
                    className="px-4 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                  >
                    غير مدفوع ({unpaidPurchases.length})
                  </button>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    إضافة عميل
                  </button>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="flex space-x-4 mb-4">
                <input
                  type="text"
                  placeholder="البحث عن منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">جميع الفئات</option>
                  {categories.map((categoryId) => {
                    const category = items.find(item => item.categoryId === categoryId);
                    return (
                      <option key={categoryId} value={categoryId}>
                        {category?.categoryId}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                      item.currentAmount <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300'
                    }`}
                    onClick={() => item.currentAmount > 0 && addToCart(item)}
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                    )}
                    <h4 className="font-medium text-sm mb-1">{item.name}</h4>
                    <p className="text-blue-600 font-semibold text-sm">{item.sellPrice} جنيه</p>
                    <p className={`text-xs ${item.currentAmount <= 5 ? 'text-red-600' : 'text-gray-500'}`}>
                      المخزون: {item.currentAmount}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart and Shift Info */}
          <div className="space-y-6">
            {/* Active Shift Info */}
            {activeShift && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">الوردية النشطة</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      إضافة مصروف
                    </button>
                    <button
                      onClick={() => setShowExternalMoneyModal(true)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      إضافة أموال
                    </button>
                    <button
                      onClick={() => {
                        const inventory: Record<string, number> = {};
                        items.forEach(item => {
                          inventory[item.id] = item.currentAmount;
                        });
                        setCloseShiftForm({ 
                          finalCash: activeShift.totalAmount.toString(), 
                          finalInventory: inventory,
                          closeReason: '' 
                        });
                        setShowCloseShiftModal(true);
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      إغلاق الوردية
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">بدأت في:</span>
                    <span className="font-medium">{activeShift.startTime.toLocaleTimeString('ar-EG')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي المبيعات:</span>
                    <span className="font-medium text-green-600">{activeShift.totalAmount} جنيه</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المنتجات المباعة:</span>
                    <span className="font-medium">{activeShift.purchases.reduce((total, p) => total + p.quantity, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المصروفات:</span>
                    <span className="font-medium text-red-600">
                      {activeShift.expenses.reduce((total, e) => total + e.amount, 0)} جنيه
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الأموال الخارجية:</span>
                    <span className="font-medium text-blue-600">
                      {(activeShift.externalMoney || []).reduce((total, e) => total + e.amount, 0)} جنيه
                    </span>
                  </div>
                </div>

                {/* Expenses List */}
                {activeShift.expenses.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">المصروفات:</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {activeShift.expenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center text-sm bg-red-50 p-2 rounded">
                          <div>
                            <div className="font-medium">{expense.reason}</div>
                            <div className="text-gray-500">{expense.amount} جنيه</div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setEditingExpense(expense);
                                setExpenseForm({
                                  amount: expense.amount.toString(),
                                  reason: expense.reason
                                });
                                setShowEditExpenseModal(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* External Money List */}
                {(activeShift.externalMoney || []).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">الأموال الخارجية:</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {(activeShift.externalMoney || []).map((money) => (
                        <div key={money.id} className="flex justify-between items-center text-sm bg-green-50 p-2 rounded">
                          <div>
                            <div className="font-medium">{money.reason}</div>
                            <div className="text-gray-500">{money.amount} جنيه</div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setEditingExternalMoney(money);
                                setExternalMoneyForm({
                                  amount: money.amount.toString(),
                                  reason: money.reason
                                });
                                setShowEditExternalMoneyModal(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteExternalMoney(money.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
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
            )}

            {/* Shopping Cart */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">سلة التسوق</h3>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    مسح
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>السلة فارغة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.itemId} className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.price} جنيه للقطعة</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => removeFromCart(item.itemId)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => {
                            const itemData = items.find(i => i.id === item.itemId);
                            if (itemData) addToCart(itemData);
                          }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="w-16 text-left font-medium">
                        {(item.price * item.quantity).toFixed(2)} جنيه
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center font-semibold">
                      <span>الإجمالي:</span>
                      <span>{getCartTotal().toFixed(2)} جنيه</span>
                    </div>
                  </div>

                  {/* Customer Selection */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">العميل (اختياري)</label>
                    <select
                      value={selectedCustomer?.id || ''}
                      onChange={(e) => {
                        const customer = customers.find(c => c.id === e.target.value);
                        setSelectedCustomer(customer || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">اختر عميل</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => processSale(true)}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      إتمام البيع (مدفوع)
                    </button>
                    {selectedCustomer && (
                      <button
                        onClick={() => processSale(false)}
                        className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                      >
                        تسجيل كدين
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Customers Tab */
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">العملاء والديون</h3>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              إضافة عميل جديد
            </button>
          </div>

          {customerDebts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد ديون للعملاء</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customerDebts.map((debt) => (
                <div key={debt.customerId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-lg">{debt.customerName}</h4>
                      <p className="text-sm text-gray-500">{debt.items.length} مشتريات غير مدفوعة</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{debt.totalAmount.toFixed(2)} جنيه</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedCustomerDebt(debt);
                        setShowCustomerDebtModal(true);
                      }}
                      className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                      عرض التفاصيل
                    </button>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedCustomerDebt(debt);
                          setShowCustomerPaymentModal(true);
                        }}
                        className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                      >
                        دفع مخصص
                      </button>
                      <button
                        onClick={() => payCustomerDebt(debt.customerId, debt.totalAmount, true)}
                        className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
                      >
                        دفع الكل
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Modals */}
      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">إضافة مصروف</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={expenseForm.reason}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setExpenseForm({ amount: '', reason: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={addExpense}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                إضافة مصروف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Money Modal */}
      {showExternalMoneyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">إضافة أموال خارجية</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={externalMoneyForm.amount}
                  onChange={(e) => setExternalMoneyForm({ ...externalMoneyForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={externalMoneyForm.reason}
                  onChange={(e) => setExternalMoneyForm({ ...externalMoneyForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowExternalMoneyModal(false);
                  setExternalMoneyForm({ amount: '', reason: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={addExternalMoney}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                إضافة أموال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">تعديل مصروف</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={expenseForm.reason}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditExpenseModal(false);
                  setEditingExpense(null);
                  setExpenseForm({ amount: '', reason: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={editExpense}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit External Money Modal */}
      {showEditExternalMoneyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">تعديل أموال خارجية</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (جنيه)</label>
                <input
                  type="number"
                  value={externalMoneyForm.amount}
                  onChange={(e) => setExternalMoneyForm({ ...externalMoneyForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                <input
                  type="text"
                  value={externalMoneyForm.reason}
                  onChange={(e) => setExternalMoneyForm({ ...externalMoneyForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditExternalMoneyModal(false);
                  setEditingExternalMoney(null);
                  setExternalMoneyForm({ amount: '', reason: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={editExternalMoney}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">إغلاق الوردية</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ النقدية النهائي (جنيه)</label>
                <input
                  type="number"
                  value={closeShiftForm.finalCash}
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, finalCash: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <h4 className="font-medium mb-2">جرد المخزون النهائي:</h4>
                <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">{item.name}</span>
                      <input
                        type="number"
                        value={closeShiftForm.finalInventory[item.id] || 0}
                        onChange={(e) => setCloseShiftForm({
                          ...closeShiftForm,
                          finalInventory: {
                            ...closeShiftForm.finalInventory,
                            [item.id]: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {showCloseWithReason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سبب التناقض (مطلوب)</label>
                  <textarea
                    value={closeShiftForm.closeReason}
                    onChange={(e) => setCloseShiftForm({ ...closeShiftForm, closeReason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="اشرح سبب التناقض في النقدية أو المخزون..."
                  />
                </div>
              )}

              {activeShift && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">
                    النقدية المتوقعة: {(activeShift.totalAmount - activeShift.expenses.reduce((total, e) => total + e.amount, 0)).toFixed(2)} جنيه
                  </div>
                  {closeShiftForm.finalCash && (
                    <div className="text-sm text-gray-600">
                      التناقض: {(parseFloat(closeShiftForm.finalCash) - (activeShift.totalAmount - activeShift.expenses.reduce((total, e) => total + e.amount, 0))).toFixed(2)} جنيه
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCloseShiftModal(false);
                  setShowCloseWithReason(false);
                  setCloseShiftForm({ finalCash: '', finalInventory: {}, closeReason: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              {showCloseWithReason ? (
                <button
                  onClick={() => closeShift(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  إغلاق مع السبب
                </button>
              ) : (
                <button
                  onClick={() => closeShift(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  إغلاق الوردية
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">إضافة عميل جديد</h3>
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
                  setCustomerForm({ name: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={addCustomer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                إضافة عميل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Debt Details Modal */}
      {showCustomerDebtModal && selectedCustomerDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">تفاصيل ديون {selectedCustomerDebt.customerName}</h3>
              <button
                onClick={() => setShowCustomerDebtModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">إجمالي الدين:</span>
                  <span className="font-semibold text-red-600 ml-2">{selectedCustomerDebt.totalAmount.toFixed(2)} جنيه</span>
                </div>
                <div>
                  <span className="text-gray-600">عدد المشتريات:</span>
                  <span className="font-semibold ml-2">{selectedCustomerDebt.items.length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {selectedCustomerDebt.items.map((purchase) => (
                <div key={purchase.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-gray-500">
                      {purchase.timestamp.toLocaleString('ar-EG')}
                    </div>
                    <div className="font-semibold text-red-600">
                      {purchase.totalAmount.toFixed(2)} جنيه
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium mb-1">المنتجات:</div>
                    {purchase.items.map((item, index) => (
                      <div key={index} className="text-gray-600">
                        {item.name} × {item.quantity} = {(item.price * item.quantity).toFixed(2)} جنيه
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Payment Modal */}
      {showCustomerPaymentModal && selectedCustomerDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">دفع مخصص - {selectedCustomerDebt.customerName}</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">إجمالي الدين:</div>
              <div className="font-semibold text-red-600">{selectedCustomerDebt.totalAmount.toFixed(2)} جنيه</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المدفوع (جنيه)</label>
                <input
                  type="number"
                  value={customPaymentAmount}
                  onChange={(e) => setCustomPaymentAmount(e.target.value)}
                  max={selectedCustomerDebt.totalAmount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCustomerPaymentModal(false);
                  setCustomPaymentAmount('');
                  setSelectedCustomerDebt(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  const amount = parseFloat(customPaymentAmount);
                  if (amount > 0 && amount <= selectedCustomerDebt.totalAmount) {
                    payCustomerDebt(selectedCustomerDebt.customerId, amount);
                  } else {
                    alert('يرجى إدخال مبلغ صحيح');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                تأكيد الدفع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpaid Purchases Modal */}
      {showUnpaidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">مشتريات العملاء غير المدفوعة</h3>
              <button
                onClick={() => setShowUnpaidModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            {unpaidPurchases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد مشتريات غير مدفوعة</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unpaidPurchases.map((purchase) => (
                  <div key={purchase.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{purchase.customerName}</div>
                        <div className="text-sm text-gray-500">
                          {purchase.timestamp.toLocaleString('ar-EG')}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-red-600">{purchase.totalAmount} جنيه</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      المنتجات: {purchase.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalUserView;