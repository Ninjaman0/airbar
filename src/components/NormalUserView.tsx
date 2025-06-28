import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Users, DollarSign, Package, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
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

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);

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
      alert('Failed to start shift');
    }
  };

  const addToCart = (item: Item) => {
    if (item.currentAmount <= 0) {
      alert('Item is out of stock');
      return;
    }

    const existingItem = cart.find(cartItem => cartItem.itemId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.currentAmount) {
        alert('Cannot add more items than available in stock');
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

      setActiveShift(updatedShift);
      clearCart();
      setSelectedCustomer(null);
      loadItems();
      loadUnpaidPurchases();

      alert(isPaid ? 'Sale completed successfully!' : 'Sale recorded as unpaid debt');
    } catch (err) {
      console.error('Error processing sale:', err);
      alert('Failed to process sale');
    }
  };

  const addExpense = async () => {
    if (!activeShift || !expenseForm.amount || !expenseForm.reason) {
      alert('Please fill in all expense fields');
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
        createdBy: user?.username || 'Unknown'
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
      alert('Failed to add expense');
    }
  };

  const closeShift = async () => {
    if (!activeShift || !closeShiftForm.finalCash) {
      alert('Please enter final cash amount');
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
        discrepancies: Math.abs(discrepancy) >= 0.01 ? [`Cash discrepancy: ${discrepancy.toFixed(2)} EGP`] : []
      };

      await db_service.saveShift(updatedShift);
      setActiveShift(null);
      setShowCloseShiftModal(false);
      setCloseShiftForm({ finalCash: '', closeReason: '' });
    } catch (err) {
      console.error('Error closing shift:', err);
      alert('Failed to close shift');
    }
  };

  const addCustomer = async () => {
    if (!customerForm.name) {
      alert('Please enter customer name');
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
      alert('Failed to add customer');
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
      alert('Failed to mark purchase as paid');
    }
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

  if (!activeShift) {
    return (
      <div className="text-center py-12">
        <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Shift</h3>
        <p className="text-gray-600 mb-6">Start a new shift to begin selling items</p>
        <button
          onClick={startShift}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Shift
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
            <h3 className="text-lg font-medium">Items</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowUnpaidModal(true)}
                className="px-4 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                Unpaid ({unpaidPurchases.length})
              </button>
              <button
                onClick={() => setShowCustomerModal(true)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Add Customer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
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
                <p className="text-blue-600 font-semibold text-sm">{item.sellPrice} EGP</p>
                <p className={`text-xs ${item.currentAmount <= 5 ? 'text-red-600' : 'text-gray-500'}`}>
                  Stock: {item.currentAmount}
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
            <h3 className="text-lg font-medium">Active Shift</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Add Expense
              </button>
              <button
                onClick={() => {
                  setCloseShiftForm({ finalCash: activeShift.totalAmount.toString(), closeReason: '' });
                  setShowCloseShiftModal(true);
                }}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close Shift
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Started:</span>
              <span className="font-medium">{activeShift.startTime.toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Sales:</span>
              <span className="font-medium text-green-600">{activeShift.totalAmount} EGP</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Items Sold:</span>
              <span className="font-medium">{activeShift.purchases.reduce((total, p) => total + p.quantity, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Expenses:</span>
              <span className="font-medium text-red-600">
                {activeShift.expenses.reduce((total, e) => total + e.amount, 0)} EGP
              </span>
            </div>
          </div>
        </div>

        {/* Shopping Cart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Cart</h3>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.itemId} className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.price} EGP each</div>
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
                  <div className="w-16 text-right font-medium">
                    {(item.price * item.quantity).toFixed(2)} EGP
                  </div>
                </div>
              ))}

              <div className="border-t pt-3">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total:</span>
                  <span>{getCartTotal().toFixed(2)} EGP</span>
                </div>
              </div>

              {/* Customer Selection */}
              <div className="border-t pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer (Optional)</label>
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setSelectedCustomer(customer || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Select Customer</option>
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
                  Complete Sale (Paid)
                </button>
                {selectedCustomer && (
                  <button
                    onClick={() => processSale(false)}
                    className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                  >
                    Record as Debt
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add Expense</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
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
                Cancel
              </button>
              <button
                onClick={addExpense}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Close Shift</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Cash Amount (EGP)</label>
                <input
                  type="number"
                  value={closeShiftForm.finalCash}
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, finalCash: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Close Reason (Optional)</label>
                <textarea
                  value={closeShiftForm.closeReason}
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, closeReason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  Expected Cash: {(activeShift?.totalAmount || 0) - (activeShift?.expenses.reduce((total, e) => total + e.amount, 0) || 0)} EGP
                </div>
                {closeShiftForm.finalCash && (
                  <div className="text-sm text-gray-600">
                    Discrepancy: {(parseFloat(closeShiftForm.finalCash) - ((activeShift?.totalAmount || 0) - (activeShift?.expenses.reduce((total, e) => total + e.amount, 0) || 0))).toFixed(2)} EGP
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
                Cancel
              </button>
              <button
                onClick={closeShift}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Close Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add New Customer</h3>
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
                  setCustomerForm({ name: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCustomer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Customer
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
              <h3 className="text-lg font-medium">Unpaid Customer Purchases</h3>
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
                <p>No unpaid purchases</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unpaidPurchases.map((purchase) => (
                  <div key={purchase.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{purchase.customerName}</div>
                        <div className="text-sm text-gray-500">
                          {purchase.timestamp.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-red-600">{purchase.totalAmount} EGP</div>
                        <button
                          onClick={() => markPurchaseAsPaid(purchase)}
                          className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                        >
                          Mark as Paid
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Items: {purchase.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
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