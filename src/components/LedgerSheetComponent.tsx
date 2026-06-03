import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Clock, 
  RotateCcw, 
  Search, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  HelpCircle,
  ArrowRightLeft,
  Activity,
  Plus,
  Package,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, DAILY_RECORDS_COL, REQUIREMENTS_COL, TRANSFERS_COL, COLD_ROOM_COL } from '../lib/firebase';

// Mapped List of 32 items with their exact S.No, item ID matching INITIAL_ITEMS, and Minimum stocks
export interface MasterLedgerItem {
  sNo: number;
  id: string;
  name: string;
  category: string;
  minStock: {
    '42': number;
    '31': number;
    '35': number;
    '88': number;
    total: number;
  };
}

export const MASTER_LEDGER_ITEMS: MasterLedgerItem[] = [
  { sNo: 1, id: '85', category: 'Classic Cakes', name: 'Chocolate Truffle Cake (1/2 Kg)', minStock: { '42': 3, '31': 3, '35': 2, '88': 2, total: 10 } },
  { sNo: 2, id: '84', category: 'Classic Cakes', name: 'Chocolate Truffle Cake (1 Kg)', minStock: { '42': 1, '31': 1, '35': 1, '88': 1, total: 4 } },
  { sNo: 3, id: '87', category: 'Classic Cakes', name: 'Classic Pineapple Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 2, '31': 2, '35': 1, '88': 1, total: 6 } },
  { sNo: 4, id: '83', category: 'Classic Cakes', name: 'Butterscotch Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 2, '31': 2, '35': 1, '88': 1, total: 6 } },
  { sNo: 5, id: '97', category: 'Classic Cakes', name: 'Vanilla Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 1, '88': 1, total: 4 } },
  { sNo: 6, id: '89', category: 'Classic Cakes', name: 'Fresh Fruit Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 0, '88': 0, total: 2 } },
  { sNo: 7, id: '81', category: 'Classic Cakes', name: 'Blueberry Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 2, '31': 2, '35': 1, '88': 1, total: 6 } },
  { sNo: 8, id: '182', category: 'Exotic Cakes', name: 'Tiramisu (Coffee Flavour) (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 0, '88': 0, total: 2 } },
  { sNo: 9, id: '79', category: 'Classic Cakes', name: 'Black Forest Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 2, '35': 1, '88': 1, total: 5 } },
  { sNo: 10, id: '95', category: 'Classic Cakes', name: 'Red Velvet Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 1, '88': 1, total: 4 } },
  { sNo: 11, id: '43', category: 'Cheese Cakes', name: 'Blueberry Cheese Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 0, '88': 0, total: 2 } },
  { sNo: 12, id: '51', category: 'Cheese Cakes', name: 'Nutella Cheese Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 0, '31': 0, '35': 0, '88': 0, total: 0 } },
  { sNo: 13, id: '91', category: 'Classic Cakes', name: 'Fresh Mango (Seasonal) Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 0, '88': 0, total: 2 } },
  { sNo: 14, id: '170', category: 'Exotic Cakes', name: 'Ferraro Rocher Cake (1/2 Kg - Serve 4-6)', minStock: { '42': 0, '31': 0, '35': 0, '88': 0, total: 0 } },
  { sNo: 15, id: '217', category: 'Pastries', name: 'Classic Pineapple Pastry', minStock: { '42': 6, '31': 6, '35': 4, '88': 4, total: 20 } },
  { sNo: 16, id: '213', category: 'Pastries', name: 'Black Forest Pastry', minStock: { '42': 6, '31': 6, '35': 4, '88': 4, total: 20 } },
  { sNo: 17, id: '216', category: 'Pastries', name: 'Chocolate Truffle Pastry', minStock: { '42': 8, '31': 8, '35': 6, '88': 6, total: 28 } },
  { sNo: 18, id: '225', category: 'Pastries', name: 'Red Velvet Pastry', minStock: { '42': 4, '31': 4, '35': 4, '88': 4, total: 16 } },
  { sNo: 19, id: '214', category: 'Pastries', name: 'Blue Berry Pastry', minStock: { '42': 4, '31': 4, '35': 4, '88': 4, total: 16 } },
  { sNo: 20, id: '224', category: 'Pastries', name: 'Rainbow Pastry', minStock: { '42': 4, '31': 4, '35': 3, '88': 3, total: 14 } },
  { sNo: 21, id: '215', category: 'Pastries', name: 'Blueberry Cheese Pastry', minStock: { '42': 4, '31': 4, '35': 0, '88': 2, total: 10 } },
  { sNo: 22, id: '223', category: 'Pastries', name: 'Nutella Cheese Pastry', minStock: { '42': 4, '31': 4, '35': 2, '88': 2, total: 12 } },
  { sNo: 23, id: '219', category: 'Pastries', name: 'Kunafa Pastry', minStock: { '42': 3, '31': 3, '35': 2, '88': 2, total: 10 } },
  { sNo: 24, id: '152', category: 'Dry Fruits & Dry Cakes', name: 'Chocochip (1/2 Kg - Serve 4-6)', minStock: { '42': 2, '31': 2, '35': 1, '88': 1, total: 6 } },
  { sNo: 25, id: '161', category: 'Dry Fruits & Dry Cakes', name: 'Mawa (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 1, '88': 1, total: 4 } },
  { sNo: 26, id: '155', category: 'Dry Fruits & Dry Cakes', name: 'Date&Walnut (1/2 Kg - Serve 4-6)', minStock: { '42': 1, '31': 1, '35': 1, '88': 1, total: 4 } },
  { sNo: 27, id: '208', category: 'Others', name: 'Alloo Patty', minStock: { '42': 12, '31': 12, '35': 8, '88': 6, total: 38 } },
  { sNo: 28, id: '243', category: 'Savouries & Snacks', name: 'Paneer Patties', minStock: { '42': 4, '31': 4, '35': 3, '88': 2, total: 13 } },
  { sNo: 29, id: '251', category: 'Savouries & Snacks', name: 'Vada Pav', minStock: { '42': 5, '31': 5, '35': 4, '88': 2, total: 16 } },
  { sNo: 30, id: '241', category: 'Savouries & Snacks', name: 'Mushroom Puff', minStock: { '42': 3, '31': 3, '35': 2, '88': 2, total: 10 } },
  { sNo: 31, id: '239', category: 'Savouries & Snacks', name: 'Hot Dog', minStock: { '42': 2, '31': 2, '35': 2, '88': 2, total: 8 } },
  { sNo: 32, id: '248', category: 'Savouries & Snacks', name: 'Stuffed Kulcha', minStock: { '42': 2, '31': 2, '35': 2, '88': 2, total: 8 } }
];

export const OUTLETS = [
  { id: '31', name: 'Sec 31' },
  { id: '42', name: 'Sec 42' },
  { id: '35', name: 'Sec 35' },
  { id: '88', name: 'Sec 88' }
];

export const LedgerSheetComponent = React.memo(({ 
  items, 
  records, 
  setRecords, 
  currentDate, 
  setCurrentDate,
  getPreviousClosing,
  calculateSold,
  calculateClosing,
  setIsSidebarOpen,
  setPendingTransfers
}: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sheet' | 'fifo' | 'planner'>('sheet');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');
  const [isProcessingRollover, setIsProcessingRollover] = useState(false);
  const [rolloverSuccess, setRolloverSuccess] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState('');

  const handleClearTodayRecords = useCallback(async () => {
    setIsClearing(true);
    try {
      // 1. Delete outlet documents in Firestore
      for (const outlet of OUTLETS) {
        const recordId = `${currentDate}_${outlet.id}`;
        const docRef = doc(db, DAILY_RECORDS_COL, recordId);
        await deleteDoc(docRef);
      }

      // 2. Delete kitchen batches document in Firestore
      const kitchenDocRef = doc(db, DAILY_RECORDS_COL, currentDate);
      await deleteDoc(kitchenDocRef);

      // 3. Delete cold room records for this date
      for (const item of MASTER_LEDGER_ITEMS) {
        const coldRoomDocId = `${currentDate}_${item.id}`;
        const coldRoomDocRef = doc(db, COLD_ROOM_COL, coldRoomDocId);
        await deleteDoc(coldRoomDocRef);
      }

      // 3.5 Delete matching transfers in Firestore & clear from local state
      try {
        const transfersRef = collection(db, TRANSFERS_COL);
        const q = query(transfersRef, where('date', '==', currentDate));
        const transfersSnapshot = await getDocs(q);
        for (const tDoc of transfersSnapshot.docs) {
          await deleteDoc(tDoc.ref);
        }
        if (setPendingTransfers) {
          setPendingTransfers((prev: any[]) => prev.filter(t => t.date !== currentDate));
        }
      } catch (errTrans) {
        console.error("Failed to delete matching transfers during clear:", errTrans);
      }

      // 4. Update local state
      setRecords((prev: any) => {
        const copy = { ...prev };
        delete copy[currentDate];
        return copy;
      });

      setClearSuccessMsg(`SUCCESSFULLY WIPED & RESTARTED FRESH FOR ${currentDate === '2026-06-03' ? '3 JUNE' : currentDate}! ALL QUANTITIES ARE EMPTY!`);
      setTimeout(() => setClearSuccessMsg(''), 5000);
      setShowClearModal(false);
    } catch (err: any) {
      console.error("Failed to clear records:", err);
      alert(`Error clearing records: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  }, [currentDate, setRecords, setPendingTransfers]);

  // Helper: Generates list of past 6 dates in YYYY-MM-DD format based on active currentDate
  const datesRange = useMemo(() => {
    const list = [];
    const baseDate = new Date(currentDate);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      list.push(`${year}-${month}-${day}`);
    }
    return list;
  }, [currentDate]);

  // Helper: format date for column headers
  const getColHeaderLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${months[mIdx] || ''}`;
    }
    return dateStr;
  };

  // Helper to extract closing stock of an item in an outlet for a date
  const getClosingValue = useCallback((dateStr: string, outletId: string, itemId: string) => {
    const dayData = records[dateStr] || {};
    const outletData = dayData[outletId] || {};
    const itemData = outletData[itemId];
    if (itemData) {
      return Number(itemData.closing ?? 0);
    }
    return 0;
  }, [records]);

  // FIFO Stock Batch Parsing Algorithm
  // Since outlets enter date-wise records, we inspect additions (received/transf_in) over time
  // and subtract total deductions (sold + testing + returned + transf_out) to find exactly
  // which batches compose the current closing stock!
  const getFifoBatches = useCallback((itemId: string, outletId: string, asOfDate: string) => {
    const sortedDates = Object.keys(records).filter(d => d <= asOfDate).sort();
    
    // We will list all additions in order
    const additions: { sourceDate: string; quantity: number }[] = [];
    let totalDeductions = 0;

    sortedDates.forEach(dateStr => {
      const dayData = records[dateStr]?.[outletId]?.[itemId];
      if (dayData) {
        // Additions
        const added = Number(dayData.received || 0) + Number(dayData.transf_in || 0);
        if (added > 0) {
          additions.push({ sourceDate: dateStr, quantity: added });
        }
        // Deductions
        const subtracted = Number(dayData.sold || 0) + Number(dayData.testing || 0) + Number(dayData.returned || 0) + Number(dayData.transf_out || 0);
        totalDeductions += subtracted;
      }
    });

    // Also factor in the immediate opening from the earliest date in records if not covered
    if (sortedDates.length > 0) {
      const earliestDate = sortedDates[0];
      const earliestDayData = records[earliestDate]?.[outletId]?.[itemId];
      const initialOpening = Number(earliestDayData?.opening || 0);
      if (initialOpening > 0) {
        additions.unshift({ sourceDate: `Before ${earliestDate}`, quantity: initialOpening });
      }
    }

    // Allocate deductions against oldest additions (FIFO)
    let remainingDeductions = totalDeductions;
    const activeBatchesInClosing = additions.map(batch => {
      if (remainingDeductions <= 0) {
        return { ...batch, currentRemaining: batch.quantity };
      }
      if (remainingDeductions >= batch.quantity) {
        remainingDeductions -= batch.quantity;
        return { ...batch, currentRemaining: 0 };
      } else {
        const left = batch.quantity - remainingDeductions;
        remainingDeductions = 0;
        return { ...batch, currentRemaining: left };
      }
    }).filter(b => b.currentRemaining > 0);

    return activeBatchesInClosing;
  }, [records]);

  const calcAgeDays = (fromStr: string, activeStr: string) => {
    if (fromStr.startsWith('Before')) return 999;
    try {
      const d1 = new Date(fromStr);
      const d2 = new Date(activeStr);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  // Determine which stock batches are expired and must be returned to Sec 31
  const getFiredReturnsList = useCallback((asOfDate: string) => {
    const expiredListForAdmin: {
      item: MasterLedgerItem;
      outletId: string;
      outletName: string;
      batchDate: string;
      ageDays: number;
      qty: number;
    }[] = [];

    MASTER_LEDGER_ITEMS.forEach(item => {
      OUTLETS.filter(o => o.id !== '31').forEach(outlet => {
        const batches = getFifoBatches(item.id, outlet.id, asOfDate);
        batches.forEach(b => {
          if (b.sourceDate.startsWith('Before')) return; // ignore static baseline pre-records
          
          const age = calcAgeDays(b.sourceDate, asOfDate);
          let isExpired = false;

          // Expiry rule check
          // Sec 88 & Sec 35 can hold stock received TODAY and YESTERDAY (lifespan <= 1 days relative to today)
          if ((outlet.id === '88' || outlet.id === '35') && age > 1) {
            isExpired = true;
          }
          // Sec 42 can hold TODAY, YESTERDAY, and DAY BEFORE YESTERDAY (lifespan <= 2 days relative to today)
          if (outlet.id === '42' && age > 2) {
            isExpired = true;
          }

          if (isExpired && b.currentRemaining > 0) {
            expiredListForAdmin.push({
              item,
              outletId: outlet.id,
              outletName: outlet.name,
              batchDate: b.sourceDate,
              ageDays: age,
              qty: b.currentRemaining
            });
          }
        });
      });
    });

    return expiredListForAdmin;
  }, [getFifoBatches]);

  const expiredReturns = useMemo(() => getFiredReturnsList(currentDate), [getFiredReturnsList, currentDate]);

  // Execute automatic rollover in Firestore & local state
  const handleExecuteReturnsRollover = async () => {
    if (expiredReturns.length === 0) {
      alert("No expired stock items pending auto-returns under the FIFO guidelines.");
      return;
    }

    setIsProcessingRollover(true);
    setRolloverSuccess(null);

    try {
      // Group by source and target
      // Target is always Sec 31
      const targetOutletId = '31';

      // We will perform changes sequentially in Firestore
      for (const entry of expiredReturns) {
        const { item, outletId, qty } = entry;

        // 1. DEDUCT from sender outlet on currentDate
        // (Increment returned counter)
        const sourceRecordKey = `${currentDate}_${outletId}`;
        const sourceDocRef = doc(db, DAILY_RECORDS_COL, sourceRecordKey);
        
        let sourceDataMap: any = { records: {} };
        const sourceSnap = await getDoc(sourceDocRef);
        if (sourceSnap.exists()) {
          sourceDataMap = sourceSnap.data();
        }

        const sourceItemRecord = sourceDataMap.records[item.id] || {
          opening: 0, received: 0, sold: 0, testing: 0, returned: 0, wastage: 0, transf_out: 0, closing: 0, calculationMode: 'sold'
        };

        const updatedReturned = Number(sourceItemRecord.returned || 0) + qty;
        const newSourceItemData = {
          ...sourceItemRecord,
          returned: updatedReturned
        };
        newSourceItemData.closing = calculateClosing(newSourceItemData);

        sourceDataMap.records[item.id] = newSourceItemData;
        sourceDataMap.date = currentDate;
        sourceDataMap.outletId = outletId;

        await setDoc(sourceDocRef, sourceDataMap, { merge: true });

        // 2. ADD to target outlet (Sec 31) on currentDate
        // (Increment transf_in counter and log sources)
        const targetRecordKey = `${currentDate}_${targetOutletId}`;
        const targetDocRef = doc(db, DAILY_RECORDS_COL, targetRecordKey);

        let targetDataMap: any = { records: {} };
        const targetSnap = await getDoc(targetDocRef);
        if (targetSnap.exists()) {
          targetDataMap = targetSnap.data();
        }

        const targetItemRecord = targetDataMap.records[item.id] || {
          opening: 0, received: 0, sold: 0, testing: 0, returned: 0, wastage: 0, transf_in: 0, transf_out: 0, closing: 0, calculationMode: 'sold', transf_in_sources: []
        };

        const updatedTransfIn = Number(targetItemRecord.transf_in || 0) + qty;
        const currentSources = targetItemRecord.transf_in_sources || [];
        const newSources = [...currentSources, { fromOutletId: outletId, quantity: qty, note: 'AUTO FIFO EXPIRED RETURN' }];

        const newTargetItemData = {
          ...targetItemRecord,
          transf_in: updatedTransfIn,
          transf_in_sources: newSources
        };
        newTargetItemData.closing = calculateClosing(newTargetItemData);

        targetDataMap.records[item.id] = newTargetItemData;
        targetDataMap.date = currentDate;
        targetDataMap.outletId = targetOutletId;

        await setDoc(targetDocRef, targetDataMap, { merge: true });
      }

      setRolloverSuccess(`SUCCESSFULLY AUTO-RETURNED ${expiredReturns.reduce((acc, x) => acc + x.qty, 0)} PENDING ITEMS TO SEC 31 ON FIRESTORE CONSOLE!`);
    } catch (e: any) {
      console.error("Auto FIFO Return failed:", e);
      alert(`Auto FIFO Return failed: ${e.message}`);
    } finally {
      setIsProcessingRollover(false);
    }
  };

  const filteredItems = useMemo(() => {
    return MASTER_LEDGER_ITEMS.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const totalDispatches = useMemo(() => {
    let total = 0;
    MASTER_LEDGER_ITEMS.forEach(item => {
      OUTLETS.forEach(o => {
        const dayRec = records[currentDate]?.[o.id]?.[item.id];
        total += Number(dayRec?.received || 0);
      });
    });
    return total;
  }, [records, currentDate]);

  const totalProduction = useMemo(() => {
    let total = 0;
    const bkRecords = records[currentDate] || {};
    if (bkRecords.batches) {
      Object.values(bkRecords.batches).forEach((batch: any) => {
        total += Number(batch.quantity || 0);
      });
    }
    return total;
  }, [records, currentDate]);

  return (
    <div id="outlets-ledger-root" className="flex-1 flex flex-col h-full bg-[#FAF9F5] overflow-y-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white border-b border-[#E4E3O] shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#4F2C1D] text-white rounded">
              <FileSpreadsheet size={20} />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#4F2C1D]">OUTLETS MASTER LEDGER SHEET</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1 uppercase tracking-wider font-semibold">
            Historical day-wise closing stock & FIFO tracking spreadsheet matching manual paper ledger
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Date Navigator */}
          <div className="flex items-center gap-3 bg-[#FAF8F5] p-2 border border-stone-200 rounded-lg">
            <Calendar size={15} className="text-[#4F2C1D]" />
            <span className="text-xs font-bold text-stone-600 uppercase">Ledger Base Date:</span>
            <input 
              type="date" 
              value={currentDate} 
              onChange={(e) => setCurrentDate(e.target.value)}
              className="text-xs bg-white text-[#4F2C1D] border border-stone-300 font-bold px-2 py-1 rounded focus:outline-none"
            />
          </div>

          {/* Start Fresh Clear Button */}
          <button
            onClick={() => setShowClearModal(true)}
            className="h-10 px-4 bg-red-700 hover:bg-red-800 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm rounded-lg active:scale-95"
            title="Clear all quantities for currently selected date"
          >
            <RotateCcw size={14} className={isClearing ? "animate-spin" : ""} />
            {currentDate === '2026-06-03' ? "Restart Fresh (Clear 3 June)" : `Clear All (${currentDate})`}
          </button>
        </div>
      </div>

      {clearSuccessMsg && (
        <div className="mx-6 mt-4 p-4 bg-green-600 text-white text-[11px] font-black uppercase tracking-widest text-center shadow-lg border border-green-700 rounded-xl">
          ✨ {clearSuccessMsg}
        </div>
      )}

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowClearModal(false)} />
          <div className="relative bg-white border-4 border-stone-950 p-6 md:p-8 max-w-md w-full shadow-[12px_12px_0_0_rgba(0,0,0,1)]">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-red-100 text-red-800 rounded-lg">
                <AlertTriangle size={24} />
              </span>
              <div>
                <h3 className="text-lg font-black text-stone-900 uppercase">PERMANENTLY RESET RECORDS</h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Are you sure you want to delete all daily records, base kitchen output batches, and cold room logs for <strong className="text-red-700">{currentDate === '2026-06-03' ? 'June 3rd (Today)' : currentDate}</strong>?
                </p>
                <p className="text-[10px] bg-red-50 text-red-800 p-2 mt-3 font-semibold uppercase leading-normal border border-red-100">
                  ⚠️ This will set all quantities back to blank/empty so you can enter brand new, clean data. Previous historic days will remain fully stored and safe!
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-black uppercase tracking-widest border border-stone-300 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearTodayRecords}
                disabled={isClearing}
                className="flex-1 py-3 bg-red-700 hover:bg-red-800 text-white text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                {isClearing ? 'Clearing...' : 'Confirm, Clear Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Navigation Sub-Tabs */}
      <div className="px-6 pt-4 bg-white border-b border-stone-200 flex justify-between items-center">
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('sheet')} 
            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'sheet' ? 'border-[#4F2C1D] text-[#4F2C1D]' : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <FileSpreadsheet size={14} /> Master Ledger Sheet
          </button>
          <button 
            onClick={() => setActiveTab('fifo')} 
            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'fifo' ? 'border-[#4F2C1D] text-[#4F2C1D]' : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <Clock size={14} /> Lifespan & FIFO Tracker 
            {expiredReturns.length > 0 && (
              <span className="bg-[#8a2214] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                {expiredReturns.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('planner')} 
            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'planner' ? 'border-[#4F2C1D] text-[#4F2C1D]' : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <Activity size={14} /> Returns & Dispatches Plan
          </button>
        </div>

        <div className="relative pb-2">
          <Search size={14} className="absolute left-3 top-2 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search listed items..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1 bg-[#FAF9F5] border border-stone-200 rounded text-xs w-48 focus:outline-none focus:border-stone-400 transition-all font-semibold"
          />
        </div>
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {/* TAB 1: MASTER SPREADSHEET */}
          {activeTab === 'sheet' && (
            <motion.div 
              key="sheet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Outlet Filter for ease-of-reading */}
              <div className="flex items-center justify-between bg-white p-4 border border-stone-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-600 uppercase">
                  <span>View Columns Option:</span>
                  <div className="flex gap-1 bg-[#FAF9F5] p-1 border border-stone-200 rounded-md">
                    <button 
                      onClick={() => setSelectedOutletFilter('all')} 
                      className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-all ${selectedOutletFilter === 'all' ? 'bg-[#4F2C1D] text-white shadow' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      All Outlets Grid
                    </button>
                    {OUTLETS.map(outlet => (
                      <button
                        key={outlet.id}
                        onClick={() => setSelectedOutletFilter(outlet.id)}
                        className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold transition-all ${selectedOutletFilter === outlet.id ? 'bg-[#4F2C1D] text-white shadow' : 'text-stone-500 hover:text-stone-700'}`}
                      >
                        {outlet.name} (Multi-Day)
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-stone-400 uppercase font-bold flex items-center gap-4">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#8a2214]/15 rounded-sm inline-block"></span> Under Minimum Stock</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-100 rounded-sm inline-block"></span> Normal / Healthy Stock</span>
                </div>
              </div>

              {/* SPREADSHEET CONTAINER */}
              <div id="master-spreadsheet-scrollable" className="bg-white border RichmondBorder border-stone-200 rounded-xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-auto text-xs min-w-max">
                    {/* Header Group */}
                    <thead>
                      <tr className="bg-[#4F2C1D] text-white uppercase text-[10px] tracking-wider divide-x divide-[#FAF9F5]/10">
                        <th rowSpan={2} className="p-3 text-center w-12 sticky left-0 bg-[#4F2C1D] z-10 font-black">S.No</th>
                        <th rowSpan={2} className="p-3 w-56 sticky left-12 bg-[#4F2C1D] z-10 font-black">Item Name</th>
                        <th colSpan={5} className="p-2 text-center border-b border-[#FAF9F5]/20 bg-[#3f2115] font-black">Minimum Stock Guidelines</th>
                        
                        {/* Dynamic Outlet Headers */}
                        {selectedOutletFilter === 'all' ? (
                          // All Outlets closing stocks on Base Date
                          OUTLETS.map(outlet => (
                            <th key={outlet.id} className="p-2 text-center bg-[#5F3C2D]" rowSpan={2}>
                              {outlet.name} <br/>
                              <span className="text-[9px] font-normal lowercase">({getColHeaderLabel(currentDate)} closing)</span>
                            </th>
                          ))
                        ) : (
                          // Single selected Outlet with past 6 days side-by-side
                          <th colSpan={datesRange.length} className="p-2 text-center bg-[#5F3C2D] tracking-widest font-black">
                            {OUTLETS.find(o => o.id === selectedOutletFilter)?.name} Historical Stock Timeline
                          </th>
                        )}
                      </tr>

                      {/* Second Row for Dynamic Date Labels when filtered */}
                      {selectedOutletFilter !== 'all' && (
                        <tr className="bg-[#3a1d10] text-[#E4E3O] uppercase text-[9px] tracking-widest text-center border-t border-[#FAF9F5]/20">
                          {datesRange.map((dateStr) => (
                            <th key={dateStr} className="p-2 font-black border-r border-[#FAF9F5]/10 whitespace-nowrap">
                              {getColHeaderLabel(dateStr)}
                            </th>
                          ))}
                        </tr>
                      )}

                      {/* Fallback minimum stock header details */}
                      {selectedOutletFilter === 'all' && (
                        <tr className="bg-[#3a1d10] text-[#FAF9F5]/80 text-[8px] uppercase tracking-wider text-center border-t border-[#FAF9F5]/20 divide-x divide-[#FAF9F5]/10">
                          <th className="p-1 bg-[#371b0f]">S31</th>
                          <th className="p-1 bg-[#371b0f]">S42</th>
                          <th className="p-1 bg-[#371b0f]">S35</th>
                          <th className="p-1 bg-[#371b0f]">S88</th>
                          <th className="p-1 bg-[#2f160a] font-extrabold text-[#FFF]">Total</th>
                        </tr>
                      )}
                    </thead>

                    <tbody className="divide-y divide-stone-200">
                      {filteredItems.map((item, index) => {
                        return (
                          <tr key={item.id} className="hover:bg-[#FAF9F5]/60 transition-colors uppercase divide-x divide-stone-100">
                            {/* Static S.No & Name */}
                            <td className="p-3 text-center bg-stone-50 font-mono font-medium text-stone-500 sticky left-0 z-10 border-r border-stone-200">{item.sNo}</td>
                            <td className="p-3 font-semibold text-[#4F2C1D] sticky left-12 bg-white z-10 border-r border-stone-200">
                              <div className="flex flex-col">
                                <span className="line-clamp-1">{item.name}</span>
                                <span className="text-[9px] opacity-40 font-normal tracking-wide lowercase">{item.category}</span>
                              </div>
                            </td>

                            {/* Minimum stock values */}
                            <td className="p-2 text-center text-stone-600 bg-[#FAF9F5]/20">{item.minStock['31']}</td>
                            <td className="p-2 text-center text-stone-600 bg-[#FAF9F5]/20">{item.minStock['42']}</td>
                            <td className="p-2 text-center text-stone-600 bg-[#FAF9F5]/20">{item.minStock['35']}</td>
                            <td className="p-2 text-center text-stone-600 bg-[#FAF9F5]/20">{item.minStock['88']}</td>
                            <td className="p-2 text-center bg-stone-50 text-[#4F2C1D] font-extrabold">{item.minStock.total}</td>

                            {/* Dynamic Stock Values columns */}
                            {selectedOutletFilter === 'all' ? (
                              OUTLETS.map(outlet => {
                                const stockVal = getClosingValue(currentDate, outlet.id, item.id);
                                const isBelowMin = stockVal < item.minStock[outlet.id as '31' | '42' | '35' | '88'];
                                return (
                                  <td 
                                    key={outlet.id} 
                                    className={`p-3 text-center font-bold font-mono transition-all ${
                                      isBelowMin 
                                        ? 'bg-[#8a2214]/10 text-[#8a2214] border-stone-200' 
                                        : 'bg-green-50/45 text-green-700'
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-11 text-md">
                                      {stockVal === 0 ? '' : stockVal}
                                      {isBelowMin && <AlertTriangle size={11} className="text-[#8a2214]" />}
                                    </div>
                                  </td>
                                );
                              })
                            ) : (
                              // Multi-Day Columns for Single Outlet Filter
                              datesRange.map(dateStr => {
                                const stockVal = getClosingValue(dateStr, selectedOutletFilter, item.id);
                                const isBelowMin = stockVal < item.minStock[selectedOutletFilter as '31' | '42' | '35' | '88'];
                                return (
                                  <td 
                                    key={dateStr}
                                    className={`p-3 text-center font-bold font-mono ${
                                      isBelowMin 
                                        ? 'bg-[#8a2214]/5 text-[#8a2214]' 
                                        : 'bg-green-50/20 text-stone-700'
                                    }`}
                                  >
                                    {stockVal === 0 ? '' : stockVal}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: LIFESPAN & FIFO AND AUTOMATED RETURNS */}
          {activeTab === 'fifo' && (
            <motion.div 
              key="fifo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Rules description Card */}
              <div className="bg-[#4F2C1D]/5 border border-[#4F2C1D]/15 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                <div className="space-y-2">
                  <h3 className="text-[#4F2C1D] text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} /> STRICT OUTLETS LIFESPAN & FIFO MANDATES:
                  </h3>
                  <ul className="text-stone-600 text-xs space-y-1 bg-white/60 p-3 rounded-lg border border-stone-100 uppercase tracking-wide leading-relaxed font-semibold">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#8a2214]"></span> Sec 88 & Sec 35 limits: Only TODAY & YESTERDAY Stock allowed (Max 1 Day old)</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#8a2214]"></span> Sec 42 limits: TODAY, YESTERDAY, & DAY BEFORE YESTERDAY allowed (Max 2 Days old)</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#4F2C1D]"></span> Rollover action: Older stock must triggers returns to Sec 31 instantly when date advances!</li>
                  </ul>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    disabled={isProcessingRollover || expiredReturns.length === 0}
                    onClick={handleExecuteReturnsRollover}
                    className={`px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all ${
                      expiredReturns.length > 0 
                        ? 'bg-[#8a2214] hover:bg-[#8a2214]/90 hover:scale-[1.02]' 
                        : 'bg-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <RotateCcw className={`w-4 h-4 ${isProcessingRollover ? 'animate-spin' : ''}`} />
                    Run Auto FIFO Returns ({expiredReturns.length})
                  </button>
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                    Updates Firestore records instantly
                  </span>
                </div>
              </div>

              {rolloverSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-xs font-black uppercase tracking-widest rounded-xl text-center flex items-center justify-center gap-2 gap-y-1">
                  <CheckCircle size={15} /> {rolloverSuccess}
                </div>
              )}

              {/* OUTLET FIFO BREAKDOWN GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {OUTLETS.filter(o => o.id !== '31').map(outlet => {
                  return (
                    <div key={outlet.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                          <h4 className="text-[#4F2C1D] font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <Activity size={14} /> {outlet.name} FIFO Freshness Tracker
                          </h4>
                          <span className="text-[10px] font-bold text-stone-500 uppercase">
                            Age limits: {outlet.id === '42' ? 'Max 2 Days old' : 'Max 1 Day old'}
                          </span>
                        </div>

                        <div className="space-y-3 mt-4">
                          {filteredItems.map(item => {
                            const batches = getFifoBatches(item.id, outlet.id, currentDate);
                            const expiredForThis = batches.filter(b => {
                              if (b.sourceDate.startsWith('Before')) return false;
                              const age = calcAgeDays(b.sourceDate, currentDate);
                              if ((outlet.id === '88' || outlet.id === '35') && age > 1) return true;
                              if (outlet.id === '42' && age > 2) return true;
                              return false;
                            });

                            if (batches.length === 0) return null;

                            return (
                              <div key={item.id} className="text-xs flex flex-col p-2.5 bg-stone-50 rounded-lg border border-stone-100 hover:border-stone-200 transition-colors">
                                <div className="flex justify-between font-bold text-stone-700 uppercase">
                                  <span>{item.name}</span>
                                  <span className="font-mono bg-stone-200/50 px-1.5 py-0.5 rounded text-[10px]">
                                    Total: {batches.reduce((acc, x) => acc + x.currentRemaining, 0)}
                                  </span>
                                </div>
                                <div className="mt-2 divide-y divide-stone-100">
                                  {batches.map((b, bIdx) => {
                                    const age = calcAgeDays(b.sourceDate, currentDate);
                                    let status = 'Fresh';
                                    let badgeColor = 'bg-green-100 text-green-800';
                                    
                                    if ((outlet.id === '88' || outlet.id === '35') && age > 1) {
                                      status = 'EXPIRED (Pending return)';
                                      badgeColor = 'bg-red-100 text-red-800 font-extrabold';
                                    } else if (outlet.id === '42' && age > 2) {
                                      status = 'EXPIRED (Pending return)';
                                      badgeColor = 'bg-red-100 text-red-800 font-extrabold';
                                    } else if (age > 0) {
                                      status = 'Yesterday\'s Stock';
                                      badgeColor = 'bg-amber-100 text-amber-800';
                                    }

                                    return (
                                      <div key={bIdx} className="py-1 flex justify-between items-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                                        <span>Batch: {b.sourceDate} <span className="opacity-60">({age} days old)</span></span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold font-mono text-stone-700">{b.currentRemaining} units</span>
                                          <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider ${badgeColor}`}>
                                            {status}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* TAB 3: PLANNER & EXPIRED ROTATION */}
          {activeTab === 'planner' && (
            <motion.div 
              key="planner"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Daily Operations Panel */}
              <div className="bg-white border rounded-2xl border-stone-200 p-6 shadow-sm">
                <h3 className="text-[#4F2C1D] font-black text-sm uppercase tracking-widest border-b pb-3 border-stone-100 flex items-center gap-2">
                  <TrendingUp size={16} /> Returns and Dispatch Ledger Summary ({getColHeaderLabel(currentDate)})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  {/* Card 1: Old Returns to Sec 31 */}
                  <div className="p-4 rounded-xl border border-[#FAF9F5] bg-stone-50/70 border-stone-200/50">
                    <h4 className="text-[10px] tracking-widest uppercase font-black text-stone-500">Auto Returned Stock (Sec 31)</h4>
                    <p className="text-3xl font-black text-[#8a2214] mt-2">
                      {expiredReturns.reduce((acc, x) => acc + x.qty, 0)} <span className="text-xs font-normal text-stone-500 lowercase">units</span>
                    </p>
                    <p className="text-[10px] text-stone-400 mt-2 uppercase font-semibold">Stock returned due to FIFO lifespan limits</p>
                  </div>

                  {/* Card 2: Current Active Dispatches */}
                  <div className="p-4 rounded-xl border border-[#FAF9F5] bg-stone-50/70 border-stone-200/50">
                    <h4 className="text-[10px] tracking-widest uppercase font-black text-stone-500">Dispatches ("Hum kya Bhezenge")</h4>
                    <p className="text-3xl font-black text-[#4F2C1D] mt-2">
                      {totalDispatches} <span className="text-xs font-normal text-stone-500 lowercase">units</span>
                    </p>
                    <p className="text-[10px] text-stone-400 mt-2 uppercase font-semibold">Total quantity sent from Base Kitchen to Outlets</p>
                  </div>

                  {/* Card 3: Base Kitchen Production */}
                  <div className="p-4 rounded-xl border border-[#FAF9F5] bg-stone-50/70 border-stone-200/50">
                    <h4 className="text-[10px] tracking-widest uppercase font-black text-stone-500">Base Kitchen Output</h4>
                    <p className="text-3xl font-black text-[#4F2C1D] mt-2">
                      {totalProduction} <span className="text-xs font-normal text-stone-500 lowercase">units</span>
                    </p>
                    <p className="text-[10px] text-stone-400 mt-2 uppercase font-semibold">Total production batches logged in Base Kitchen</p>
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-[#4F2C1D] font-black uppercase text-xs tracking-wider pb-2 border-b border-stone-100">
                    Detailed Returns Log Sheet
                  </h4>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs uppercase divide-y divide-stone-200">
                      <thead>
                        <tr className="text-[10px] font-black text-stone-500 bg-stone-50">
                          <th className="p-3">Source Outlet</th>
                          <th className="p-3">Item Name</th>
                          <th className="p-3">Batch Expiry</th>
                          <th className="p-3">Qty</th>
                          <th className="p-3">Routed To</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {expiredReturns.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-stone-400 italic">
                              No auto-returns needed. All outlet stocks are within FIFO age restrictions.
                            </td>
                          </tr>
                        ) : (
                          expiredReturns.map((entry, index) => {
                            const alreadyRegistered = records[currentDate]?.[ '31' ]?.[entry.item.id]?.transf_in_sources?.some(
                              (x: any) => x.fromOutletId === entry.outletId && x.quantity === entry.qty
                            );

                            return (
                              <tr key={index} className="hover:bg-stone-50 font-semibold text-stone-600">
                                <td className="p-3 text-[#ff0000] font-black">{entry.outletName}</td>
                                <td className="p-3">{entry.item.name}</td>
                                <td className="p-3 font-mono">Date: {entry.batchDate} <span className="opacity-60">({entry.ageDays}d old)</span></td>
                                <td className="p-3 font-mono font-bold text-stone-800">{entry.qty} units</td>
                                <td className="p-3 text-green-700">Sec 31</td>
                                <td className="p-3">
                                  {alreadyRegistered ? (
                                    <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded text-[9px] font-bold">
                                      AUTO REROUTED
                                    </span>
                                  ) : (
                                    <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded text-[9px] font-bold animate-pulse">
                                      PENDING CONCISE REROUTING
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

LedgerSheetComponent.displayName = 'LedgerSheetComponent';
