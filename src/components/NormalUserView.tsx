import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Users, DollarSign, Package, Clock, AlertTriangle, CheckCircle, Calculator, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { db_service } from '../services/database';
import { Item, Shift, Customer, CustomerPurchase, Expense, PurchaseItem } from '../types';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    reason: ''
  });
  const [customerForm, setCustomerForm] = useState({
    name: ''
  });
  const [closeShiftForm, setCloseShiftForm] = useState({
    finalCash: '',
    closeReason: ''
  });
  const [calculatorValue, setCalculatorValue] = useState('0');
  const [lastSaleReceipt, setLastSaleReceipt] = useState<any>(null);

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
    }
    if (event.data?.table === 'customer_purchases') {
      loadUnpaidPurchases();
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
        loadUnpaidPurchases()
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

      // Update shift
      const updatedShift: Shift = {
        ...activeShift,
        purchases: [...activeShift.purchases, ...cart],
        totalAmount: activeShift.totalAmount + getCartTotal()
      };
      await db_service.saveShift(updatedShift);

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

      // Store receipt data
      setLastSaleReceipt({
        items: cart,
        total: getCartTotal(),
        customer: selectedCustomer,
        isPaid,
        timestamp: new Date()
      });

      setActiveShift(updatedShift);
      clearCart();
      setSelectedCustomer(null);
      loadItems();
      loadUnpaidPurchases();

      // Show receipt
      setShowReceiptModal(true);

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

  const closeShift = async () => {
    if (!activeShift || !closeShiftForm.finalCash) {
      alert('يرجى إدخال مبلغ النقدية النهائي');
      return;
    }

    try {
      const finalCash = parseFloat(closeShiftForm.finalCash);
      const expectedCash = activeShift.totalAmount - activeShift.expenses.reduce((total, exp) => total + exp.amount, 0);
      const discrepancy = finalCash - expectedCash;

      const updatedShift: Shift = {
        ...activeShift,
        status: 'closed',
        endTime: new Date(),
        finalCash,
        closeReason: closeShiftForm.closeReason || undefined,
        validationStatus: Math.abs(discrepancy) < 0.01 ? 'balanced' : 'discrepancy',
        discrepancies: Math.abs(discrepancy) >= 0.01 ? [`تناقض في النقدية: ${discrepancy.toFixed(2)} جنيه`] : []
      };

      await db_service.saveShift(updatedShift);
      setActiveShift(null);
      setShowCloseShiftModal(false);
      setCloseShiftForm({ finalCash: '', closeReason: '' });
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

  const markPurchaseAsPaid = async (purchase: CustomerPurchase) => {
    try {
      const updatedPurchase: CustomerPurchase = {
        ...purchase,
        isPaid: true
      };

      await db_service.saveCustomerPurchase(updatedPurchase);
      loadUnpaidPurchases();
    } catch (err) {
      console.error('Error marking purchase as paid:', err);
      alert('فشل في تحديد المشتريات كمدفوعة');
    }
  };

  const handleCalculatorInput = (value: string) => {
    if (value === 'C') {
      setCalculatorValue('0');
    } else if (value === '=') {
      try {
        const result = eval(calculatorValue);
        setCalculatorValue(result.toString());
      } catch {
        setCalculatorValue('خطأ');
      }
    } else if (calculatorValue === '0' && !isNaN(Number(value))) {
      setCalculatorValue(value);
    } else {
      setCalculatorValue(calculatorValue + value);
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

  if (!activeShift) {
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Items Grid */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">المنتجات</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCalculatorModal(true)}
                className="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <Calculator className="h-4 w-4 inline mr-1" />
                آلة حاسبة
              </button>
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
                onClick={() => {
                  setCloseShiftForm({ finalCash: activeShift.totalAmount.toString(), closeReason: '' });
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
          </div>
        </div>

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

      {/* All modals with Arabic translations... */}
      {/* Calculator Modal */}
      {showCalculatorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">آلة حاسبة</h3>
              <button
                onClick={() => setShowCalculatorModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <div className="text-right text-xl font-mono">{calculatorValue}</div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {['C', '/', '*', '-', '7', '8', '9', '+', '4', '5', '6', '+', '1', '2', '3', '=', '0', '0', '.', '='].map((btn, index) => (
                <button
                  key={index}
                  onClick={() => handleCalculatorInput(btn)}
                  className={`p-3 rounded-lg font-medium ${
                    ['C', '/', '*', '-', '+', '='].includes(btn)
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } transition-colors`}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && lastSaleReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">إيصال البيع</h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 p-4 space-y-2">
              <div className="text-center font-bold">AIR BAR</div>
              <div className="text-center text-sm text-gray-600">
                {section === 'store' ? 'البار' : 'المكملات الغذائية'}
              </div>
              <div className="border-t border-gray-300 pt-2">
                <div className="text-sm text-gray-600">
                  التاريخ: {lastSaleReceipt.timestamp.toLocaleString('ar-EG')}
                </div>
                {lastSaleReceipt.customer && (
                  <div className="text-sm text-gray-600">
                    العميل: {lastSaleReceipt.customer.name}
                  </div>
                )}
              </div>
              
              <div className="border-t border-gray-300 pt-2">
                {lastSaleReceipt.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{(item.price * item.quantity).toFixed(2)} جنيه</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-300 pt-2">
                <div className="flex justify-between font-bold">
                  <span>الإجمالي:</span>
                  <span>{lastSaleReceipt.total.toFixed(2)} جنيه</span>
                </div>
                <div className="text-sm text-gray-600">
                  الحالة: {lastSaleReceipt.isPaid ? 'مدفوع' : 'دين'}
                </div>
              </div>
              
              <div className="text-center text-xs text-gray-500 pt-2">
                شكراً لزيارتكم
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">سبب الإغلاق (اختياري)</label>
                <textarea
                  value={closeShiftForm.closeReason}
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, closeReason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  النقدية المتوقعة: {(activeShift?.totalAmount || 0) - (activeShift?.expenses.reduce((total, e) => total + e.amount, 0) || 0)} جنيه
                </div>
                {closeShiftForm.finalCash && (
                  <div className="text-sm text-gray-600">
                    التناقض: {(parseFloat(closeShiftForm.finalCash) - ((activeShift?.totalAmount || 0) - (activeShift?.expenses.reduce((total, e) => total + e.amount, 0) || 0))).toFixed(2)} جنيه
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCloseShiftModal(false);
                  setCloseShiftForm({ finalCash: '', closeReason: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={closeShift}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                إغلاق الوردية
              </button>
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
                        <button
                          onClick={() => markPurchaseAsPaid(purchase)}
                          className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                        >
                          تحديد كمدفوع
                        </button>
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