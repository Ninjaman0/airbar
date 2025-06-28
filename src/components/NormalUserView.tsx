import React, { useState, useEffect } from 'react';
import { Plus, Package, Users, DollarSign, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
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
  const [newCustomerName, setNewCustomerName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [externalAmount, setExternalAmount] = useState('');
  const [externalReason, setExternalReason] = useState('');
  const [finalInventory, setFinalInventory] = useState<Record<string, number>>({});
  const [finalCash, setFinalCash] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentCash, setCurrentCash] = useState(0);

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

      // Initialize final inventory with zeros
      const inventoryMap: Record<string, number> = {};
      itemsData.forEach(item => {
        inventoryMap[item.id] = 0;
      });
      setFinalInventory(inventoryMap);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    }
  };

  // Real-time updates
  useRealtime((event) => {
    if (event.section === section || !event.section) {
      switch (event.type) {
        case 'ITEM_UPDATED':
          loadData();
          break;
        case 'SHIFT_UPDATED':
          loadData();
          break;
        case 'CUSTOMER_UPDATED':
          loadData();
          break;
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
          reason: 'Carried over from previous shift',
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
      console.error('Error starting shift:', error);
      setError('Failed to start shift');
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: Item) => {
    if (item.currentAmount <= 0) {
      setError('Item is out of stock');
      return;
    }

    const existingItem = cart.find(cartItem => cartItem.itemId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.currentAmount) {
        setError('Cannot add more than available stock');
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
      setError('Cannot exceed available stock');
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
        setError('Please select a customer');
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
      console.error('Error processing sale:', error);
      setError('Failed to process sale');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsPaid = async (purchase: CustomerPurchase) => {
    if (!activeShift) return;

    try {
      setIsLoading(true);

      // Mark purchase as paid
      const updatedPurchase = { ...purchase, isPaid: true };
      await db_service.saveCustomerPurchase(updatedPurchase);

      // Add to shift purchases and update cash
      const updatedShift = {
        ...activeShift,
        purchases: [...activeShift.purchases, ...purchase.items],
        totalAmount: activeShift.totalAmount + purchase.totalAmount
      };

      await db_service.saveShift(updatedShift);
      await loadData();
    } catch (error) {
      console.error('Error marking as paid:', error);
      setError('Failed to mark as paid');
    } finally {
      setIsLoading(false);
    }
  };

  const addExpense = async () => {
    if (!activeShift || !expenseAmount || !expenseReason) return;

    const amount = parseFloat(expenseAmount);
    if (amount > currentCash) {
      setError('Expense cannot exceed current cash amount');
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

      const updatedShift = {
        ...activeShift,
        expenses: [...activeShift.expenses, expense],
        totalAmount: activeShift.totalAmount - amount
      };

      await db_service.saveShift(updatedShift);

      setExpenseAmount('');
      setExpenseReason('');
      setShowExpenseModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Failed to add expense');
    } finally {
      setIsLoading(false);
    }
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

      const updatedShift = {
        ...activeShift,
        externalMoney: [...activeShift.externalMoney, externalMoney],
        totalAmount: activeShift.totalAmount + amount
      };

      await db_service.saveShift(updatedShift);

      setExternalAmount('');
      setExternalReason('');
      setShowExternalMoneyModal(false);
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error adding external money:', error);
      setError('Failed to add external money');
    } finally {
      setIsLoading(false);
    }
  };

  const closeShift = async () => {
    if (!activeShift) return;

    try {
      setIsLoading(true);

      const finalCashAmount = parseFloat(finalCash) || 0;
      const expectedCash = currentCash;
      const discrepancies: string[] = [];

      // Check cash discrepancy
      if (Math.abs(finalCashAmount - expectedCash) > 0.01) {
        discrepancies.push(`Cash discrepancy: Expected ${expectedCash} EGP, Found ${finalCashAmount} EGP`);
      }

      // Check inventory discrepancies
      for (const item of items) {
        const reportedAmount = finalInventory[item.id] || 0;
        const expectedAmount = item.currentAmount - activeShift.purchases
          .filter(p => p.itemId === item.id)
          .reduce((sum, p) => sum + p.quantity, 0);

        if (reportedAmount !== expectedAmount) {
          discrepancies.push(`${item.name}: Expected ${expectedAmount}, Found ${reportedAmount}`);
        }

        // Update item inventory to reported amount
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
        discrepancies,
        closeReason: closeReason || undefined,
        validationStatus: discrepancies.length > 0 ? 'discrepancy' : 'balanced'
      };

      await db_service.saveShift(updatedShift);

      setActiveShift(null);
      setShowCloseShiftModal(false);
      setFinalCash('');
      setCloseReason('');
      setError('');
      await loadData();
    } catch (error) {
      console.error('Error closing shift:', error);
      setError('Failed to close shift');
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
      console.error('Error creating customer:', error);
      setError('Failed to create customer');
    } finally {
      setIsLoading(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!activeShift) {
    return (
      <div className="text-center py-12">
        <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">No Active Shift</h2>
        <p className="text-gray-600 mb-6">Start a new shift to begin selling items</p>
        <button
          onClick={startShift}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
        >
          {isLoading ? 'Starting...' : 'Start Shift'}
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
            <h2 className="text-xl font-bold text-gray-900">Active Shift</h2>
            <p className="text-gray-600">Started: {activeShift.startTime.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">{currentCash.toFixed(2)} EGP</div>
            <div className="text-sm text-gray-600">Current Cash</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {activeShift.purchases.reduce((sum, p) => sum + p.quantity, 0)}
            </div>
            <div className="text-sm text-blue-600">Items Sold</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {activeShift.purchases.reduce((sum, p) => sum + (p.price * p.quantity), 0).toFixed(2)} EGP
            </div>
            <div className="text-sm text-green-600">Total Sales</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {activeShift.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} EGP
            </div>
            <div className="text-sm text-red-600">Expenses</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {activeShift.externalMoney.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} EGP
            </div>
            <div className="text-sm text-purple-600">External Money</div>
          </div>
        </div>

        <div className="flex space-x-4 mt-4">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Add Expense
          </button>
          <button
            onClick={() => setShowExternalMoneyModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            Add External Money
          </button>
          <button
            onClick={() => setShowCloseShiftModal(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            Close Shift
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Unpaid Customer Purchases */}
      {unpaidPurchases.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Unpaid Customer Purchases</h3>
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
                  onClick={() => markAsPaid(purchase)}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
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
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-lg font-bold text-blue-600">{item.sellPrice} EGP</div>
                  <div className={`text-sm ${item.currentAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Stock: {item.currentAmount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cart</h3>
          
          {/* Customer Purchase Toggle */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isCustomerPurchase}
                onChange={(e) => setIsCustomerPurchase(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Customer Purchase (Unpaid)</span>
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
                  <option value="">Select Customer</option>
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
                  <div className="text-sm text-gray-600">{cartItem.price} EGP each</div>
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
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-xl font-bold text-blue-600">{cartTotal.toFixed(2)} EGP</span>
              </div>
              <button
                onClick={processSale}
                disabled={isLoading || (isCustomerPurchase && !selectedCustomer)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : isCustomerPurchase ? 'Add to Customer Tab' : 'Complete Sale'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Expense</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  max={currentCash}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Maximum: {currentCash.toFixed(2)} EGP
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter reason for expense"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addExpense}
                disabled={!expenseAmount || !expenseReason || parseFloat(expenseAmount) > currentCash}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Money Modal */}
      {showExternalMoneyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add External Money</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input
                  type="number"
                  value={externalAmount}
                  onChange={(e) => setExternalAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={externalReason}
                  onChange={(e) => setExternalReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter reason for external money"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowExternalMoneyModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addExternalMoney}
                disabled={!externalAmount || !externalReason}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                Add Money
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Close Shift</h3>
            
            <div className="space-y-6">
              {/* Final Cash */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final Cash Count (EGP)
                </label>
                <input
                  type="number"
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Expected: {currentCash.toFixed(2)} EGP
                </div>
              </div>

              {/* Final Inventory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Final Inventory Count
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          Current: {item.currentAmount}
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

              {/* Close Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Any notes about the shift..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCloseShiftModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={closeShift}
                disabled={!finalCash}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                Close Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Customer</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Enter customer name"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowNewCustomerModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createCustomer}
                disabled={!newCustomerName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalUserView;