import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Shift, Item } from '../types';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

export const generateShiftsPDF = (shifts: Shift[], section: 'store' | 'supplement') => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text(`${section.charAt(0).toUpperCase() + section.slice(1)} Shifts History`, 20, 20);
  
  // Date range
  doc.setFontSize(12);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
  
  // Table data
  const tableData = shifts.map(shift => [
    shift.id.substring(0, 8),
    new Date(shift.startTime).toLocaleDateString(),
    shift.endTime ? new Date(shift.endTime).toLocaleDateString() : 'Active',
    `${shift.totalAmount} EGP`,
    shift.purchases.reduce((total, p) => total + p.quantity, 0).toString(),
    `${shift.expenses.reduce((total, e) => total + e.amount, 0)} EGP`,
    shift.validationStatus,
    shift.username,
    shift.status === 'closed' ? shift.username : '-'
  ]);
  
  autoTable(doc, {
    head: [['Shift ID', 'Started', 'Ended', 'Total Cash', 'Items Sold', 'Expenses', 'Status', 'User Opened', 'User Closed']],
    body: tableData,
    startY: 40,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Add discrepancies if any
  let yPosition = (doc as any).lastAutoTable.finalY + 20;
  
  shifts.forEach(shift => {
    if (shift.discrepancies && shift.discrepancies.length > 0) {
      doc.setFontSize(10);
      doc.text(`Shift ${shift.id.substring(0, 8)} Discrepancies:`, 20, yPosition);
      yPosition += 10;
      
      shift.discrepancies.forEach(discrepancy => {
        doc.text(`• ${discrepancy}`, 25, yPosition);
        yPosition += 8;
      });
      
      if (shift.closeReason) {
        doc.text(`Note: ${shift.closeReason}`, 25, yPosition);
        yPosition += 8;
      }
      
      yPosition += 10;
    }
  });
  
  doc.save(`${section}-shifts-history-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateMonthlySummaryPDF = (
  shifts: Shift[], 
  items: Item[], 
  section: 'store' | 'supplement', 
  month: string
) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text(`${section.charAt(0).toUpperCase() + section.slice(1)} Monthly Summary - ${month}`, 20, 20);
  
  // Date
  doc.setFontSize(12);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
  
  // Calculate item totals
  const itemTotals: Record<string, {
    totalSold: number;
    totalCost: number;
    totalProfit: number;
    totalRevenue: number;
    name: string;
  }> = {};

  shifts.forEach(shift => {
    shift.purchases.forEach(purchase => {
      if (!itemTotals[purchase.itemId]) {
        const item = items.find(i => i.id === purchase.itemId);
        itemTotals[purchase.itemId] = {
          totalSold: 0,
          totalCost: 0,
          totalProfit: 0,
          totalRevenue: 0,
          name: purchase.name
        };
      }
      
      const item = items.find(i => i.id === purchase.itemId);
      const cost = item ? item.costPrice * purchase.quantity : 0;
      const revenue = purchase.price * purchase.quantity;
      
      itemTotals[purchase.itemId].totalSold += purchase.quantity;
      itemTotals[purchase.itemId].totalCost += cost;
      itemTotals[purchase.itemId].totalRevenue += revenue;
      itemTotals[purchase.itemId].totalProfit += revenue - cost;
    });
  });
  
  // Item totals table
  doc.setFontSize(14);
  doc.text('Item Totals', 20, 50);
  
  const itemTableData = Object.values(itemTotals).map(item => [
    item.name,
    item.totalSold.toString(),
    `${item.totalCost.toFixed(2)} EGP`,
    `${item.totalProfit.toFixed(2)} EGP`,
    `${item.totalRevenue.toFixed(2)} EGP`
  ]);
  
  autoTable(doc, {
    head: [['Item Name', 'Total Sold', 'Total Cost', 'Total Profit', 'Total Revenue']],
    body: itemTableData,
    startY: 60,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Shifts summary table
  const shiftsStartY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(14);
  doc.text('Shifts Summary', 20, shiftsStartY);
  
  const shiftsTableData = shifts.map(shift => [
    shift.id.substring(0, 8),
    new Date(shift.startTime).toLocaleDateString(),
    shift.endTime ? new Date(shift.endTime).toLocaleDateString() : 'Active',
    shift.username,
    shift.status === 'closed' ? shift.username : '-',
    `${shift.totalAmount.toFixed(2)} EGP`,
    `${shift.expenses.reduce((total, e) => total + e.amount, 0).toFixed(2)} EGP`
  ]);
  
  autoTable(doc, {
    head: [['Shift ID', 'Started', 'Ended', 'User Opened', 'User Closed', 'Total Cash', 'Expenses']],
    body: shiftsTableData,
    startY: shiftsStartY + 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 197, 94] }
  });
  
  doc.save(`${section}-monthly-summary-${month}.pdf`);
};