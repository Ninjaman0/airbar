import React, { useState, useEffect } from 'react';
import { 
  Plus, Minus, ShoppingCart, Clock, AlertCircle, CheckCircle, 
  Play, DollarSign, Users, Receipt 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Item, Shift, PurchaseItem, Customer, CustomerPurchase, Expense } from '../types';
import { db } from '../services/database';

interface NormalUserViewProps {
  section: 'store' | 'supplement';
}

const NormalUserView: React.FC<NormalUserViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [inventoryInputs, setInventoryInputs] = useState<Record<string, number>>({});
  const [cashInput, setCashInput] = useState<number>(0);
  const [endShiftError, setEndShiftError] = useState<string>('');
  const [closeReason, setCloseReason] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseReason, setExpenseReason] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [section]);

  const loadData = async () => {
    try {
      const [itemsData, shiftData, customersData] = await Promise.all([
        db.getItemsBySection(section),
        db.getActiveShift(section),
        db.getCustomersBySection(section)
      ]);
      
      setItems(itemsData);
      setActiveShift(shiftData);
      setCustomers(customersData);
      setCart({});
      setShowEndShift(false);
      setEndShiftError('');
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const startNewShift = async () => {
    if (!user || activeShift) return;

    setIsLoading(true);
    try {
      const newShift: Shift = {
        id: `${section}-shift-${Date.now()}`,
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

      await db.saveShift(newShift);
      setActiveShift(newShift);
    } catch (error) {
      console.error('Failed to start shift:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCartItem = (itemId: string, change: number) => {
    setCart(prev => {
      const current = prev[itemId] || 0;
      const newValue = Math.max(0, current + change);
      if (newValue === 0) {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newValue };
    });
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId);
      return total + (item ? item.sellPrice * quantity : 0);
    }, 0);
  };

  const confirmPurchase = async () => {
    if (!user || Object.keys(cart).length === 0) return;

    setIsLoading(true);
    try {
      let shift = activeShift;

      // Create new shift if none exists
      if (!shift) {
        shift = {
          id: `${section}-shift-${Date.now()}`,
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
      }

      // Add purchases to shift
      const newPurchases: PurchaseItem[] = Object.entries(cart).map(([itemId, quantity]) => {
        const item = items.find(i => i.id === itemId)!;
        return {
          itemId,
          quantity,
          price: item.sellPrice,
          name: item.name
        };
      });

      shift.purchases.push(...newPurchases);
      shift.totalAmount = shift.purchases.reduce((total, p) => total + (p.price * p.quantity), 0);

      await db.saveShift(shift);
      setActiveShift(shift);
      setCart({});
    } catch (error) {
      console.error('Failed to confirm purchase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCustomer = async () => {
    if (!user || Object.keys(cart).length === 0) return;

    setShowCustomerModal(true);
  };

  const confirmCustomerPurchase = async () => {
    if (!selectedCustomer && !newCustomerName) return;

    setIsLoading(true);
    try {
      let customer = selectedCustomer;

      // Create new customer if needed
      if (!customer && newCustomerName) {
        customer = {
          id: `customer-${Date.now()}`,
          name: newCustomerName,
          section,
          createdAt: new Date()
        };
        await db.saveCustomer(customer);
      }

      if (!customer) return;

      // Create customer purchase
      const purchaseItems: PurchaseItem[] = Object.entries(cart).map(([itemId, quantity]) => {
        const item = items.find(i => i.id === itemId)!;
        return {
          itemId,
          quantity,
          price: item.sellPrice,
          name: item.name
        };
      });

      const customerPurchase: CustomerPurchase = {
        id: `customer-purchase-${Date.now()}`,
        customerId: customer.id,
        customerName: customer.name,
        items: purchaseItems,
        totalAmount: getCartTotal(),
        section,
        shiftId: activeShift?.id,
        isPaid: false,
        timestamp: new Date()
      };

      await db.saveCustomerPurchase(customerPurchase);

      // Update item amounts (deduct from stock)
      for (const [itemId, quantity] of Object.entries(cart)) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          item.currentAmount -= quantity;
          item.updatedAt = new Date();
          await db.saveItem(item);
        }
      }

      await loadData();
      setCart({});
      setShowCustomerModal(false);
      setSelectedCustomer(null);
      setNewCustomerName('');
    } catch (error) {
      console.error('Failed to add customer purchase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addExpense = async () => {
    if (!user || !activeShift || expenseAmount <= 0 || !expenseReason) return;

    setIsLoading(true);
    try {
      const expense: Expense = {
        id: `expense-${Date.now()}`,
        amount: expenseAmount,
        reason: expenseReason,
        shiftId: activeShift.id,
        section,
        timestamp: new Date(),
        createdBy: user.username
      };

      await db.saveExpense(expense);

      // Update shift
      activeShift.expenses.push(expense);
      await db.saveShift(activeShift);

      setActiveShift({ ...activeShift });
      setShowExpenseModal(false);
      setExpenseAmount(0);
      setExpenseReason('');
    } catch (error) {
      console.error('Failed to add expense:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEndShift = () => {
    if (!activeShift) return;
    
    const inputs: Record<string, number> = {};
    items.forEach(item => {
      inputs[item.id] = item.currentAmount;
    });
    
    setInventoryInputs(inputs);
    setCashInput(activeShift.totalAmount);
    setShowEndShift(true);
    setEndShiftError('');
    setCloseReason('');
  };

  const confirmEndShift = async (forceClose = false) => {
    if (!activeShift) return;

    setIsLoading(true);
    try {
      const discrepancies: string[] = [];
      let totalExpectedCash = 0;

      // Calculate expected inventory and cash
      const soldItems: Record<string, number> = {};
      activeShift.purchases.forEach(purchase => {
        soldItems[purchase.itemId] = (soldItems[purchase.itemId] || 0) + purchase.quantity;
        totalExpectedCash += purchase.price * purchase.quantity;
      });

      // Subtract expenses from expected cash
      const totalExpenses = activeShift.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      totalExpectedCash -= totalExpenses;

      // Check inventory discrepancies
      Object.entries(soldItems).forEach(([itemId, soldQuantity]) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
          const expectedAmount = item.currentAmount + soldQuantity;
          const actualAmount = inventoryInputs[itemId];
          const difference = expectedAmount - actualAmount - soldQuantity;
          
          if (difference !== 0) {
            const sign = difference > 0 ? 'missing' : 'extra';
            discrepancies.push(`${Math.abs(difference)} ${item.name} ${sign}`);
          }
        }
      });

      // Check cash discrepancy
      const cashDifference = cashInput - totalExpectedCash;
      if (cashDifference !== 0) {
        const sign = cashDifference < 0 ? 'missing' : 'extra';
        discrepancies.push(`${Math.abs(cashDifference)} EGP ${sign}`);
      }

      if (discrepancies.length > 0 && !forceClose) {
        setEndShiftError(`Discrepancies found: ${discrepancies.join(', ')}`);
        setIsLoading(false);
        return;
      }

      // Update shift and inventory
      activeShift.status = 'closed';
      activeShift.endTime = new Date();
      activeShift.finalInventory = inventoryInputs;
      activeShift.finalCash = cashInput;
      activeShift.discrepancies = discrepancies;
      activeShift.validationStatus = discrepancies.length > 0 ? 'discrepancy' : 'balanced';
      if (forceClose && closeReason) {
        activeShift.closeReason = closeReason;
      }

      await db.saveShift(activeShift);

      // Update item amounts
      Object.entries(soldItems).forEach(async ([itemId, soldQuantity]) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
          item.currentAmount = inventoryInputs[itemId];
          item.updatedAt = new Date();
          await db.saveItem(item);
        }
      });

      // Create daily summary
      const today = new Date().toISOString().split('T')[0];
      const dailySummary = {
        date: `${today}-${section}`,
        section,
        soldItems: Object.entries(soldItems).reduce((acc, [itemId, quantity]) => {
          const item = items.find(i => i.id === itemId);
          if (item) {
            acc[itemId] = {
              quantity,
              cost: item.costPrice * quantity,
              profit: (item.sellPrice - item.costPrice) * quantity,
              name: item.name
            };
          }
          return acc;
        }, {} as any),
        totalCost: Object.entries(soldItems).reduce((total, [itemId, quantity]) => {
          const item = items.find(i => i.id === itemId);
          return total + (item ? item.costPrice * quantity : 0);
        }, 0),
        totalProfit: Object.entries(soldItems).reduce((total, [itemId, quantity]) => {
          const item = items.find(i => i.id === itemId);
          return total + (item ? (item.sellPrice - item.costPrice) * quantity : 0);
        }, 0),
        totalExpenses
      };

      await db.saveDailySummary(dailySummary);

      setActiveShift(null);
      setShowEndShift(false);
      await loadData();
    } catch (error) {
      console.error('Failed to end shift:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (showEndShift) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">End Shift - Inventory Check</h2>
          
          <div className="space-y-4 mb-6">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="font-medium text-gray-900">{item.name}</span>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500">Current count:</span>
                  <input
                    type="number"
                    value={inventoryInputs[item.id] || 0}
                    onChange={(e) => setInventoryInputs(prev => ({
                      ...prev,
                      [item.id]: parseInt(e.target.value) || 0
                    }))}
                    className="w-20 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100 mb-6">
            <span className="font-medium text-gray-900">Current Cash (EGP)</span>
            <input
              type="number"
              value={cashInput}
              onChange={(e) => setCashInput(parseFloat(e.target.value) || 0)}
              className="w-32 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
              step="0.01"
            />
          </div>

          {endShiftError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {endShiftError}
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-red-700 mb-1">
                  Reason for discrepancy:
                </label>
                <input
                  type="text"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., Missing items due to breakage"
                />
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => confirmEndShift(false)}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'Processing...' : 'Confirm End Shift'}
            </button>
            {endShiftError && (
              <button
                onClick={() => confirmEndShift(true)}
                disabled={isLoading || !closeReason}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Close with Reason
              </button>
            )}
            <button
              onClick={() => setShowEndShift(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Start New Shift Button */}
      {!activeShift && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Play className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-800">No active shift</span>
            </div>
            <button
              onClick={startNewShift}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              Start New Shift
            </button>
          </div>
        </div>
      )}

      {/* Active Shift Status */}
      {activeShift && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-green-600 mr-2" />
              <span className="font-medium text-green-800">
                Active Shift - Total: {activeShift.totalAmount} EGP
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center"
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Expenses
              </button>
              <button
                onClick={startEndShift}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                End Shift
              </button>
            </div>
          </div>
          {activeShift.expenses.length > 0 && (
            <div className="text-sm text-green-700">
              Expenses: {activeShift.expenses.reduce((sum, exp) => sum + exp.amount, 0)} EGP
            </div>
          )}
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-lg font-bold text-blue-600">{item.sellPrice} EGP</p>
                <p className="text-sm text-gray-500">Stock: {item.currentAmount}</p>
              </div>
              {item.image && (
                <img 
                  src={item.image} 
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => updateCartItem(item.id, -1)}
                  disabled={!cart[item.id]}
                  className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-medium w-8 text-center">{cart[item.id] || 0}</span>
                <button
                  onClick={() => updateCartItem(item.id, 1)}
                  disabled={item.currentAmount <= 0}
                  className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      {Object.keys(cart).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Current Selection</h3>
          <div className="space-y-2 mb-4">
            {Object.entries(cart).map(([itemId, quantity]) => {
              const item = items.find(i => i.id === itemId);
              if (!item) return null;
              return (
                <div key={itemId} className="flex justify-between items-center">
                  <span>{quantity}x {item.name}</span>
                  <span className="font-medium">{item.sellPrice * quantity} EGP</span>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-4 flex justify-between items-center">
            <span className="text-lg font-bold">Total: {getCartTotal()} EGP</span>
            <div className="flex space-x-3">
              <button
                onClick={addToCustomer}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
              >
                <Users className="h-4 w-4 mr-2" />
                Add to Customer
              </button>
              <button
                onClick={confirmPurchase}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center"
              >
                {isLoading ? (
                  'Processing...'
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Confirm Purchase
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add to Customer</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Customer
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {customers.map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`w-full text-left p-3 border rounded-lg transition-colors ${
                        selectedCustomer?.id === customer.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {customer.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Create New Customer
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter customer name"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={confirmCustomerPurchase}
                disabled={isLoading || (!selectedCustomer && !newCustomerName)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add to Customer'}
              </button>
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setSelectedCustomer(null);
                  setNewCustomerName('');
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Cleaning supplies"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={addExpense}
                disabled={isLoading || expenseAmount <= 0 || !expenseReason}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add Expense'}
              </button>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setExpenseAmount(0);
                  setExpenseReason('');
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalUserView;