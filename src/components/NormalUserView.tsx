import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, Users, DollarSign, Package, Clock, AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { 
  Item, Customer, CustomerPurchase, Shift, PurchaseItem, 
  Expense, ExternalMoney
} from '../types';
import { v4 as uuidv4 } from 'uuid';

interface NormalUserViewProps {
  section: 'store' | 'supplement';
}

const NormalUserView: React.FC<NormalUserViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pos' | 'customers'>('pos');
  
  // State for data
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  
  // POS state
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddExternalMoney, setShowAddExternalMoney] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  
  // Customer view state
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerPurchases, setSelectedCustomerPurchases] = useState<CustomerPurchase[]>([]);
  
  // Form state
  const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '' });
  const [externalMoneyForm, setExternalMoneyForm] = useState({ amount: '', reason: '' });
  const [closeShiftForm, setCloseShiftForm] = useState({
    finalCash: '',
    finalInventory: {} as Record<string, number>,
    closeReason: ''
  });
  
  const [loading, setLoading] = useState(true);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, customersData, activeShiftData] = await Promise.all([
        db_service.getItemsBySection(section),
        db_service.getCustomersBySection(section),
        db_service.getActiveShift(section)
      ]);

      setItems(itemsData);
      setCustomers(customersData);
      setActiveShift(activeShiftData);

      // Load unpaid customer purchases
      const unpaidPurchases = await db_service.getUnpaidCustomerPurchases(section);
      setCustomerPurchases(unpaidPurchases);

      // Initialize close shift form with current inventory
      if (activeShiftData) {
        const inventoryState: Record<string, number> = {};
        itemsData.forEach(item => {
          inventoryState[item.id] = item.currentAmount;
        });
        setCloseShiftForm(prev => ({ ...prev, finalInventory: inventoryState }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [section]);

  // Real-time updates
  useRealtime((event) => {
    if (event.section && event.section !== section) return;
    
    switch (event.type) {
      case 'ITEM_UPDATED':
      case 'CUSTOMER_UPDATED':
      case 'SHIFT_UPDATED':
        loadData();
        break;
    }
  }, [section]);

  // Shift management
  const startShift = async () => {
    if (activeShift) {
      alert('يوجد وردية نشطة بالفعل');
      return;
    }

    const newShift: Shift = {
      id: uuidv4(),
      userId: user?.id || '',
      username: user?.username || '',
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
  };

  const closeShift = async () => {
    if (!activeShift) return;

    const finalCash = parseFloat(closeShiftForm.finalCash);
    const expectedCash = activeShift.totalAmount - 
      activeShift.expenses.reduce((total, e) => total + e.amount, 0) +
      activeShift.externalMoney.reduce((total, e) => total + e.amount, 0);

    const discrepancies: string[] = [];
    
    // Check cash discrepancy
    if (Math.abs(finalCash - expectedCash) > 0.01) {
      discrepancies.push(`تضارب في النقدية: متوقع ${expectedCash.toFixed(2)} جنيه، موجود ${finalCash.toFixed(2)} جنيه`);
    }

    // Check inventory discrepancies
    for (const [itemId, expectedAmount] of Object.entries(closeShiftForm.finalInventory)) {
      const item = items.find(i => i.id === itemId);
      if (item && item.currentAmount !== expectedAmount) {
        discrepancies.push(`تضارب في ${item.name}: متوقع ${item.currentAmount}، موجود ${expectedAmount}`);
      }
    }

    const updatedShift: Shift = {
      ...activeShift,
      status: 'closed',
      endTime: new Date(),
      finalCash,
      finalInventory: closeShiftForm.finalInventory,
      discrepancies,
      closeReason: closeShiftForm.closeReason,
      validationStatus: discrepancies.length > 0 ? 'discrepancy' : 'balanced'
    };

    await db_service.saveShift(updatedShift);
    setActiveShift(null);
    setShowCloseShift(false);
    setCloseShiftForm({ finalCash: '', finalInventory: {}, closeReason: '' });
  };

  // Cart management
  const addToCart = (item: Item) => {
    if (item.currentAmount <= 0) {
      alert('هذا العنصر غير متوفر في المخزون');
      return;
    }

    const existingItem = cart.find(cartItem => cartItem.itemId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.currentAmount) {
        alert('لا يمكن إضافة المزيد من هذا العنصر');
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
        name: item.name,
        price: item.sellPrice,
        quantity: 1
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
    setSelectedCustomer(null);
  };

  // Purchase processing
  const processPurchase = async (isPaid: boolean = true) => {
    if (!activeShift) {
      alert('يجب بدء وردية أولاً');
      return;
    }

    if (cart.length === 0) {
      alert('السلة فارغة');
      return;
    }

    const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    // Update item quantities
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

    // Create customer purchase if customer is selected
    if (selectedCustomer) {
      const customerPurchase: CustomerPurchase = {
        id: uuidv4(),
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        items: cart,
        totalAmount,
        section,
        shiftId: activeShift.id,
        isPaid,
        timestamp: new Date()
      };

      await db_service.saveCustomerPurchase(customerPurchase);
    }

    // Update shift
    const updatedShift: Shift = {
      ...activeShift,
      purchases: [...activeShift.purchases, ...cart],
      totalAmount: activeShift.totalAmount + (isPaid ? totalAmount : 0)
    };

    await db_service.saveShift(updatedShift);
    setActiveShift(updatedShift);

    clearCart();
    loadData();
    alert(isPaid ? 'تم إتمام البيع بنجاح' : 'تم تسجيل البيع على الحساب');
  };

  // Expense management
  const addExpense = async () => {
    if (!activeShift || !expenseForm.amount || !expenseForm.reason) return;

    const expense: Expense = {
      id: uuidv4(),
      amount: parseFloat(expenseForm.amount),
      reason: expenseForm.reason,
      shiftId: activeShift.id,
      section,
      timestamp: new Date(),
      createdBy: user?.username || 'Unknown'
    };

    await db_service.saveExpense(expense);

    const updatedShift: Shift = {
      ...activeShift,
      expenses: [...activeShift.expenses, expense]
    };

    await db_service.saveShift(updatedShift);
    setActiveShift(updatedShift);

    setExpenseForm({ amount: '', reason: '' });
    setShowAddExpense(false);
    loadData();
  };

  // External money management
  const addExternalMoney = async () => {
    if (!activeShift || !externalMoneyForm.amount || !externalMoneyForm.reason) return;

    const externalMoney: ExternalMoney = {
      id: uuidv4(),
      amount: parseFloat(externalMoneyForm.amount),
      reason: externalMoneyForm.reason,
      shiftId: activeShift.id,
      section,
      timestamp: new Date(),
      createdBy: user?.username || 'Unknown'
    };

    await db_service.saveExternalMoney(externalMoney);

    const updatedShift: Shift = {
      ...activeShift,
      externalMoney: [...activeShift.externalMoney, externalMoney]
    };

    await db_service.saveShift(updatedShift);
    setActiveShift(updatedShift);

    setExternalMoneyForm({ amount: '', reason: '' });
    setShowAddExternalMoney(false);
    loadData();
  };

  // Customer debt payment
  const payCustomerDebt = async (customer: Customer) => {
    const unpaidPurchases = customerPurchases.filter(p => 
      p.customerId === customer.id && !p.isPaid
    );

    if (unpaidPurchases.length === 0) {
      alert('لا يوجد ديون لهذا العميل');
      return;
    }

    const totalDebt = unpaidPurchases.reduce((total, p) => total + p.totalAmount, 0);

    if (!confirm(`هل تريد دفع جميع ديون ${customer.name}؟\nالمبلغ الإجمالي: ${totalDebt.toFixed(2)} جنيه`)) {
      return;
    }

    // Mark all purchases as paid
    for (const purchase of unpaidPurchases) {
      const updatedPurchase = { ...purchase, isPaid: true };
      await db_service.saveCustomerPurchase(updatedPurchase);
    }

    // Add money to active shift if exists
    if (activeShift) {
      const updatedShift: Shift = {
        ...activeShift,
        totalAmount: activeShift.totalAmount + totalDebt
      };
      await db_service.saveShift(updatedShift);
      setActiveShift(updatedShift);
    }

    // Log the payment
    await db_service.logCustomerPayment(
      customer.id,
      customer.name,
      totalDebt,
      unpaidPurchases,
      activeShift?.id || '',
      section
    );

    loadData();
    alert(`تم دفع ${totalDebt.toFixed(2)} جنيه من ديون ${customer.name}`);
  };

  // View customer details
  const handleViewCustomer = async (customer: Customer) => {
    setViewingCustomer(customer);
    const purchases = await db_service.getCustomerPurchases(customer.id);
    setSelectedCustomerPurchases(purchases);
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {section === 'store' ? 'البار' : 'المكملات الغذائية'}
          </h1>
          <div className="flex items-center space-x-4">
            {/* Shift Status */}
            <div className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
              activeShift 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <Clock className="h-4 w-4" />
              <span>{activeShift ? 'وردية نشطة' : 'لا توجد وردية نشطة'}</span>
            </div>

            {/* Shift Controls */}
            {!activeShift ? (
              <button
                onClick={startShift}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                بدء وردية
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Minus className="h-4 w-4" />
                  <span>مصروف</span>
                </button>
                <button
                  onClick={() => setShowAddExternalMoney(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>أموال خارجية</span>
                </button>
                <button
                  onClick={() => setShowCloseShift(true)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  إغلاق الوردية
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Shift Summary */}
        {activeShift && (
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-blue-600">
                {activeShift.totalAmount.toFixed(2)} جنيه
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-700">إجمالي المصروفات</p>
              <p className="text-2xl font-bold text-red-600">
                {activeShift.expenses.reduce((total, e) => total + e.amount, 0).toFixed(2)} جنيه
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-700">الأموال الخارجية</p>
              <p className="text-2xl font-bold text-green-600">
                {activeShift.externalMoney.reduce((total, e) => total + e.amount, 0).toFixed(2)} جنيه
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-700">صافي النقدية</p>
              <p className="text-2xl font-bold text-purple-600">
                {(activeShift.totalAmount - 
                  activeShift.expenses.reduce((total, e) => total + e.amount, 0) +
                  activeShift.externalMoney.reduce((total, e) => total + e.amount, 0)
                ).toFixed(2)} جنيه
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>نقطة البيع</span>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>العملاء</span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* POS Tab */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Items Grid */}
              <div className="lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">المنتجات</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        item.currentAmount <= 0
                          ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                          : 'hover:bg-blue-50 border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => item.currentAmount > 0 && addToCart(item)}
                    >
                      <div className="text-center">
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        <p className="text-lg font-bold text-blue-600 mt-2">
                          {item.sellPrice} جنيه
                        </p>
                        <p className={`text-sm mt-1 ${
                          item.currentAmount <= 5 
                            ? 'text-red-600' 
                            : item.currentAmount <= 10
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}>
                          متوفر: {item.currentAmount}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">السلة</h2>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      مسح الكل
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">السلة فارغة</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.itemId} className="flex justify-between items-center bg-white rounded-lg p-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.price} جنيه × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeFromCart(item.itemId)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => {
                              const dbItem = items.find(i => i.id === item.itemId);
                              if (dbItem && item.quantity < dbItem.currentAmount) {
                                addToCart(dbItem);
                              }
                            }}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>الإجمالي:</span>
                        <span>{cartTotal.toFixed(2)} جنيه</span>
                      </div>
                    </div>

                    {/* Customer Selection */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowCustomerSelect(true)}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
                      >
                        {selectedCustomer ? `العميل: ${selectedCustomer.name}` : 'اختيار عميل (اختياري)'}
                      </button>
                      {selectedCustomer && (
                        <button
                          onClick={() => setSelectedCustomer(null)}
                          className="w-full text-red-600 hover:text-red-800 text-sm"
                        >
                          إلغاء اختيار العميل
                        </button>
                      )}
                    </div>

                    {/* Purchase Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => processPurchase(true)}
                        disabled={!activeShift}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                      >
                        بيع نقدي
                      </button>
                      {selectedCustomer && (
                        <button
                          onClick={() => processPurchase(false)}
                          disabled={!activeShift}
                          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                        >
                          بيع على الحساب
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">العملاء</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        اسم العميل
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        إجمالي الدين
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map(customer => {
                      const customerDebt = customerPurchases
                        .filter(p => p.customerId === customer.id && !p.isPaid)
                        .reduce((total, p) => total + p.totalAmount, 0);

                      return (
                        <tr key={customer.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {customer.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              customerDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {customerDebt.toFixed(2)} جنيه
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleViewCustomer(customer)}
                                className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                              >
                                <Eye className="h-4 w-4" />
                                <span>عرض</span>
                              </button>
                              {customerDebt > 0 && (
                                <button
                                  onClick={() => payCustomerDebt(customer)}
                                  className="text-green-600 hover:text-green-900 flex items-center space-x-1"
                                >
                                  <DollarSign className="h-4 w-4" />
                                  <span>دفع الكل</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* Customer Select Modal */}
      {showCustomerSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">اختيار عميل</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerSelect(false);
                  }}
                  className="w-full text-right px-4 py-2 hover:bg-gray-100 rounded-lg"
                >
                  {customer.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowCustomerSelect(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة مصروف</h3>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="المبلغ"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="السبب"
                value={expenseForm.reason}
                onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddExpense(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={addExpense}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add External Money Modal */}
      {showAddExternalMoney && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">إضافة أموال خارجية</h3>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="المبلغ"
                value={externalMoneyForm.amount}
                onChange={(e) => setExternalMoneyForm({ ...externalMoneyForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="السبب"
                value={externalMoneyForm.reason}
                onChange={(e) => setExternalMoneyForm({ ...externalMoneyForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddExternalMoney(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={addExternalMoney}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShift && activeShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">إغلاق الوردية</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  النقدية النهائية
                </label>
                <input
                  type="number"
                  placeholder="المبلغ النقدي الموجود"
                  value={closeShiftForm.finalCash}
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, finalCash: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  جرد المخزون النهائي
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                      <span>{item.name}</span>
                      <input
                        type="number"
                        value={closeShiftForm.finalInventory[item.id] || item.currentAmount}
                        onChange={(e) => setCloseShiftForm({
                          ...closeShiftForm,
                          finalInventory: {
                            ...closeShiftForm.finalInventory,
                            [item.id]: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-2 py-1 border border-gray-300 rounded"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات الإغلاق
                </label>
                <textarea
                  placeholder="أي ملاحظات أو أسباب للتضارب"
                  value={closeShiftForm.closeReason}
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, closeReason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCloseShift(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={closeShift}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                إغلاق الوردية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Customer Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">تفاصيل العميل: {viewingCustomer.name}</h3>
              <button
                onClick={() => setViewingCustomer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">ملخص الدين</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {selectedCustomerPurchases
                    .filter(p => !p.isPaid)
                    .reduce((total, p) => total + p.totalAmount, 0)
                    .toFixed(2)} جنيه
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        التاريخ
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        العناصر
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المبلغ الإجمالي
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedCustomerPurchases.map(purchase => (
                      <tr key={purchase.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {purchase.timestamp.toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {purchase.items.map(item => (
                            <div key={item.itemId}>
                              {item.name} × {item.quantity}
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {purchase.totalAmount.toFixed(2)} جنيه
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            purchase.isPaid 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {purchase.isPaid ? 'مدفوع' : 'غير مدفوع'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalUserView;