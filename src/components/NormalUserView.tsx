import React, { useState, useEffect } from 'react';
import { 
  Plus, Minus, ShoppingCart, Clock, AlertCircle, CheckCircle, 
  Play, DollarSign, Users, Receipt, Filter, X, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Item, Shift, PurchaseItem, Customer, CustomerPurchase, Expense, Category } from '../types';
import { db } from '../services/database';

interface NormalUserViewProps {
  section: 'store' | 'supplement';
}

const NormalUserView: React.FC<NormalUserViewProps> = ({ section }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<CustomerPurchase[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCustomersTab, setShowCustomersTab] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<Customer | null>(null);
  const [inventoryInputs, setInventoryInputs] = useState<Record<string, number>>({});
  const [cashInput, setCashInput] = useState<number>(0);
  const [endShiftError, setEndShiftError] = useState<string>('');
  const [closeReason, setCloseReason] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseReason, setExpenseReason] = useState<string>('');
  const [customerTab, setCustomerTab] = useState<'today' | 'alltime'>('today');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<number>(0);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showCustomPaymentModal, setShowCustomPaymentModal] = useState(false);
  const [customPaymentAmount, setCustomPaymentAmount] = useState<number>(0);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [paymentType, setPaymentType] = useState<'today' | 'alltime'>('today');

  useEffect(() => {
    loadData();
  }, [section]);

  useEffect(() => {
    filterItems();
  }, [items, selectedCategory]);

  const loadData = async () => {
    try {
      const [itemsData, categoriesData, shiftData, customersData, customerPurchasesData] = await Promise.all([
        db.getItemsBySection(section),
        db.getCategoriesBySection(section),
        db.getActiveShift(section),
        db.getCustomersBySection(section),
        db.getUnpaidCustomerPurchases(section)
      ]);
      
      setItems(itemsData);
      setCategories(categoriesData);
      setActiveShift(shiftData);
      setCustomers(customersData);
      setCustomerPurchases(customerPurchasesData);
      setCart({});
      setShowEndShift(false);
      setEndShiftError('');
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const filterItems = () => {
    if (selectedCategory === 'all') {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(item => item.categoryId === selectedCategory));
    }
  };

  const startNewShift = async () => {
    if (!user || activeShift) return;

    setIsLoading(true);
    try {
      // Get last shift's final cash to carry over
      const lastShifts = await db.getShiftsBySection(section);
      const lastClosedShift = lastShifts.find(s => s.status === 'closed');
      const startingCash = lastClosedShift?.finalCash || 0;

      const newShift: Shift = {
        id: `${section}-shift-${Date.now()}`,
        userId: user.id,
        username: user.username,
        section,
        status: 'active',
        purchases: [],
        expenses: [],
        totalAmount: startingCash,
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
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setCart(prev => {
      const current = prev[itemId] || 0;
      const newValue = Math.max(0, Math.min(item.currentAmount, current + change));
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

  const updateItemStock = async (itemId: string, quantityToDeduct: number) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.currentAmount -= quantityToDeduct;
      item.updatedAt = new Date();
      await db.saveItem(item);
    }
  };

  const confirmPurchase = async () => {
    if (!user || Object.keys(cart).length === 0) return;

    setIsLoading(true);
    try {
      let shift = activeShift;

      // Create new shift if none exists
      if (!shift) {
        const lastShifts = await db.getShiftsBySection(section);
        const lastClosedShift = lastShifts.find(s => s.status === 'closed');
        const startingCash = lastClosedShift?.finalCash || 0;

        shift = {
          id: `${section}-shift-${Date.now()}`,
          userId: user.id,
          username: user.username,
          section,
          status: 'active',
          purchases: [],
          expenses: [],
          totalAmount: startingCash,
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
      shift.totalAmount += getCartTotal();

      await db.saveShift(shift);

      // Update item stock
      for (const [itemId, quantity] of Object.entries(cart)) {
        await updateItemStock(itemId, quantity);
      }

      setActiveShift(shift);
      setCart({});
      await loadData();
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
    if (!selectedCustomerForModal && !newCustomerName) return;

    setIsLoading(true);
    try {
      let customer = selectedCustomerForModal;

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

      // Update item stock
      for (const [itemId, quantity] of Object.entries(cart)) {
        await updateItemStock(itemId, quantity);
      }

      await loadData();
      setCart({});
      setShowCustomerModal(false);
      setSelectedCustomerForModal(null);
      setNewCustomerName('');
    } catch (error) {
      console.error('Failed to add customer purchase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const payCustomerDebt = async (customer: Customer, amount: number, isToday: boolean) => {
    if (!user || !activeShift || amount <= 0) return;

    setIsLoading(true);
    try {
      let unpaidPurchases = customerPurchases.filter(cp => 
        cp.customerId === customer.id && !cp.isPaid
      );

      if (isToday && activeShift) {
        unpaidPurchases = unpaidPurchases.filter(cp => cp.shiftId === activeShift.id);
      }

      let remainingAmount = amount;
      const paidPurchases: CustomerPurchase[] = [];

      // Pay purchases in order
      for (const purchase of unpaidPurchases) {
        if (remainingAmount <= 0) break;

        if (purchase.totalAmount <= remainingAmount) {
          // Pay full purchase
          purchase.isPaid = true;
          remainingAmount -= purchase.totalAmount;
          paidPurchases.push(purchase);
          await db.saveCustomerPurchase(purchase);
        } else {
          // Partial payment - reduce the purchase amount
          purchase.totalAmount -= remainingAmount;
          remainingAmount = 0;
          await db.saveCustomerPurchase(purchase);
        }
      }

      // Add paid amount to current shift
      activeShift.totalAmount += (amount - remainingAmount);
      await db.saveShift(activeShift);
      setActiveShift({ ...activeShift });

      await loadData();
      setShowPartialPaymentModal(false);
      setShowCustomPaymentModal(false);
      setPartialPaymentAmount(0);
      setCustomPaymentAmount(0);
      setSelectedCustomerForPayment(null);
    } catch (error) {
      console.error('Failed to pay customer debt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeExpenseFromShift = async (expenseId: string) => {
    if (!activeShift || !confirm('Are you sure you want to remove this expense?')) return;

    setIsLoading(true);
    try {
      const expense = activeShift.expenses.find(e => e.id === expenseId);
      if (!expense) return;

      // Remove expense from shift
      activeShift.expenses = activeShift.expenses.filter(e => e.id !== expenseId);
      activeShift.totalAmount += expense.amount; // Return money to cashier balance
      
      await db.saveShift(activeShift);
      setActiveShift({ ...activeShift });
    } catch (error) {
      console.error('Failed to remove expense:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addExpense = async () => {
    if (!user || !activeShift || expenseAmount <= 0 || !expenseReason) return;

    // Check if expense exceeds current cash
    if (expenseAmount > activeShift.totalAmount) {
      alert('Expense amount exceeds current cashier balance!');
      return;
    }

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
      activeShift.totalAmount -= expenseAmount; // Deduct from cash
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
    
    // Don't pre-fill any values - require manual entry
    const inputs: Record<string, number> = {};
    items.forEach(item => {
      inputs[item.id] = 0; // Start with 0, not current amount
    });
    
    setInventoryInputs(inputs);
    setCashInput(0); // Start with 0, not current amount
    setShowEndShift(true);
    setEndShiftError('');
    setCloseReason('');
  };

  const confirmEndShift = async (forceClose = false) => {
    if (!activeShift) return;

    setIsLoading(true);
    try {
      const discrepancies: string[] = [];
      let totalExpectedCash = activeShift.totalAmount;

      // Check inventory discrepancies
      const soldItems: Record<string, number> = {};
      activeShift.purchases.forEach(purchase => {
        soldItems[purchase.itemId] = (soldItems[purchase.itemId] || 0) + purchase.quantity;
      });

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
      Object.entries(inventoryInputs).forEach(async ([itemId, amount]) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
          item.currentAmount = amount;
          item.updatedAt = new Date();
          await db.saveItem(item);
        }
      });

      setActiveShift(null);
      setShowEndShift(false);
      await loadData();
    } catch (error) {
      console.error('Failed to end shift:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCustomersTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">العملاء</h2>
          <button
            onClick={() => setShowCustomersTab(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map(customer => {
            const customerDebt = customerPurchases
              .filter(cp => cp.customerId === customer.id && !cp.isPaid)
              .reduce((total, cp) => total + cp.totalAmount, 0);

            return (
              <div 
                key={customer.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    customerDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {customerDebt > 0 ? `${customerDebt} الحساب` : 'مدفوع بالكامل'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div>تم الإنشاء: {new Date(customer.createdAt).toLocaleDateString()}</div>
                  <div>إجمالي المشتريات: {customerPurchases.filter(cp => cp.customerId === customer.id).length}</div>
                  <div>الدين المستحق: {customerDebt} جنيه</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCustomerDetails = () => {
    if (!selectedCustomer) return null;

    const todayPurchases = customerPurchases.filter(cp => 
      cp.customerId === selectedCustomer.id && 
      !cp.isPaid && 
      cp.shiftId === activeShift?.id
    );

    const allTimePurchases = customerPurchases.filter(cp => 
      cp.customerId === selectedCustomer.id && 
      !cp.isPaid
    );

    const todayTotal = todayPurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);
    const allTimeTotal = allTimePurchases.reduce((sum, cp) => sum + cp.totalAmount, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h2>
          <button
            onClick={() => setSelectedCustomer(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Customer Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setCustomerTab('today')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                customerTab === 'today'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Today's Items ({todayTotal} جنيه)
            </button>
            <button
              onClick={() => setCustomerTab('alltime')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                customerTab === 'alltime'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All-Time Items ({allTimeTotal} جنيه)
            </button>
          </nav>
        </div>

        {/* Today's Items */}
        {customerTab === 'today' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Today's Items</h3>
              {todayTotal > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedCustomerForPayment(selectedCustomer);
                      setPaymentType('today');
                      setPartialPaymentAmount(todayTotal);
                      setShowPartialPaymentModal(true);
                    }}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    سداد الدين
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCustomerForPayment(selectedCustomer);
                      setPaymentType('today');
                      setCustomPaymentAmount(0);
                      setShowCustomPaymentModal(true);
                    }}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    سداد مخصص
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">الصنف</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">الكميه</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {todayPurchases.flatMap(purchase => 
                    purchase.items.map((item, index) => (
                      <tr key={`${purchase.id}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price * item.quantity} EGP
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All-Time Items */}
        {customerTab === 'alltime' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">All-Time Items</h3>
              {allTimeTotal > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedCustomerForPayment(selectedCustomer);
                      setPaymentType('alltime');
                      setPartialPaymentAmount(allTimeTotal);
                      setShowPartialPaymentModal(true);
                    }}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Pay Debt
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCustomerForPayment(selectedCustomer);
                      setPaymentType('alltime');
                      setCustomPaymentAmount(0);
                      setShowCustomPaymentModal(true);
                    }}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Pay Custom
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Taken</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allTimePurchases.flatMap(purchase => 
                    purchase.items.map((item, index) => (
                      <tr key={`${purchase.id}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.price * item.quantity} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(purchase.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (showCustomersTab && !selectedCustomer) {
    return renderCustomersTab();
  }

  if (selectedCustomer) {
    return renderCustomerDetails();
  }

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
              onChange={(e) => setCashInput(parseInt(e.target.value) || 0)}
              className="w-32 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
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
    <div className="flex">
      {/* Category Sidebar */}
      <div className="w-64 bg-white rounded-lg shadow-sm border border-gray-200 p-4 mr-6 h-fit">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Filter className="h-4 w-4 mr-2" />
          Categories
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Items ({items.length})
          </button>
          {categories.map(category => {
            const itemCount = items.filter(i => i.categoryId === category.id).length;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {category.name} ({itemCount})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
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
                  onClick={() => setShowCustomersTab(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Customers
                </button>
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
            
            {/* Current Shift Expenses */}
            {activeShift.expenses.length > 0 && (
              <div className="mt-4 bg-white rounded-lg border border-green-200 overflow-hidden">
                <div className="px-4 py-2 bg-green-100 border-b border-green-200">
                  <h4 className="text-sm font-semibold text-green-800">Current Shift Expenses</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeShift.expenses.map(expense => (
                        <tr key={expense.id}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                            {expense.amount} EGP
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {expense.reason}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {new Date(expense.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => removeExpenseFromShift(expense.id)}
                              className="text-red-600 hover:text-red-900 flex items-center"
                              title="Remove expense and return money to cashier"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeShift.expenses.length > 0 && (
              <div className="text-sm text-green-700 mt-2">
                Total Expenses: {activeShift.expenses.reduce((sum, exp) => sum + exp.amount, 0)} EGP
              </div>
            )}
          </div>
        )}

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
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
                    disabled={item.currentAmount <= 0 || (cart[item.id] || 0) >= item.currentAmount}
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
                    {selectedCustomerForModal && (
                      <div className="p-3 border border-blue-500 bg-blue-50 rounded-lg flex justify-between items-center">
                        <span className="text-blue-800 font-medium">{selectedCustomerForModal.name}</span>
                        <button
                          onClick={() => setSelectedCustomerForModal(null)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {!selectedCustomerForModal && customers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => setSelectedCustomerForModal(customer)}
                        className="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {customer.name}
                      </button>
                    ))}
                  </div>
                </div>

                {!selectedCustomerForModal && (
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
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={confirmCustomerPurchase}
                  disabled={isLoading || (!selectedCustomerForModal && !newCustomerName)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Adding...' : 'Add to Customer'}
                </button>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setSelectedCustomerForModal(null);
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

        {/* Partial Payment Modal */}
        {showPartialPaymentModal && selectedCustomerForPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Customer Payment</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Customer: <span className="font-medium">{selectedCustomerForPayment.name}</span></p>
                  <p className="text-sm text-gray-600 mb-4">
                    {paymentType === 'today' ? "Today's" : "All-time"} debt: {
                      paymentType === 'today' 
                        ? customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid && cp.shiftId === activeShift?.id).reduce((sum, cp) => sum + cp.totalAmount, 0)
                        : customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid).reduce((sum, cp) => sum + cp.totalAmount, 0)
                    } EGP
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (EGP)</label>
                  <input
                    type="number"
                    value={partialPaymentAmount}
                    onChange={(e) => setPartialPaymentAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max={paymentType === 'today' 
                      ? customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid && cp.shiftId === activeShift?.id).reduce((sum, cp) => sum + cp.totalAmount, 0)
                      : customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid).reduce((sum, cp) => sum + cp.totalAmount, 0)
                    }
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => payCustomerDebt(selectedCustomerForPayment, partialPaymentAmount, paymentType === 'today')}
                  disabled={isLoading || partialPaymentAmount <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Processing...' : 'Confirm Payment'}
                </button>
                <button
                  onClick={() => {
                    setShowPartialPaymentModal(false);
                    setPartialPaymentAmount(0);
                    setSelectedCustomerForPayment(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Payment Modal */}
        {showCustomPaymentModal && selectedCustomerForPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Custom Payment</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Customer: <span className="font-medium">{selectedCustomerForPayment.name}</span></p>
                  <p className="text-sm text-gray-600 mb-4">
                    {paymentType === 'today' ? "Today's" : "All-time"} debt: {
                      paymentType === 'today' 
                        ? customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid && cp.shiftId === activeShift?.id).reduce((sum, cp) => sum + cp.totalAmount, 0)
                        : customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid).reduce((sum, cp) => sum + cp.totalAmount, 0)
                    } EGP
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Payment Amount (EGP)</label>
                  <input
                    type="number"
                    value={customPaymentAmount}
                    onChange={(e) => setCustomPaymentAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max={paymentType === 'today' 
                      ? customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid && cp.shiftId === activeShift?.id).reduce((sum, cp) => sum + cp.totalAmount, 0)
                      : customerPurchases.filter(cp => cp.customerId === selectedCustomerForPayment.id && !cp.isPaid).reduce((sum, cp) => sum + cp.totalAmount, 0)
                    }
                    placeholder="Enter custom amount"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => payCustomerDebt(selectedCustomerForPayment, customPaymentAmount, paymentType === 'today')}
                  disabled={isLoading || customPaymentAmount <= 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Processing...' : 'Pay Custom Amount'}
                </button>
                <button
                  onClick={() => {
                    setShowCustomPaymentModal(false);
                    setCustomPaymentAmount(0);
                    setSelectedCustomerForPayment(null);
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
                    onChange={(e) => setExpenseAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max={activeShift?.totalAmount || 0}
                  />
                  {activeShift && (
                    <p className="text-xs text-gray-500 mt-1">
                      Available cash: {activeShift.totalAmount} EGP
                    </p>
                  )}
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
                  disabled={isLoading || expenseAmount <= 0 || !expenseReason || (activeShift && expenseAmount > activeShift.totalAmount)}
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
    </div>
  );
};

export default NormalUserView;