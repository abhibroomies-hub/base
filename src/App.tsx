/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3, 
  Menu, 
  Search, 
  FileDown, 
  ArrowRight,
  Database,
  History,
  Camera,
  Check,
  LayoutDashboard,
  Settings,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  PlusCircle,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  ChefHat,
  Truck,
  Loader2,
  ShieldCheck,
  Lock,
  Unlock,
  Repeat,
  RefreshCw,
  Bell,
  QrCode,
  Scan,
  Download,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Fuse from 'fuse.js';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfDay, isValid, eachDayOfInterval } from 'date-fns';
import { INITIAL_ITEMS, OUTLETS, Item, PRIORITY_ITEM_NAMES } from './constants';
import { 
  db, 
  auth, 
  OperationType, 
  handleFirestoreError,
  DAILY_RECORDS_COL,
  REQUIREMENTS_COL,
  TRANSFERS_COL,
  COLD_ROOM_COL,
  GLOBAL_WASTAGE_COL,
  DAILY_RECORDS_OLD_COL,
  REQUIREMENTS_OLD_COL,
  TRANSFERS_OLD_COL,
  COLD_ROOM_OLD_COL
} from './lib/firebase';
import { LedgerSheetComponent } from './components/LedgerSheetComponent';
import { 
  collection, 
  doc, 
  addDoc,
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDocs, 
  query, 
  where,
  writeBatch,
  serverTimestamp,
  deleteDoc
} from './lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth';

// --- Types ---
interface DailyData {
  opening: number | string;
  received: number | string;
  transf_in?: number | string;
  transf_in_sources?: Array<{ fromOutletId: string; quantity: number }>;
  sold: number | string;
  testing: number | string;
  returned: number | string;
  wastage?: number | string;
  transf_out: number | string;
  transf_out_to: string; // Target outlet ID
  closing: number | string;
  calculationMode?: 'sold' | 'closing'; // Defaults to 'sold'
}

interface DailyRecord {
  [itemId: string]: DailyData;
}

interface AllRecords {
  [date: string]: {
    [outletId: string]: DailyRecord;
  };
}

interface Requirement {
  outletId: string;
  itemId: string;
  quantity: number;
}

interface Transfer {
  id: string;
  fromOutletId: string;
  toOutletId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  status: 'pending' | 'accepted' | 'rejected';
  date: string;
  createdAt: string;
}

interface DailyRecordInput {
    original: string;
    amount: number;
}

interface OutletPermissions {
  canEditOpening: boolean;
  canEditReceived: boolean;
  canEditReturned: boolean;
  canEditTransfer: boolean;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
}

interface Recipe {
  id: string;
  itemId: string;
  ingredients: {
    ingredientId: string;
    quantity: number;
  }[];
}

type UserRole = 'admin' | 'outlet';
type View = 'dashboard' | 'items' | 'history' | 'reports' | 'management' | 'lifecycle' | 'production' | 'prediction' | 'distribution' | 'recipes' | 'globalClosing' | 'requirements' | 'smartTransfer' | 'ledgerSheet';

// --- Components ---
const Sidebar = React.memo(({ view, setView, selectedOutletId, setSelectedOutletId, onLogout, userRole, isOpen, setIsOpen, onExport }: any) => {
  const menuItems = [
    { id: 'dashboard', label: 'Outlet Console', icon: <LayoutDashboard size={16} />, roles: ['admin', 'outlet', 'manager'] },
    { id: 'ledgerSheet', label: 'Outlets Ledger & Returns', icon: <FileSpreadsheet size={16} />, roles: ['admin', 'outlet', 'manager', 'production'] },
    { id: 'smartTransfer', label: 'Smart Scan Transfer', icon: <Scan size={16} />, roles: ['admin'] },
    { id: 'requirements', label: 'Requirements', icon: <FileSpreadsheet size={16} />, roles: ['admin', 'outlet', 'manager'] },
    { id: 'production', label: 'Kitchen Console', icon: <ChefHat size={16} />, roles: ['admin', 'production'] },
    { id: 'distribution', label: 'Dispatch Log', icon: <Truck size={16} />, roles: ['admin', 'production', 'manager'] },
    { id: 'lifecycle', label: 'Expiry & FIFO', icon: <Clock size={16} />, roles: ['admin', 'manager'] },
    { id: 'prediction', label: 'AI Forecaster', icon: <Sparkles size={16} />, roles: ['admin', 'manager'] },
    { id: 'globalClosing', label: 'Global Stock', icon: <FileSpreadsheet size={16} />, roles: ['admin', 'manager'] },
    { id: 'recipes', label: 'Recipe Studio', icon: <ChefHat size={16} />, roles: ['admin', 'production'] },
    { id: 'history', label: 'History', icon: <History size={16} />, roles: ['admin', 'manager'] },
    { id: 'reports', label: 'Analytics', icon: <BarChart3 size={16} />, roles: ['admin', 'manager'] },
    { id: 'items', label: 'Master Items', icon: <Database size={16} />, roles: ['admin'] },
    { id: 'management', label: 'Approvals', icon: <ShieldCheck size={16} />, roles: ['admin'] },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className={`fixed left-0 top-0 h-screen bg-brand-sidebar border-r border-brand-border flex flex-col z-50 transition-all duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64 md:w-64 shadow-2xl md:shadow-none`}>
        <div className="p-6 border-b border-brand-border bg-brand-text text-brand-bg flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase leading-none">BROOMIES</h1>
            <p className="text-[10px] opacity-70 font-brand-mono uppercase mt-1">
              {userRole === 'admin' ? 'SYSTEM ADMIN' : `OUTLET: ${selectedOutletId}`}
            </p>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest opacity-40 px-4 mb-2 font-bold select-none">System Controls</div>
          {menuItems.filter(item => item.roles.includes(userRole)).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id as View);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-xs font-bold ${
                view === item.id 
                  ? 'bg-brand-text text-brand-bg shadow-lg transform scale-[1.02]' 
                  : 'text-brand-text hover:bg-white hover:translate-x-1'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-brand-border/20">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 transition-all text-[11px] font-black uppercase tracking-widest text-[#8a2214] hover:bg-[#8a2214]/10"
            >
              <LogOut size={16} /> Exit System
            </button>

            {userRole === 'admin' && (
              <button
                onClick={onExport}
                className="w-full flex items-center gap-3 px-4 py-3 transition-all text-[11px] font-black uppercase tracking-widest text-blue-800 hover:bg-blue-50"
              >
                <FileDown size={16} /> Export Backup
              </button>
            )}
          </div>
        </nav>

        {userRole === 'admin' && (
          <div className="p-4 border-t border-brand-border bg-[#CEC9C2]">
            <div className="text-[10px] uppercase font-bold opacity-60 mb-2 px-1">Select Outlet</div>
            <div className="grid grid-cols-2 gap-1 text-center">
              {OUTLETS.map(o => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOutletId(o.id)}
                  className={`py-2 px-1 border border-brand-border text-[10px] font-bold transition-all truncate ${
                    selectedOutletId === o.id ? 'bg-brand-text text-white' : 'bg-white hover:bg-slate-100'
                  }`}
                  title={o.name}
                >
                  {o.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
});

const ManagementComponent = React.memo(({ permissions, updatePermission, setIsSidebarOpen, recalculateStockChain }: any) => {
  return (
    <div className="p-4 md:p-12 bg-white h-full overflow-y-auto">
      <div className="border-b-2 border-brand-text pb-6 mb-8 flex items-center gap-4">
        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center shrink-0">
          <Menu size={20} />
        </button>
        <div>
          <h2 className="text-2xl md:text-4xl font-brand-serif italic mb-1 uppercase tracking-tight">Outlet Approvals</h2>
          <p className="text-[10px] font-bold uppercase tracking-[.3em] opacity-60">Authorize data entry permission</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        <div className="col-span-full border-2 border-dashed border-brand-text/20 p-6 bg-amber-50/30 flex flex-col items-center justify-center text-center">
          <RefreshCw size={32} className="text-brand-text mb-4 opacity-40" />
          <h3 className="text-xl font-brand-serif italic mb-2">System Integrity Tool</h3>
          <p className="text-xs max-w-lg mb-6 opacity-60">If inventory numbers seem mismatched across days (e.g. yesterday's closing doesn't match today's opening), use this tool to re-calculate and synchronize the entire stock chain.</p>
          <button 
            onClick={recalculateStockChain}
            className="px-8 py-3 bg-brand-text text-white font-black uppercase text-xs tracking-[.2em] shadow-xl active:scale-95 transition-all flex items-center gap-3 hover:bg-black"
          >
            <ShieldCheck size={16} /> Recalculate All Opening Balances
          </button>
        </div>
        {OUTLETS.map(outlet => {
          const p = permissions[outlet.id] || { 
            canEditOpening: false, 
            canEditReceived: false, 
            canEditReturned: false, 
            canEditTransfer: false 
          };
          
          return (
            <div key={outlet.id} className="border border-brand-border bg-brand-bg flex flex-col shadow-[10px_10px_0px_rgba(0,0,0,0.02)]">
              <div className="p-4 bg-brand-text text-white flex items-center justify-between">
                <span className="font-brand-mono text-xs font-black tracking-widest uppercase">{outlet.name}</span>
                <ShieldCheck size={14} />
              </div>
              
              <div className="p-6 space-y-4">
                {[
                  { key: 'canEditOpening', label: 'Opening Stock' },
                  { key: 'canEditReceived', label: 'Received (Supply)' },
                  { key: 'canEditReturned', label: 'Returns to Base' },
                  { key: 'canEditTransfer', label: 'Inter-Outlet Transfer' },
                ].map(opt => (
                  <div key={opt.key} className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-tight opacity-70">{opt.label}</span>
                    <button
                      onClick={() => updatePermission(outlet.id, opt.key, !p[opt.key as keyof OutletPermissions])}
                      className={`w-10 h-6 p-1 transition-colors border ${
                        p[opt.key as keyof OutletPermissions] 
                          ? 'bg-brand-text border-brand-text' 
                          : 'bg-white border-brand-border'
                      }`}
                    >
                      <div className={`w-3.5 h-full transition-all ${
                        p[opt.key as keyof OutletPermissions] 
                          ? 'ml-auto bg-white' 
                          : 'bg-brand-border'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-auto p-4 border-t border-brand-border bg-white text-center">
                <p className="text-[9px] font-bold uppercase opacity-50">
                  {Object.values(p).every(v => v === false) ? 'VIEW ONLY MODE' : 'EDIT MODE ACTIVE'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// --- OPTIMIZED CELL FOR ZERO-LAG TYPING ---
const DashboardRowCell = React.memo(({ 
  value, 
  onChange, 
  readOnly, 
  className, 
  onKeyDown,
  dataCol,
  dataRow,
  type = "number",
  placeholder = ""
}: any) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with prop value when prop changes (from external sync or dropdown change)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (localValue !== value) {
        onChange(localValue);
      }
      if (onKeyDown) {
        onKeyDown(e);
      }
    } else if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const displayValue = useMemo(() => {
    if (isFocused) {
      return localValue ?? '';
    }
    return (localValue === 0 || localValue === '0' || localValue === '') ? '' : (localValue ?? '');
  }, [localValue, isFocused]);

  return (
    <input 
      ref={inputRef}
      type={type}
      placeholder={placeholder}
      data-row={dataRow}
      data-col={dataCol}
      readOnly={readOnly}
      className={className}
      value={displayValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDownInternal}
      onWheel={(e) => e.currentTarget.blur()}
    />
  );
});

// --- MODAL TO VIEW TRANSFER SOURCES (RECEIVED FROM OTHER OUTLETS) ---
const TransferSourcesModal = React.memo(({ isOpen, onClose, itemName, sources, onReject }: any) => {
  if (!isOpen || !sources || sources.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-brand-text/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border-2 border-brand-text shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col max-w-md w-full relative overflow-hidden"
      >
        {/* Decorative corner stripe */}
        <div className="h-1.5 bg-indigo-600 w-full" />
        
        {/* Modal Header */}
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-extrabold block">Stock Transfers Received</span>
            <h3 className="font-extrabold text-brand-text uppercase text-sm tracking-tight">{itemName}</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-brand-border/60 hover:bg-slate-100 flex items-center justify-center transition-colors text-brand-text hover:text-black focus:outline-none"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Informative Warning Note about Rejection */}
        <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-sm">
          <p className="text-[9px] font-bold uppercase leading-tight tracking-wider">
            ⚠️ REMOVAL WARNING: Rejecting a transfer completely deletes and reverts it from BOTH the sending outlet and this receiving outlet.
          </p>
        </div>

        {/* Modal Body / Table list of sources */}
        <div className="p-4 flex flex-col gap-3 min-h-[150px] max-h-[300px] overflow-y-auto no-scrollbar">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 grid grid-cols-2 pb-1.5 border-b border-brand-border/40 font-brand-mono">
            <div>Sending Outlet</div>
            <div className="text-right">Quantity Received</div>
          </div>
          
          <div className="flex flex-col gap-2">
            {sources.map((src: any, index: number) => {
              const outletName = OUTLETS.find(o => o.id === src.fromOutletId)?.name || src.fromOutletId;
              return (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2.5 bg-indigo-50/50 hover:bg-indigo-50/80 border border-indigo-100/40 font-brand-mono text-xs text-brand-text transition-colors w-full"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm" />
                    <span className="font-bold text-slate-700">{outletName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-extrabold text-indigo-900 border-l border-indigo-200/50 pl-4 min-w-[40px] text-right text-base">
                      {src.quantity}
                    </div>
                    {onReject && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to reject and revert the transfer of ${src.quantity} items from ${outletName}?`)) {
                            onReject(src.fromOutletId);
                          }
                        }}
                        className="py-1 px-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider shadow-sm transition-all active:scale-95"
                      >
                        REJECT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info/total received */}
        <div className="p-4 bg-slate-50 border-t border-brand-border flex justify-between items-center text-[11px] font-brand-sans">
          <span className="font-bold text-slate-500 uppercase tracking-wider">Total Received</span>
          <span className="text-lg font-black text-indigo-900 font-brand-mono">
            {sources.reduce((total: number, src: any) => total + src.quantity, 0)} Units
          </span>
        </div>
      </motion.div>
    </div>
  );
});

// --- POP-UP MODAL TO CONFIRM/RESOLVE TRANSFERS WITH ADD/REPLACE OPTIONS ---
const TransferConfirmModal = React.memo(({ isOpen, onClose, itemName, destOutletName, inputValue, previousValue, onConfirm }: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-text/65 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border-2 border-brand-text shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col max-w-sm w-full relative overflow-hidden"
      >
        <div className="h-1.5 bg-blue-600 w-full" />
        
        {/* Modal Header */}
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-[#2563EB] font-extrabold block">Transfer Authorization</span>
            <h3 className="font-extrabold text-brand-text uppercase text-xs tracking-tight">{itemName}</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-brand-border/60 hover:bg-slate-100 flex items-center justify-center transition-colors text-brand-text text-sm font-black focus:outline-none"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-slate-50 border border-brand-border/40 p-4 space-y-3 font-brand-mono text-[10px] leading-relaxed">
            <div className="flex justify-between">
              <span className="opacity-60 uppercase font-bold text-[8px]">Destination Outlet:</span>
              <span className="font-extrabold text-brand-text uppercase text-[10px]">{destOutletName}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="opacity-60 uppercase font-bold text-[8px]">New Quantity to Send:</span>
              <span className="font-extrabold text-blue-700 text-sm">{inputValue} Units</span>
            </div>
            
            <div className="pt-2 border-t border-brand-border border-dashed space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="opacity-60 uppercase font-bold text-[8px]">Previous Transfers Today:</span>
                <span className={`font-black ${previousValue > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {previousValue > 0 ? `${previousValue} Units` : 'None'}
                </span>
              </div>
              
              {previousValue > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-sm leading-normal text-[8px] font-bold uppercase">
                  ⚠️ An active record of {previousValue} Units already exists to this outlet today.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => onConfirm('add')}
              className="py-3 px-1.5 bg-brand-text text-white hover:bg-black text-[9px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex flex-col items-center justify-center border border-brand-border"
            >
              <span className="font-black text-[10px]">+ ADD TO PREVIOUS</span>
              <span className="text-[7.5px] opacity-60 font-medium mt-0.5">Grand Total: {previousValue + inputValue}</span>
            </button>
            <button
              onClick={() => onConfirm('replace')}
              className="py-3 px-1.5 bg-white text-brand-text hover:bg-slate-100 text-[9px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex flex-col items-center justify-center border-2 border-brand-text"
            >
              <span className="font-black text-[10px]">= REPlACE PREVIOUS</span>
              <span className="text-[7.5px] opacity-60 font-medium mt-0.5">Grand Total: {inputValue}</span>
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-brand-text text-[9px] font-black uppercase tracking-widest text-center border border-brand-border active:scale-95 transition-all mt-1"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
});

// --- MEMOIZED ROW COMPONENT FOR SMOOTHNESS ---
const DashboardRow = React.memo(({ 
  item, 
  idx, 
  data, 
  canEditField, 
  handleDataChange, 
  handleRowTransferChange,
  handleKeyDown,
  mobileMetric,
  isEven,
  selectedOutletId,
  userRole,
  onShowTransferDetails
}: any) => {
  const calculations = useMemo(() => {
    const opening = Number(data.opening || 0);
    const received = Number(data.received || 0);
    const transf_in = Number(data.transf_in || 0);
    const sold = Number(data.sold || 0);
    const testing = Number(data.testing || 0);
    const returned = Number(data.returned || 0);
    const wastage = Number(data.wastage || 0);
    const transf_out = Number(data.transf_out || 0);
    const closing = Number(data.closing || 0);
    return { opening, received, transf_in, sold, testing, returned, wastage, transf_out, closing };
  }, [data]);

  const effectiveTransfOutTo = useMemo(() => {
    if (data.transf_out_to !== undefined && data.transf_out_to !== '') {
      return data.transf_out_to;
    }
    if (data.transf_out_map) {
      const activeKeys = Object.entries(data.transf_out_map)
        .filter(([_, val]) => Number(val || 0) > 0)
        .map(([k, _]) => k);
      if (activeKeys.length > 0) {
        return activeKeys[0];
      }
    }
    return '';
  }, [data.transf_out_to, data.transf_out_map]);

  const displayedTransfOut = useMemo(() => {
    return effectiveTransfOutTo 
      ? (data.transf_out_map?.[effectiveTransfOutTo] ?? '') 
      : '';
  }, [effectiveTransfOutTo, data.transf_out_map]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group"
    >
      {/* Desktop Row */}
      <div 
        className={`hidden md:grid border-b border-brand-border hover:bg-white transition-colors font-brand-mono text-[11px] ${!isEven ? 'bg-[#F7F7F7]' : ''}`}
        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
      >
        <div className="col-span-3 p-3 flex flex-col justify-center font-brand-sans">
          <span className="font-bold text-brand-text leading-tight">{item.name}</span>
          <span className="text-[9px] uppercase opacity-50 font-bold tracking-tighter">{item.category}</span>
        </div>
        
        <div className="col-span-1 border-l border-brand-border flex items-center justify-center p-0">
          <DashboardRowCell 
            dataRow={idx}
            dataCol="opening"
            readOnly={!canEditField('opening')}
            className={`w-full h-full text-center bg-transparent focus:bg-white outline-none transition-all text-xl font-black ${!canEditField('opening') ? 'opacity-30 cursor-not-allowed' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`} 
            value={data.opening} 
            onChange={(val: any) => handleDataChange(item.id, 'opening', val)}
            onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'opening')}
          />
        </div>

        <div className="col-span-1 border-l border-brand-border flex items-center justify-center p-0 bg-blue-50/20">
          <DashboardRowCell 
            dataRow={idx}
            dataCol="received"
            readOnly={!canEditField('received')}
            className={`w-full h-full text-center bg-transparent focus:bg-white outline-none transition-all font-black text-blue-900 text-xl ${!canEditField('received') ? 'opacity-30 cursor-not-allowed' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`} 
            value={data.received} 
            onChange={(val: any) => handleDataChange(item.id, 'received', val)}
            onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'received')}
          />
        </div>

        {/* TRANS_IN (Received from other outlets) - Dotted line under number, clickable */}
        <div className="col-span-1 border-l border-brand-border flex items-center justify-center p-0 bg-indigo-50/30">
          <button 
            type="button"
            onClick={() => {
              if (data.transf_in_sources && data.transf_in_sources.length > 0) {
                onShowTransferDetails(item.id, item.name, data.transf_in_sources);
              }
            }}
            disabled={!data.transf_in_sources || data.transf_in_sources.length === 0}
            className={`w-full h-full font-black text-xl flex items-center justify-center transition-all ${
              data.transf_in_sources && data.transf_in_sources.length > 0
                ? 'text-indigo-600 bg-indigo-50/60 hover:bg-indigo-150 cursor-pointer underline decoration-dotted decoration-indigo-400' 
                : 'text-slate-400 font-normal cursor-default'
            }`}
          >
            {data.transf_in && Number(data.transf_in) !== 0 ? data.transf_in : ""}
          </button>
        </div>

        <div className="col-span-1 border-l border-brand-border flex items-center justify-center p-0">
          <div className="relative w-full h-full group/cell">
            <DashboardRowCell 
              dataRow={idx}
              dataCol="sold"
              readOnly={!canEditField('sold') || data.calculationMode === 'closing'}
              className={`w-full h-full text-center bg-transparent focus:bg-white outline-none transition-all font-black text-xl ${(!canEditField('sold') || data.calculationMode === 'closing') ? 'opacity-40 cursor-not-allowed bg-slate-100/30' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`} 
              value={data.sold} 
              onChange={(val: any) => handleDataChange(item.id, 'sold', val)}
              onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'sold')}
            />
            {canEditField('sold') && (
              <button 
                onClick={() => handleDataChange(item.id, 'calculationMode', 'sold')}
                className={`absolute inset-y-0 right-0 w-4 flex items-center justify-center transition-opacity ${data.calculationMode === 'sold' ? 'opacity-100 text-brand-text' : 'opacity-0 group-hover/cell:opacity-50'}`}
                title="Switch to Sold Mode"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${data.calculationMode === 'sold' ? 'bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.5)]' : 'bg-slate-300'}`} />
              </button>
            )}
          </div>
        </div>

        <div className="col-span-1 border-l border-brand-border flex items-center justify-center p-0">
          <DashboardRowCell 
            dataRow={idx}
            dataCol="testing"
            readOnly={!canEditField('testing')}
            className={`w-full h-full text-center bg-transparent focus:bg-white outline-none transition-all text-xl font-black ${!canEditField('testing') ? 'opacity-30 cursor-not-allowed' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`} 
            value={data.testing} 
            onChange={(val: any) => handleDataChange(item.id, 'testing', val)}
            onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'testing')}
          />
        </div>

        <div className="col-span-1 border-l border-brand-border flex items-center justify-center p-0 bg-amber-50/10">
          <DashboardRowCell 
            dataRow={idx}
            dataCol="wastage"
            readOnly={!canEditField('wastage')}
            className={`w-full h-full text-center bg-transparent focus:bg-white outline-none transition-all text-xl font-black ${!canEditField('wastage') ? 'opacity-30 cursor-not-allowed bg-slate-50/50' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`} 
            value={data.wastage} 
            onChange={(val: any) => handleDataChange(item.id, 'wastage', val)}
            onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'wastage')}
          />
        </div>

        <div className="col-span-2 border-l border-brand-border flex items-center p-0 gap-0">
          <DashboardRowCell 
            dataRow={idx}
            dataCol="transf_out"
            readOnly={!canEditField('transf_out')}
            placeholder="Qty"
            className={`w-1/2 h-full text-center bg-transparent focus:bg-white outline-none border-r border-brand-border/30 transition-all text-xl font-black ${!canEditField('transf_out') ? 'opacity-30 cursor-not-allowed' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`} 
            value={displayedTransfOut} 
            onChange={(val: any) => handleDataChange(item.id, 'transf_out', val)}
            onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'transf_out')}
          />
          <select 
            disabled={!canEditField('transf_out')}
            className={`w-1/2 h-full text-[9px] bg-transparent focus:bg-white outline-none font-bold uppercase transition-all ${!canEditField('transf_out') ? 'opacity-30 cursor-not-allowed' : 'focus:ring-1 focus:ring-brand-text focus:z-10'}`}
            value={effectiveTransfOutTo}
            onChange={(e) => handleDataChange(item.id, 'transf_out_to', e.target.value)}
          >
            <option value="">Dest</option>
            {userRole === 'admin' && <option value="WASTAGE" className="text-red-600 font-bold">🗑️ WASTAGE</option>}
            {OUTLETS.filter(o => o.id !== selectedOutletId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div className={`col-span-1 border-l border-brand-border p-0 flex items-center justify-center font-black transition-colors ${calculations.closing < 0 ? 'text-red-600 bg-red-50' : 'text-brand-text'}`}>
          <div className="relative w-full h-full group/closing">
            <DashboardRowCell 
              dataRow={idx}
              dataCol="closing"
              readOnly={data.calculationMode === 'sold'}
              className={`w-full h-full text-center bg-transparent focus:bg-white outline-none transition-all text-2xl font-black ${data.calculationMode === 'sold' ? 'opacity-60 cursor-not-allowed' : 'focus:ring-1 focus:ring-brand-text focus:z-10 text-brand-blue'}`} 
              value={data.closing}
              onChange={(val: any) => handleDataChange(item.id, 'closing', val)}
              onKeyDown={(e: any) => handleKeyDown(e, item, idx, 'closing')}
            />
            <button 
              onClick={() => handleDataChange(item.id, 'calculationMode', 'closing')}
              className={`absolute inset-y-0 right-0 w-4 flex items-center justify-center transition-opacity ${data.calculationMode === 'closing' ? 'opacity-100 text-brand-text' : 'opacity-0 group-hover/closing:opacity-50'}`}
              title="Switch to Closing Mode"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${data.calculationMode === 'closing' ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-slate-300'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Row */}
      <div className={`md:hidden flex items-center p-4 border-b border-brand-border transition-colors ${!isEven ? 'bg-[#F7F7F7]' : 'bg-white'}`}>
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="font-bold text-xs text-brand-text uppercase truncate">{item.name}</h4>
          <p className="text-[9px] opacity-40 font-bold tracking-widest">{item.category}</p>
          <div className="mt-1.5 flex gap-3 text-[9px] font-black uppercase text-brand-text/60">
            <span>Open: {data.opening}</span>
            <span className={data.closing < 0 ? 'text-red-600' : ''}>End: {data.closing}</span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <div className="relative">
            {mobileMetric === 'transf_out_to' ? (
              <select 
                disabled={!canEditField('transf_out')}
                className="w-20 h-10 border border-brand-border bg-white text-[10px] font-bold uppercase pl-2 outline-none appearance-none"
                value={effectiveTransfOutTo}
                onChange={(e) => handleDataChange(item.id, 'transf_out_to', e.target.value)}
              >
                <option value="">TO</option>
                {userRole === 'admin' && <option value="WASTAGE">🗑️ WASTE</option>}
                {OUTLETS.filter(o => o.id !== selectedOutletId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : mobileMetric === 'transf_in' ? (
              <button 
                type="button"
                onClick={() => {
                  if (data.transf_in_sources && data.transf_in_sources.length > 0) {
                    onShowTransferDetails(item.id, item.name, data.transf_in_sources);
                  }
                }}
                disabled={!data.transf_in_sources || data.transf_in_sources.length === 0}
                className={`w-20 h-10 border border-brand-border bg-white text-center font-black text-xs outline-none transition-all ${
                  data.transf_in_sources && data.transf_in_sources.length > 0
                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 underline decoration-dotted'
                    : 'text-slate-400'
                }`}
              >
                {data.transf_in || 0}
              </button>
            ) : (
              <div className="relative">
                <DashboardRowCell 
                  dataRow={idx}
                  dataCol={mobileMetric}
                  readOnly={!canEditField(mobileMetric) || (mobileMetric === 'sold' && data.calculationMode === 'closing') || (mobileMetric === 'closing' && data.calculationMode === 'sold')}
                  className={`w-20 h-10 border border-brand-border bg-white text-center font-black text-xs outline-none transition-all focus:ring-2 focus:ring-brand-text ${(!canEditField(mobileMetric) || (mobileMetric === 'sold' && data.calculationMode === 'closing') || (mobileMetric === 'closing' && data.calculationMode === 'sold')) ? 'opacity-30' : ''}`}
                  value={mobileMetric === 'transf_out' ? displayedTransfOut : data[mobileMetric]}
                  onChange={(val: any) => handleDataChange(item.id, mobileMetric, val)}
                  onKeyDown={(e: any) => handleKeyDown(e, item, idx, mobileMetric)}
                />
                {(mobileMetric === 'sold' || mobileMetric === 'closing') && (
                  <button 
                    onClick={() => handleDataChange(item.id, 'calculationMode', mobileMetric)}
                    className="absolute -top-3 -left-3 w-6 h-6 bg-white border border-brand-border rounded-full flex items-center justify-center shadow-sm z-10"
                  >
                    <div className={`w-2 h-2 rounded-full ${data.calculationMode === mobileMetric ? 'bg-green-600' : 'bg-slate-300'}`} />
                  </button>
                )}
              </div>
            )}
            <div className="absolute -top-2 -right-1 bg-brand-text text-white text-[7px] px-1 font-bold rounded uppercase">
              {mobileMetric.replace('transf_out', 'XFER')}
            </div>
          </div>
          {mobileMetric !== 'transf_in' && (
            <button 
               onClick={() => {
                  if (mobileMetric === 'sold' && data.calculationMode === 'closing') return;
                  if (mobileMetric === 'closing' && data.calculationMode === 'sold') return;
                  const currentVal = mobileMetric === 'transf_out' ? Number(displayedTransfOut || 0) : Number(data[mobileMetric] || 0);
                  handleDataChange(item.id, mobileMetric, currentVal + 1);
               }}
               disabled={(!canEditField(mobileMetric) || (mobileMetric === 'sold' && data.calculationMode === 'closing') || (mobileMetric === 'closing' && data.calculationMode === 'sold'))}
               className={`w-10 h-10 bg-brand-text text-white flex items-center justify-center active:scale-90 transition-transform shadow-md rounded-sm ${(!canEditField(mobileMetric) || (mobileMetric === 'sold' && data.calculationMode === 'closing') || (mobileMetric === 'closing' && data.calculationMode === 'sold')) ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.idx === next.idx &&
    prev.isEven === next.isEven &&
    prev.mobileMetric === next.mobileMetric &&
    prev.selectedOutletId === next.selectedOutletId &&
    prev.userRole === next.userRole &&
    prev.data === next.data &&
    prev.onShowTransferDetails === next.onShowTransferDetails
  );
});

const DashboardComponent = React.memo(({
  items,
  records,
  currentDate,
  selectedOutletId,
  dashboardSearch,
  bulkText,
  bulkMode,
  bulkAction,
  setBulkText,
  setBulkMode,
  setBulkAction,
  setDashboardSearch,
  handleDataChange,
  handleRejectTransferReceived,
  saveDailyData,
  handleSaveAndNextDay,
  handleRolloverPreviousClosing,
  handleBulkEntry,
  getPreviousClosing,
  getCurrentRecords,
  setCurrentDate,
  isDirty,
  isProcessingAI,
  userRole,
  outletPermissions,
  legacyDataFound,
  migrationLoading,
  migrateLegacyData,
  setIsSidebarOpen,
  setSelectedOutletId,
  parserEngine,
  setParserEngine,
  setShowSyncModal,
}: any) => {
  const [mobileMetric, setMobileMetric] = useState<string>('sold');
  const [selectedTransfer, setSelectedTransfer] = useState<{ itemId: string; itemName: string; sources: any[] } | null>(null);

  const handleRejectSource = useCallback(async (fromOutletId: string) => {
    if (selectedTransfer && handleRejectTransferReceived) {
      await handleRejectTransferReceived(selectedTransfer.itemId, fromOutletId);
      const remaining = selectedTransfer.sources.filter(s => s.fromOutletId !== fromOutletId);
      if (remaining.length === 0) {
        setSelectedTransfer(null);
      } else {
        setSelectedTransfer({
          ...selectedTransfer,
          sources: remaining
        });
      }
    }
  }, [selectedTransfer, handleRejectTransferReceived]);

  const currentRecs = getCurrentRecords();
  const [stableItems, setStableItems] = useState<any[]>([]);

  const performSort = useCallback((data: any) => {
    const getCategoryWeight = (category: string) => {
      const cat = (category || "").toLowerCase();
      if (cat.includes('cake')) return 1;
      if (cat.includes('pastries')) return 2;
      if (cat.includes('cookie')) return 3;
      return 4;
    };

    const sorted = [...items]
      .filter((i: any) => i.status !== 'inactive')
      .sort((a, b) => {
      const getCategoryWeight = (category: string) => {
        const cat = (category || "").toLowerCase();
        if (cat.includes('cake')) return 1;
        if (cat.includes('pastries')) return 2;
        if (cat.includes('cookie')) return 3;
        return 4;
      };

      const dataA = data[a.id];
      const dataB = data[b.id];
      
      // Stock Priority logic: Items with specifically OPENING stock go to absolute top
      // Then items with any stock (received/produced)
      const openingA = dataA?.opening || 0;
      const openingB = dataB?.opening || 0;
      
      // 0. Absolute Priority Item Rank
      const priorityIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
      const priorityIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
      
      if (priorityIndexA !== -1 || priorityIndexB !== -1) {
        const valA = priorityIndexA === -1 ? 9999 : priorityIndexA;
        const valB = priorityIndexB === -1 ? 9999 : priorityIndexB;
        if (valA !== valB) return valA - valB;
      }
      
      if (openingA > 0 && openingB === 0) return -1;
      if (openingA === 0 && openingB > 0) return 1;

      const stockA = (dataA?.opening || 0) + (dataA?.received || 0);
      const stockB = (dataB?.opening || 0) + (dataB?.received || 0);
      
      const hasStockA = stockA > 0 ? 1 : 0;
      const hasStockB = stockB > 0 ? 1 : 0;

      // 1. Primary: Global Stock Status (All stocked items first)
      if (hasStockA !== hasStockB) return hasStockB - hasStockA;

      // 2. Secondary: Category Grouping
      const weightA = getCategoryWeight(a.category);
      const weightB = getCategoryWeight(b.category);
      if (weightA !== weightB) return weightA - weightB;

      // 3. Tertiary: Alphabetical Name
      return a.name.localeCompare(b.name);
    });
    setStableItems(sorted);
  }, [items, currentDate, selectedOutletId, getPreviousClosing]);

  // Initial sort and sort on context change
  useEffect(() => {
    const data = getCurrentRecords();
    performSort(data);
  }, [currentDate, selectedOutletId, items]); // removed performSort dependency to prevent reactive loops

  // Re-sort ONLY after successful save
  const prevDirtyRef = useRef(isDirty);
  useEffect(() => {
    if (prevDirtyRef.current === true && isDirty === false) {
      const data = getCurrentRecords();
      performSort(data);
    }
    prevDirtyRef.current = isDirty;
  }, [isDirty, getCurrentRecords, performSort]);
  
  const MOBILE_METRICS = [
    { id: 'opening', label: 'Opening' },
    { id: 'received', label: 'Supply' },
    { id: 'transf_in', label: 'O.Rec' },
    { id: 'sold', label: 'Sold' },
    { id: 'testing', label: 'Test' },
    { id: 'wastage', label: 'Waste' },
    { id: 'transf_out', label: 'Xfer' },
    { id: 'closing', label: 'Closing' }
  ];

  const canEditField = useCallback((field: string) => {
    if (userRole === 'admin') return true;
    
    // Allow history editing if authorized
    const isToday = currentDate === format(new Date(), 'yyyy-MM-dd');
    
    const p = outletPermissions || { 
      canEditOpening: false, 
      canEditReceived: false, 
      canEditReturned: false, 
      canEditTransfer: false 
    };
    
    if (field === 'opening') return true;
    if (field === 'received') return p.canEditReceived;
    if (field === 'returned') return p.canEditReturned;
    if (field === 'transf_out' || field === 'transf_out_to') return p.canEditTransfer;
    
    // Standard fields (Sold, Testing, Closing) are always editable for the active day
    // AND we now allow them for previous days too as per user request
    if (field === 'sold' || field === 'testing' || field === 'closing') return true; 
    
    if (field === 'wastage') return userRole === 'admin';
    
    return false;
  }, [userRole, currentDate, outletPermissions]);

  const sortedItems = useMemo(() => {
    const base = stableItems.length > 0 ? stableItems : items;
    if (!dashboardSearch.trim()) return base;
    return base.filter((item: any) => 
      item.name.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(dashboardSearch.toLowerCase())
    );
  }, [stableItems, items, dashboardSearch]);

  const exportDashboardPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const outletName = OUTLETS.find(o => o.id === selectedOutletId)?.name || 'OUTLET';
    
    doc.setFontSize(18);
    doc.text(`${outletName.toUpperCase()} - STOCK REPORT`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Date: ${currentDate}`, 14, 22);

    const tableData = sortedItems.map((item: any) => {
      const data = currentRecs[item.id] || {};
      const opening = Number(data.opening || 0);
      const received = Number(data.received || 0);
      const sold = Number(data.sold || 0);
      const testing = Number(data.testing || 0);
      const wastage = Number(data.wastage || 0);
      const transf_out = Number(data.transf_out || 0);
      const closing = opening + received - sold - testing - wastage - transf_out;

      return [
        item.name,
        opening,
        received,
        sold,
        testing,
        wastage,
        transf_out,
        closing
      ];
    }).filter(row => {
      // Check if any value from index 1 to 7 is non-zero
      return row.slice(1).some(val => Number(val) !== 0);
    });

    autoTable(doc, {
      startY: 28,
      head: [['Item Name', 'Opening', 'Supply', 'Sold', 'Test', 'Waste', 'Xfer', 'Closing']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 }
      }
    });

    doc.save(`${outletName.toLowerCase()}-report-${currentDate}.pdf`);
  }, [selectedOutletId, currentDate, sortedItems, currentRecs]);

  const outletName = OUTLETS.find(o => o.id === selectedOutletId)?.name || '';

  const handleKeyDown = useCallback((e: React.KeyboardEvent, item: any, rowIdx: number, colKey: string) => {
    const columns = ['opening', 'received', 'sold', 'testing', 'wastage', 'transf_out', 'closing'];

    if (e.key === 'Enter') {
      e.preventDefault();
      // On small screens, move down. On wide screens, try to move right or down.
      // High-speed data entry: Move to next row
      const nextRow = document.querySelector(`input[data-row="${rowIdx + 1}"][data-col="${colKey}"]`) as HTMLInputElement;
      if (nextRow) {
        nextRow.focus();
        nextRow.select(); // Better UX for editing
      } else {
        // Wrap around to first row? No, maybe try next column
        const nextColIdx = columns.indexOf(colKey) + 1;
        if (nextColIdx < columns.length) {
           const firstRowNextCol = document.querySelector(`input[data-row="0"][data-col="${columns[nextColIdx]}"]`) as HTMLInputElement;
           if (firstRowNextCol) {
             firstRowNextCol.focus();
             firstRowNextCol.select();
           }
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = document.querySelector(`input[data-row="${rowIdx + 1}"][data-col="${colKey}"]`) as HTMLInputElement;
      if (nextRow) nextRow.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = document.querySelector(`input[data-row="${rowIdx - 1}"][data-col="${colKey}"]`) as HTMLInputElement;
      if (prevRow) prevRow.focus();
    } else if (e.key === 'ArrowRight') {
      const currentColIdx = columns.indexOf(colKey);
      if (currentColIdx < columns.length - 1) {
        const nextCol = columns[currentColIdx + 1];
        const sameRowNextCol = document.querySelector(`input[data-row="${rowIdx}"][data-col="${nextCol}"]`) as HTMLInputElement;
        if (sameRowNextCol) sameRowNextCol.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      const currentColIdx = columns.indexOf(colKey);
      if (currentColIdx > 0) {
        const prevCol = columns[currentColIdx - 1];
        const sameRowPrevCol = document.querySelector(`input[data-row="${rowIdx}"][data-col="${prevCol}"]`) as HTMLInputElement;
        if (sameRowPrevCol) sameRowPrevCol.focus();
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Responsive Header Bar */}
      <header className="min-h-[64px] border-b border-brand-border bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between px-4 md:px-8 shrink-0 py-2 md:py-0 gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 text-brand-text hover:bg-brand-bg rounded-lg active:scale-95 transition-all"
          >
            <Menu size={24} />
          </button>
        <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4">
            <div className="flex items-center gap-2">
              <select 
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="font-brand-serif italic text-lg md:text-2xl text-brand-text bg-transparent outline-none cursor-pointer hover:bg-slate-50"
              >
                {OUTLETS.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="bg-transparent border-none text-[10px] md:text-xs font-brand-mono opacity-60 w-24 md:w-28 outline-none"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
              />
              <Calendar size={12} className="opacity-30" />
            </div>
          </div>
        </div>

        <div className="flex flex-1 md:flex-none items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 text-brand-text opacity-30 group-focus-within:opacity-100 transition-opacity" />
            <input 
              type="text"
              id="dashboard-search-input"
              placeholder="Search Items..."
              className="w-full h-8 md:h-9 pl-8 md:pl-9 pr-4 bg-brand-bg border border-brand-border text-[11px] font-bold outline-none focus:ring-1 focus:ring-brand-text"
              value={dashboardSearch}
              onChange={(e) => setDashboardSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1 md:gap-2 shrink-0">
            <button 
              onClick={() => {
                window.location.reload();
              }}
              title="Refresh Sheet"
              className="px-3 md:px-4 py-1.5 border border-brand-border text-[10px] md:text-[11px] font-bold hover:bg-slate-50 transition-colors uppercase whitespace-nowrap bg-white flex items-center gap-2 text-brand-text active:scale-95 duration-100"
            >
              <RefreshCw size={12} className="animate-[spin_4s_linear_infinite]" />
              Refresh Sheet
            </button>
            <button 
              onClick={() => setShowSyncModal(true)}
              title="Sync Data between Published & Preview site"
              className="px-3 md:px-4 py-1.5 border border-blue-200 text-[10px] md:text-[11px] font-bold bg-blue-50/50 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors uppercase whitespace-nowrap flex items-center gap-2 active:scale-95 duration-100"
            >
              <Database size={12} />
              Sync / Backup
            </button>
            <button 
              onClick={exportDashboardPDF}
              className="px-3 md:px-4 py-1.5 border border-brand-border text-[10px] md:text-[11px] font-bold hover:bg-slate-50 transition-colors uppercase whitespace-nowrap bg-white flex items-center gap-2"
            >
              <Download size={14} />
              Export PDF
            </button>
            <button 
              onClick={saveDailyData} 
              className="relative px-3 md:px-4 py-1.5 border border-brand-border text-[10px] md:text-[11px] font-bold hover:bg-brand-text hover:text-white transition-colors uppercase whitespace-nowrap bg-white"
            >
              {isDirty && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white animate-bounce" />
              )}
              Save
            </button>
            <button 
              onClick={handleRolloverPreviousClosing} 
              title="Copy previous day's closing stock as today's opening stock in 1 click"
              className="px-3 md:px-4 py-1.5 border border-amber-300 text-[10px] md:text-[11px] font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors uppercase whitespace-nowrap flex items-center gap-1.5 active:scale-95 duration-100"
            >
              <RefreshCw size={11} className="text-amber-700" />
              Prev Closing ➔ Opening
            </button>
            <button 
              onClick={handleSaveAndNextDay} 
              className="px-3 md:px-4 py-1.5 bg-brand-text text-white text-[10px] md:text-[11px] font-bold hover:bg-opacity-90 uppercase whitespace-nowrap"
            >
              Next Day
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Metric Selector */}
      <div className="md:hidden bg-white border-b border-brand-border px-4 py-2 overflow-x-auto no-scrollbar sticky top-0 z-30 shadow-sm">
        <div className="flex gap-2 min-w-max">
          {MOBILE_METRICS.map(m => (
            <button
              key={m.id}
              onClick={() => setMobileMetric(m.id)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border transition-all ${
                mobileMetric === m.id 
                  ? 'bg-brand-text text-white border-brand-text' 
                  : 'bg-white text-brand-text border-brand-border border-dashed opacity-60'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {legacyDataFound && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mx-4 md:mx-6 mt-4 md:mt-6 border-2 border-brand-text bg-white p-4 md:p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)] md:shadow-[10px_10px_0px_rgba(0,0,0,1)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-text"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-text text-white flex items-center justify-center shrink-0">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest mb-1 italic">Old Records Found</h3>
                <p className="text-[10px] md:text-[11px] font-medium opacity-70 leading-relaxed max-w-xl">
                  Local memory data available. Restore to sync with Cloud.
                </p>
              </div>
            </div>
            <button
              onClick={migrateLegacyData}
              disabled={migrationLoading}
              className={`px-6 md:px-8 py-2 md:py-3 bg-brand-text text-white text-[10px] md:text-[11px] font-black uppercase tracking-[.2em] shadow-lg flex items-center justify-center gap-3 ${migrationLoading ? 'opacity-50' : ''}`}
            >
              {migrationLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              Restore Data
            </button>
          </div>
        </motion.div>
      )}

      {/* AI Section - Compact on mobile */}
      <section className="p-4 md:p-6 border-b border-brand-border bg-brand-secondary shrink-0">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch md:items-start">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] md:text-[10px] uppercase font-bold opacity-60">Smart Bulk Entry</label>
              <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 border border-blue-200 rounded text-[9px] md:text-[10px] text-blue-700 font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                🤖 DeepSeek AI V3 Enabled
              </div>
            </div>
            <textarea 
              className="w-full h-16 md:h-20 p-3 bg-white border border-brand-border font-brand-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-text resize-none shadow-inner"
              placeholder="Type in any format or language (e.g. 'give four truffles, 1 pineapple, and black forest 3'). DeepSeek AI will parse it instantly!"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
          </div>
          <div className="w-full md:w-80 grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-3">
            <div>
              <select 
                className="w-full p-2 bg-white border border-brand-border text-[10px] font-black uppercase tracking-tighter"
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value as any)}
              >
                {MOBILE_METRICS.filter(m => m.id !== 'closing').map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <select 
                className="w-full p-2 bg-white border border-brand-border text-[10px] font-black uppercase tracking-tighter"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as any)}
              >
                <option value="add">Add (+)</option>
                <option value="replace">Replace (=)</option>
              </select>
            </div>
            <button 
              onClick={handleBulkEntry}
              disabled={isProcessingAI || !bulkText.trim()}
              className="h-[34px] px-4 col-span-2 bg-brand-text text-white hover:bg-opacity-90 active:scale-95 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {isProcessingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Process Entry
            </button>
          </div>
        </div>
      </section>

      {/* Main Data Feed */}
      <section className="flex-1 overflow-hidden flex flex-col bg-brand-bg/60 backdrop-blur-sm">
        {/* Desktop Headings */}
        <div 
          className="hidden md:grid bg-brand-text text-white text-[10px] uppercase font-bold tracking-wider shrink-0 sticky top-0 z-20"
          style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
        >
          <div className="col-span-3 p-3 border-r border-[#E4E3E033]">Description</div>
          <div className="col-span-1 p-3 text-center border-r border-[#E4E3E033]">Open</div>
          <div className="col-span-1 p-3 text-center border-r border-[#E4E3E033]">Recv</div>
          <div className="col-span-1 p-3 text-center border-r border-[#E4E3E033] bg-indigo-900/40">O.Rec</div>
          <div className="col-span-1 p-3 text-center border-r border-[#E4E3E033]">Sold</div>
          <div className="col-span-1 p-3 text-center border-r border-[#E4E3E033]">Test</div>
          <div className="col-span-1 p-3 text-center border-r border-[#E4E3E033]">Waste</div>
          <div className="col-span-2 p-3 text-center border-r border-[#E4E3E033]">Transfer</div>
          <div className="col-span-1 p-3 text-center">End</div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {sortedItems.map((item: any, idx: number) => {
            const rawData = currentRecs[item.id] || {};
            const opening = Number(rawData.opening ?? getPreviousClosing(item.id, currentDate, selectedOutletId) ?? 0);
            const received = Number(rawData.received ?? 0);
            const transf_in = Number(rawData.transf_in ?? 0);
            const testing = Number(rawData.testing ?? 0);
            const returned = Number(rawData.returned ?? 0);
            const wastage = Number(rawData.wastage ?? 0);
            const transf_out = Number(rawData.transf_out ?? 0);
            const mode = rawData.calculationMode || 'sold';
            
            let sold = Number(rawData.sold ?? 0);
            let closing = Number(rawData.closing ?? 0);

            // If it's a fresh row with no data, calculate default closing
            if (Object.keys(rawData).length === 0) {
              closing = opening + received + transf_in - testing - returned - transf_out;
            } else if (mode === 'sold') {
              closing = opening + received + transf_in - sold - testing - returned - transf_out;
            } else {
              sold = (opening + received + transf_in) - (testing + returned + transf_out + closing);
            }

            const data = {
              opening,
              received,
              transf_in,
              transf_in_sources: rawData.transf_in_sources || [],
              sold,
              testing,
              returned,
              wastage,
              transf_out,
              transf_out_to: rawData.transf_out_to || '',
              transf_out_map: rawData.transf_out_map || {},
              closing,
              calculationMode: mode
            };
            
            const isEven = idx % 2 === 0;

            return (
              <DashboardRow 
                key={item.id}
                item={item}
                idx={idx}
                data={data}
                isEven={isEven}
                mobileMetric={mobileMetric}
                canEditField={canEditField}
                handleDataChange={handleDataChange}
                handleKeyDown={handleKeyDown}
                userRole={userRole}
                onShowTransferDetails={(itemId: string, name: string, sources: any[]) => setSelectedTransfer({ itemId, itemName: name, sources })}
              />
            );
          })}
        </div>
      </section>

      {/* Footer - Mini on Mobile */}
      <footer className="h-10 md:h-10 bg-brand-text text-white flex items-center px-4 md:px-6 justify-between text-[9px] md:text-[10px] font-brand-mono shrink-0">
        <div className="hidden md:flex gap-6">
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400"></span> ACTIVE</span>
          <span className="uppercase font-bold tracking-widest">{OUTLETS.length} Outlets Verified</span>
        </div>
        <div className="flex-1 md:flex-none flex items-center justify-between md:justify-end gap-4 uppercase font-bold tracking-[.15em]">
          <span className="md:opacity-60">{items.length} Items</span>
          <span className="opacity-30">|</span>
          <span className="opacity-60 hidden md:block">Session: {currentDate}</span>
          <span>Broomies V3</span>
        </div>
      </footer>

      {/* Pop-up Overlay for Transfer Sources Details */}
      <AnimatePresence>
        {selectedTransfer && (
          <TransferSourcesModal 
            isOpen={!!selectedTransfer}
            itemName={selectedTransfer.itemName}
            sources={selectedTransfer.sources}
            onReject={handleRejectSource}
            onClose={() => setSelectedTransfer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

const QRThumb = React.memo(({ barcode }: { barcode?: string }) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (barcode) {
      QRCode.toDataURL(barcode, { margin: 1, width: 60 }).then(setQrUrl).catch(console.error);
    }
  }, [barcode]);

  if (!barcode) return <div className="w-12 h-12 border border-dashed border-brand-border" />;

  return (
    <div className="w-12 h-12 bg-white border border-brand-border p-1 flex items-center justify-center">
      {qrUrl ? <img src={qrUrl} alt="QR" className="w-full h-full" /> : <div className="w-full h-full bg-slate-50 animate-pulse" />}
    </div>
  );
});

const QRItem = React.memo(({ item }: { item: any }) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (item.barcode) {
      QRCode.toDataURL(item.barcode, { 
        margin: 2, 
        width: 200,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(setQrUrl).catch(console.error);
    }
  }, [item.barcode]);

  return (
    <div className="bg-white border border-brand-border p-4 flex flex-col items-center justify-between shadow-sm hover:shadow-md transition-all text-center gap-2 group">
      <div className="w-full aspect-square bg-white flex items-center justify-center border p-1 group-hover:border-brand-text transition-colors overflow-hidden">
        {qrUrl ? (
          <img 
            src={qrUrl}
            alt="QR"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="animate-pulse bg-slate-100 w-full h-full" />
        )}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-tight line-clamp-2 h-7">{item.name}</div>
      <div className="text-[8px] font-brand-mono opacity-50">{item.barcode}</div>
    </div>
  );
});

const MasterItemsComponent = React.memo(({
  items,
  setItems,
  setIsDirty,
  catalogSearch,
  setCatalogSearch,
  setIsSidebarOpen,
}: any) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Others');
  const categories = useMemo(() => Array.from(new Set(items.map((i: any) => i.category))).sort() as string[], [items]);

  const filteredCatalog = useMemo(() => {
    let result = items;
    if (catalogSearch.trim()) {
      result = items.filter((item: any) => 
        item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(catalogSearch.toLowerCase()))
      );
    }

    return [...result].sort((a, b) => {
      // 0. Absolute Priority Item Rank
      const pIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
      const pIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
      
      if (pIndexA !== -1 || pIndexB !== -1) {
        const valA = pIndexA === -1 ? 9999 : pIndexA;
        const valB = pIndexB === -1 ? 9999 : pIndexB;
        if (valA !== valB) return valA - valB;
      }
      
      return a.name.localeCompare(b.name);
    });
  }, [items, catalogSearch]);

  const addItem = () => {
    if (!newItemName.trim()) return;
    setIsDirty(true);
    
    // Automatically generate a barcode if not provided
    const id = Date.now().toString();
    const barcode = newItemBarcode.trim() || `BR${id.slice(-6)}`;
    
    const newItem: any = {
      id,
      name: newItemName.toUpperCase(),
      barcode,
      category: newItemCategory,
      status: 'active'
    };
    
    setItems([...items, newItem]);
    setNewItemName('');
    setNewItemBarcode('');
  };

  const updateItemBarcode = (itemId: string, barcode: string) => {
    setItems(items.map((i: any) => i.id === itemId ? { ...i, barcode } : i));
  };

  const toggleItemStatus = (item: any) => {
    const newStatus = item.status === 'inactive' ? 'active' : 'inactive';
    const updatedItem = { ...item, status: newStatus };
    
    setItems(items.map((i: any) => i.id === item.id ? updatedItem : i));
  };

  const deleteItem = (id: string) => {
    if (confirm('Are you sure? This will permanently delete the item from the catalog.')) {
      setItems(items.filter((i: any) => i.id !== id));
    }
  };

  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'qr' | 'ai'>('list');
  const [isExportingQR, setIsExportingQR] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  
  // Camera & AI matching states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>('');
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startWebcam = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Camera failed to load:", err);
      setCameraError("Webcam stream is restricted or unavailable here. Please use the device camera button below!");
    }
  };

  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Make sure we stop stream on unmount or view change
  useEffect(() => {
    if (viewMode !== 'ai') {
      stopWebcam();
    }
  }, [viewMode, stopWebcam]);

  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImage(dataUrl);
        stopWebcam();
        analyzeCake(dataUrl);
      }
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setCapturedImage(dataUrl);
        stopWebcam();
        analyzeCake(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeCake = async (base64Image: string) => {
    setIsProcessing(true);
    setAiAnalysisResult(null);
    
    const stages = [
      "Connecting to our AI Pastry Chef...",
      "Analyzing visual shape and structure...",
      "Matching icing decorative patterns...",
      "Checking texture and color mapping against master list..."
    ];
    let stageIdx = 0;
    setActiveStage(stages[0]);
    const interval = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      setActiveStage(stages[stageIdx]);
    }, 2000);

    try {
      const response = await fetch('/api/gemini/identify-cake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          items: items
        })
      });

      if (!response.ok) {
        throw new Error("Server model failure to analyze cake");
      }

      const result = await response.json();
      setAiAnalysisResult(result);
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      setAiAnalysisResult({
        isConfident: false,
        reasoning: "Sorry, AI could not identify this cake due to an error. Press 'Search Manual' or create a clean custom item below!",
        suggestedName: '',
        suggestedCategory: 'Classic Cakes',
        error: true
      });
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  };

  const addSuggestedItem = (name: string, category: string) => {
    if (!name) return;
    const cleanName = name.trim().toUpperCase();
    
    setIsDirty(true);
    const id = Date.now().toString();
    const barcode = `BR${id.slice(-6)}`;
    
    const newItem: any = {
      id,
      name: cleanName,
      barcode,
      category: category || 'Classic Cakes',
      status: 'active'
    };
    
    setItems((prev: any) => [...prev, newItem]);
    setHighlightedItemId(newItem.id);
    setViewMode('list');
    setAiAnalysisResult(null);
    setCapturedImage(null);
    setCatalogSearch('');
  };

  const matchedCustomItem = useMemo(() => {
    if (!aiAnalysisResult?.matchedItemId) return null;
    return items.find((i: any) => i.id === aiAnalysisResult.matchedItemId);
  }, [aiAnalysisResult, items]);

  const searchResults = useMemo(() => {
    if (!searchFilter.trim()) return items.slice(0, 8);
    return items.filter((item: any) => 
      item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(searchFilter.toLowerCase())
    ).slice(0, 15);
  }, [items, searchFilter]);

  const generateMissingBarcodes = async () => {
    const missingCount = items.filter((i: any) => !i.barcode).length;
    if (missingCount === 0) {
      alert("All items already have barcodes.");
      return;
    }

    if (!confirm(`This will generate unique barcodes for ${missingCount} items. We will try to use official barcodes from the master list where available. Continue?`)) return;
    
    const updatedItems = [...items];
    let count = 0;

    for (let i = 0; i < updatedItems.length; i++) {
      if (!updatedItems[i].barcode) {
        // Try to find matching barcode in INITIAL_ITEMS first
        const initialMatch = INITIAL_ITEMS.find(initial => 
          initial.id === updatedItems[i].id || 
          initial.name.toUpperCase() === updatedItems[i].name.toUpperCase()
        );
        
        const barcode = initialMatch?.barcode || `BR${updatedItems[i].id.slice(-6)}`;
        updatedItems[i] = { ...updatedItems[i], barcode };
        count++;
      }
    }

    if (count > 0) {
      setItems(updatedItems);
      alert(`Successfully synchronized barcodes for ${count} items.`);
    }
  };

  const exportQRLabels = async () => {
    setIsExportingQR(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const columns = 6;
      const rows = 9; // 54 labels per page for better spacing
      const labelWidth = (pageWidth - (2 * margin)) / columns;
      const labelHeight = (pageHeight - (2 * margin)) / rows;
      const qrSize = labelWidth * 0.7; 

      let x = margin;
      let y = margin;
      let count = 0;

      const activeItems = finalFilteredCatalog.filter((i: any) => i.barcode);

      for (const item of activeItems) {
        if (count > 0 && count % (columns * rows) === 0) {
          doc.addPage();
          x = margin;
          y = margin;
        }

        const qrDataUrl = await QRCode.toDataURL(item.barcode, { 
          margin: 1,
          width: 300,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' }
        });

        doc.setDrawColor(220, 220, 220);
        doc.rect(x, y, labelWidth, labelHeight);
        doc.addImage(qrDataUrl, 'PNG', x + (labelWidth - qrSize) / 2, y + 2, qrSize, qrSize);

        doc.setFontSize(6);
        doc.setTextColor(0, 0, 0);
        const nameLines = doc.splitTextToSize(item.name, labelWidth - 4);
        doc.text(nameLines, x + labelWidth / 2, y + qrSize + 6, { align: 'center' });
        
        doc.setFontSize(5);
        doc.text(item.barcode, x + labelWidth / 2, y + labelHeight - 2, { align: 'center' });

        x += labelWidth;
        count++;

        if (count % columns === 0) {
          x = margin;
          y += labelHeight;
        }
      }

      doc.save(`BROOMIES_QR_LABELS_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    } catch (error) {
      console.error("QR Export Error:", error);
      alert("Failed to generate QR PDF");
    } finally {
      setIsExportingQR(false);
    }
  };

  const finalFilteredCatalog = useMemo(() => {
    let result = filteredCatalog;
    if (!showInactive) {
      result = result.filter((i: any) => i.status !== 'inactive');
    }
    return result;
  }, [filteredCatalog, showInactive]);

  const exportItemsPDF = useCallback(() => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text('MASTER ITEM CATALOG', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 22);

    const headers = [['#', 'Category', 'Item Description', 'Barcode', 'Status']];
    const body = finalFilteredCatalog.map((item: any, idx: number) => [
      idx + 1,
      item.category,
      item.name,
      item.barcode || '-',
      item.status?.toUpperCase() || 'ACTIVE'
    ]);

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { cellWidth: 100 },
        3: { cellWidth: 30 }
      }
    });

    doc.save(`master-items-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }, [finalFilteredCatalog]);

  return (
    <div className="mx-auto p-4 md:p-12 bg-white border-brand-border h-full overflow-y-auto w-full">
      <div className="border-b-2 border-brand-text pb-6 mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center shrink-0">
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl md:text-4xl font-brand-serif italic mb-1">Global Catalog</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">System-wide item definitions</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-1 border border-brand-border">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-text' : 'text-slate-400'}`}
            >
              List
            </button>
            <button 
              onClick={() => setViewMode('qr')}
              className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'qr' ? 'bg-white shadow-sm text-brand-text' : 'text-slate-400'}`}
            >
              QR Gallery
            </button>
            <button 
              onClick={() => {
                setViewMode('ai');
                setCameraError(null);
                setAiAnalysisResult(null);
                setCapturedImage(null);
              }}
              className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${viewMode === 'ai' ? 'bg-[#e11d48] text-white font-black shadow-sm' : 'text-rose-600 hover:bg-rose-50/50'}`}
            >
              <Sparkles size={11} className="animate-pulse" />
              AI Cake Scanner
            </button>
          </div>
          <button 
            onClick={generateMissingBarcodes}
            className={`px-4 h-11 text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
              items.some((i: any) => !i.barcode) 
                ? 'bg-red-600 text-white border-red-600 animate-pulse' 
                : 'bg-slate-50 text-slate-500 border-brand-border hover:bg-slate-100'
            }`}
          >
            <RefreshCw size={14} />
            {items.some((i: any) => !i.barcode) ? 'SYNC MISSING QR CODES' : 'ALL QR SYNCED'}
          </button>
          <button 
            onClick={exportItemsPDF}
            className="px-4 h-11 text-[9px] font-black uppercase tracking-widest border border-brand-border bg-slate-50 text-brand-text hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Export Catalog (PDF)
          </button>
          <button 
            disabled={isExportingQR}
            onClick={exportQRLabels}
            className="px-4 h-11 text-[9px] font-black uppercase tracking-widest border border-brand-text bg-white text-brand-text hover:bg-brand-text hover:text-white transition-all flex items-center justify-center gap-2"
          >
            {isExportingQR ? <Loader2 className="animate-spin" size={14} /> : <QrCode size={14} />}
            {isExportingQR ? 'PRINTING QR...' : 'EXPORT QR LABELS (PDF)'}
          </button>
          <button 
            onClick={() => setShowInactive(!showInactive)}
            className={`px-4 h-11 text-[9px] font-black uppercase tracking-widest border transition-all ${showInactive ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text border-brand-border'}`}
          >
            {showInactive ? 'HIDE INACTIVE' : 'SHOW ALL'}
          </button>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text"
              id="catalog-search-input"
              placeholder="FILTER CATALOG..."
              className="w-full h-11 pl-10 pr-4 bg-brand-bg border border-brand-border text-xs font-bold outline-none focus:ring-1 focus:ring-brand-text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col md:flex-row gap-2 w-full">
            <input 
              className="p-3 border border-brand-border text-xs font-brand-mono focus:ring-1 focus:ring-brand-text outline-none w-full md:w-48"
              placeholder="TITLE..."
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
            />
            <input 
              className="p-3 border border-brand-border text-xs font-brand-mono focus:ring-1 focus:ring-brand-text outline-none w-full md:w-32"
              placeholder="BARCODE..."
              value={newItemBarcode}
              onChange={e => setNewItemBarcode(e.target.value)}
            />
            <select 
              className="p-3 border border-brand-border text-xs font-bold w-full md:w-32 bg-white"
              value={newItemCategory}
              onChange={e => setNewItemCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              {!categories.includes('Others') && <option value="Others">Others</option>}
            </select>
            <button 
              onClick={addItem} 
              className="bg-brand-text text-white px-6 h-[44px] text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg whitespace-nowrap"
            >
              REGISTER
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
        {viewMode === 'ai' ? (
          <div className="max-w-2xl mx-auto bg-white border-2 border-brand-text shadow-xl p-6 md:p-8 rounded-none flex flex-col gap-6">
            <div className="text-center">
              <h3 className="text-xl md:text-2xl font-brand-serif italic mb-2 flex items-center justify-center gap-2">
                <Sparkles className="text-[#e11d48]" size={20} />
                Broomies AI Cake Recognizer
              </h3>
              <p className="text-[10px] font-black font-brand-mono tracking-widest opacity-60 uppercase">Powered by Gemini AI Model</p>
            </div>

            {/* Input Selection Stage */}
            {!capturedImage && !isProcessing && (
              <div className="flex flex-col gap-4">
                {/* Webcam Live Capture View */}
                {stream ? (
                  <div className="relative border-4 border-brand-text bg-black aspect-video overflow-hidden flex flex-col items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4 bg-transparent">
                      <button 
                        onClick={captureFrame}
                        className="bg-[#e11d48] text-white hover:bg-rose-600 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg"
                      >
                        Capture & Match
                      </button>
                      <button 
                        onClick={stopWebcam}
                        className="bg-white text-brand-text border-2 border-brand-text hover:bg-slate-50 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Live Stream Option */}
                    <button 
                      onClick={startWebcam}
                      className="border-2 border-dashed border-brand-border hover:border-brand-text p-8 flex flex-col items-center justify-center gap-3 transition-all h-48 group hover:bg-slate-50/30"
                    >
                      <Camera size={28} className="text-rose-500 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-black uppercase tracking-wider text-brand-text">Use Webcam Live Stream</div>
                      <p className="text-[10px] opacity-60 text-center max-w-[200px]">Perfect for real-time cameras on computers and tablets</p>
                    </button>

                    {/* Camera Photo Upload/Pick Option */}
                    <label className="border-2 border-dashed border-brand-border hover:border-brand-text p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all h-48 group hover:bg-slate-50/30">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleImageFileChange} 
                        className="hidden" 
                      />
                      <Sparkles size={28} className="text-[#6366f1] group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-black uppercase tracking-wider text-brand-text">📱 Shoot with Phone Camera</div>
                      <p className="text-[10px] opacity-60 text-center max-w-[200px]">Optimal for mobile. Triggers native device camera tool on one tap</p>
                    </label>
                  </div>
                )}
                {cameraError && (
                  <div className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold p-3 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Image Captured Indicator */}
            {capturedImage && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative border-4 border-brand-text bg-black max-h-64 rounded-none overflow-hidden max-w-sm">
                  <img src={capturedImage} alt="Captured cake" className="object-contain max-h-60 mx-auto" />
                  <button 
                    onClick={() => {
                      setCapturedImage(null);
                      setAiAnalysisResult(null);
                      stopWebcam();
                    }}
                    disabled={isProcessing}
                    className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-2 text-xs font-bold transition-all uppercase rounded-none"
                  >
                    Retake
                  </button>
                </div>
              </div>
            )}

            {/* Loading / Subtitle Indicator section */}
            {isProcessing && (
              <div className="py-8 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-rose-500" size={32} />
                <div className="text-xs font-black tracking-widest text-brand-text uppercase text-center animate-pulse">{activeStage}</div>
                <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">Analyzing layers, frosting structure, and decorations...</p>
              </div>
            )}

            {/* AI Results Output Stage */}
            {aiAnalysisResult && (
              <div className="border border-brand-border bg-slate-50 p-5 md:p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                  {aiAnalysisResult.isConfident ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 flex items-center gap-1 border border-emerald-200">
                      <CheckCircle2 size={12} /> CONFIDENT MATCH
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-2.5 py-1 flex items-center gap-1 border border-amber-200">
                      <AlertCircle size={12} /> WEAK / NO EXACT MATCH
                    </span>
                  )}
                </div>

                <div className="text-xs text-brand-text text-normal leading-relaxed">
                  <span className="font-brand-mono font-black mr-1 uppercase text-[10px]">Chef Analysis:</span>
                  <span className="italic opacity-80">"{aiAnalysisResult.reasoning}"</span>
                </div>

                {/* CONFIDENT MATCH DISPLAY & ACTIONS */}
                {aiAnalysisResult.isConfident && matchedCustomItem ? (
                  <div className="bg-white border-2 border-emerald-500 p-4 flex flex-col gap-3">
                    <p className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">FOUND CATALOG PRODUCT:</p>
                    <div>
                      <div className="font-bold text-base text-brand-text uppercase leading-none">{matchedCustomItem.name}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{matchedCustomItem.category}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button 
                        onClick={() => {
                          setHighlightedItemId(matchedCustomItem.id);
                          setViewMode('list');
                          setCatalogSearch(matchedCustomItem.name);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 text-[9px] uppercase tracking-widest transition-all"
                      >
                        Confirm & Locate in List
                      </button>
                      <button 
                        onClick={() => setShowSearchPopup(true)}
                        className="bg-white border border-brand-text hover:bg-slate-50 text-brand-text font-black px-4 py-2.5 text-[9px] uppercase tracking-widest transition-all"
                      >
                        Not This Cake? Select Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SUGGESTION FOR NEW ITEM DISPLAY & ACTIONS */
                  <div className="bg-white border-2 border-brand-text p-4 flex flex-col gap-3">
                    <p className="text-[10px] font-black uppercase text-rose-500 tracking-wider">SUGGESTION FOR CATALOG:</p>
                    <div>
                      <div className="font-bold text-base text-brand-text uppercase leading-none">{aiAnalysisResult.suggestedName || 'Unknown Custom Cake'}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{aiAnalysisResult.suggestedCategory || 'Classic Cakes'}</div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      {aiAnalysisResult.suggestedName && (
                        <button 
                          onClick={() => addSuggestedItem(aiAnalysisResult.suggestedName, aiAnalysisResult.suggestedCategory)}
                          className="bg-[#e11d48] hover:bg-rose-600 text-white font-black px-4 py-2.5 text-[9px] uppercase tracking-widest flex items-center justify-center gap-1 transition-all"
                        >
                          <Plus size={12} /> Add to Catalog in 1-Click
                        </button>
                      )}
                      <button 
                        onClick={() => setShowSearchPopup(true)}
                        className="bg-white border border-brand-text hover:bg-slate-50 text-brand-text font-black px-4 py-2.5 text-[9px] uppercase tracking-widest transition-all text-center"
                      >
                        Link to Existing Cake Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Manual Lookup Modal Overlay */}
            {showSearchPopup && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white border-2 border-brand-text max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-brand-serif italic text-lg text-brand-text">Select Cake Manually</h4>
                    <button 
                      onClick={() => setShowSearchPopup(false)}
                      className="text-slate-400 hover:text-brand-text p-1 text-xs font-black uppercase"
                    >
                      [ Close ]
                    </button>
                  </div>

                  <p className="text-[9px] font-bold text-[#A69D91] uppercase tracking-wider">Search active products in our database to link with this captured photo:</p>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input 
                      type="text"
                      className="w-full h-10 pl-10 pr-4 bg-brand-bg border border-brand-border text-xs font-bold outline-none focus:ring-1 focus:ring-brand-text"
                      placeholder="SEARCH CAKES, PASTRIES..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-brand-border bg-slate-50 p-2 flex flex-col gap-1.5">
                    {searchResults.length > 0 ? (
                      searchResults.map((item: any) => (
                        <button 
                          key={item.id}
                          onClick={() => {
                            setHighlightedItemId(item.id);
                            setViewMode('list');
                            setCatalogSearch(item.name);
                            setShowSearchPopup(false);
                            setAiAnalysisResult(null);
                            setCapturedImage(null);
                          }}
                          className="p-2 border-b border-brand-border hover:bg-slate-100 flex items-center justify-between text-left transition-colors"
                        >
                          <div>
                            <span className="font-bold text-xs uppercase text-brand-text">{item.name}</span>
                            <span className="text-[8px] text-[#A69D91] font-bold uppercase tracking-widest block">{item.category}</span>
                          </div>
                          <span className="text-[8px] font-bold uppercase text-brand-text tracking-wider flex items-center gap-0.5 whitespace-nowrap bg-brand-text/5 px-1.5 py-0.5">[ Select ]</span>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-4 text-[10px] uppercase font-bold tracking-wider text-slate-400">No matching item found.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : viewMode === 'qr' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
             {finalFilteredCatalog.map((item: any) => (
               <QRItem key={item.id} item={item} />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 border-l border-t border-brand-border h-fit">
            {finalFilteredCatalog.map((item: any) => {
              const isHighlighted = item.id === highlightedItemId;
              return (
                <div 
                  key={item.id} 
                  id={`item-card-${item.id}`}
                  className={`p-4 md:p-5 border-r border-b border-brand-border flex items-center justify-between group transition-all duration-300 ${isHighlighted ? 'bg-emerald-50/60 border-2 border-emerald-500 scale-[1.01] shadow-md ring-2 ring-emerald-500/10' : item.status === 'inactive' ? 'bg-zinc-100 opacity-60' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex shrink-0 mr-4">
                     <QRThumb barcode={item.barcode} />
                  </div>
                  <div className="min-w-0 pr-4 flex-1">
                    <div className="font-bold text-brand-text uppercase leading-none truncate mb-1 text-xs">{item.name}</div>
                    <div className="text-[8px] text-[#A69D91] font-bold uppercase tracking-widest flex items-center gap-2">
                      {item.category}
                      {item.barcode && <span className="bg-brand-text/10 text-brand-text px-1 rounded flex items-center gap-1"><QrCode size={8} /> {item.barcode}</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                       <input 
                          type="text" 
                          placeholder="Set Barcode..."
                          className="w-full bg-transparent border-b border-brand-border/30 text-[9px] font-brand-mono outline-none focus:border-brand-text transition-colors"
                          defaultValue={item.barcode || ''}
                          onBlur={(e) => updateItemBarcode(item.id, e.target.value)}
                       />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <button 
                      onClick={() => toggleItemStatus(item)}
                      className={`p-2 text-[8px] font-black uppercase tracking-tighter border rounded-none transition-all ${item.status === 'inactive' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-zinc-400 border-zinc-200 hover:text-brand-text hover:border-brand-text'}`}
                    >
                      {item.status === 'inactive' ? '[ ACTIVATE ]' : '[ DEACTIVATE ]'}
                    </button>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="text-red-400 hover:text-red-600 p-2 md:opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold shrink-0 uppercase"
                    >
                      [ RM ]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

const HistoryPanelComponent = React.memo(({
  records,
  setRecords,
  oldRecords,
  setOldRecords,
  setCurrentDate,
  setView,
  setIsSidebarOpen,
}: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'current' | 'old'>('current');

  const activeRecords = activeHistoryTab === 'current' ? records : oldRecords;
  const dates = Object.keys(activeRecords || {}).sort((a, b) => b.localeCompare(a));
  
  const filteredDates = useMemo(() => {
    if (!searchTerm.trim()) return dates;
    return dates.filter(date => {
      try {
        const formattedDate = format(new Date(date), 'dd MMM yyyy').toLowerCase();
        return formattedDate.includes(searchTerm.toLowerCase());
      } catch (e) {
        return date.toLowerCase().includes(searchTerm.toLowerCase());
      }
    });
  }, [dates, searchTerm]);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const toggleSelection = (date: string) => {
    setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const deleteSelected = async () => {
    if (confirm(`Are you sure you want to delete the selected (${selectedDates.length}) history logs?`)) {
      if (activeHistoryTab === 'current') {
        setRecords((prev: any) => {
          const newRecs = { ...prev };
          selectedDates.forEach(d => delete newRecs[d]);
          localStorage.setItem('broomies_db_daily_records_v2', JSON.stringify(newRecs));
          return newRecs;
        });

        // Delete from Firestore
        for (const date of selectedDates) {
          try {
            // Delete all possible outlet documents for this date in V2
            for (const outlet of OUTLETS) {
              await deleteDoc(doc(db, DAILY_RECORDS_COL, `${date}_${outlet.id}`));
            }
            await deleteDoc(doc(db, DAILY_RECORDS_COL, date));
          } catch (e) {
            console.error("Failed to delete v2 Firestore document:", e);
          }
        }
      } else {
        setOldRecords((prev: any) => {
          const newRecs = { ...prev };
          selectedDates.forEach(d => delete newRecs[d]);
          localStorage.setItem('broomies_db_daily_records', JSON.stringify(newRecs));
          return newRecs;
        });

        // Delete from legacy Firestore
        for (const date of selectedDates) {
          try {
            for (const outlet of OUTLETS) {
              await deleteDoc(doc(db, DAILY_RECORDS_OLD_COL, `${date}_${outlet.id}`));
            }
            await deleteDoc(doc(db, DAILY_RECORDS_OLD_COL, date));
          } catch (e) {
            console.error("Failed to delete old Firestore document:", e);
          }
        }
      }
      setSelectedDates([]);
    }
  };

  const handleSelectDate = async (date: string) => {
    if (activeHistoryTab === 'old') {
      if (confirm(`Do you want to restore and view this legacy day record (${format(new Date(date), 'dd MMM yyyy')})? This will safely copy the day's records into your active shift list (V2).`)) {
        try {
          const dateRecords = oldRecords[date] || {};
          
          // Copy outlet records to current V2 database
          for (const outletId of Object.keys(dateRecords)) {
            if (outletId === 'batches') continue;
            const outletData = dateRecords[outletId];
            const recordId = `${date}_${outletId}`;
            await setDoc(doc(db, DAILY_RECORDS_COL, recordId), {
              date,
              outletId,
              records: outletData,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }

          // Copy kitchen batches
          if (dateRecords.batches) {
            await setDoc(doc(db, DAILY_RECORDS_COL, date), {
              date,
              batches: dateRecords.batches
            }, { merge: true });
          }

          setCurrentDate(date);
          setView('dashboard');
        } catch (e) {
          console.error("Error importing old data to V2:", e);
          alert("Could not copy archival layout records. Try again.");
        }
      }
    } else {
      setCurrentDate(date);
      setView('dashboard');
    }
  };

  return (
    <div className="p-4 md:p-12 bg-white h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b-2 border-brand-text gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border">
            <Menu size={20} />
          </button>
          <div>
            <h2 className="text-3xl md:text-4xl font-brand-serif italic">Archive Log</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Session History & Dataset Administration</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Dataset Toggles */}
          <div className="border-2 border-brand-text p-1 flex gap-1 bg-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] shrink-0">
            <button
              onClick={() => { setActiveHistoryTab('current'); setSelectedDates([]); }}
              className={`px-3 py-1.5 text-[9px] font-black uppercase transition-all ${
                activeHistoryTab === 'current' 
                  ? 'bg-brand-text text-white shadow-[1px_1px_0_0_rgba(0,0,0,1)]' 
                  : 'text-brand-text bg-white border border-transparent'
              }`}
            >
              ACTIVE SYSTEM (V2)
            </button>
            <button
              onClick={() => { setActiveHistoryTab('old'); setSelectedDates([]); }}
              className={`px-3 py-1.5 text-[9px] font-black uppercase transition-all ${
                activeHistoryTab === 'old' 
                  ? 'bg-brand-text text-white shadow-[1px_1px_0_0_rgba(0,0,0,1)]' 
                  : 'text-brand-text bg-white border border-transparent'
              }`}
            >
              ARCHIVED DATA (OLD)
            </button>
          </div>

          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text" 
              placeholder="SEARCH BY DATE (e.g. 29 Apr)..." 
              className="w-full h-10 pl-9 pr-4 bg-brand-bg border border-brand-border text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-brand-text outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {selectedDates.length > 0 && (
            <button 
              onClick={deleteSelected} 
              className="flex items-center justify-center gap-2 px-6 h-10 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shrink-0"
            >
              PURGE ({selectedDates.length})
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-px bg-brand-border border border-brand-border">
        {filteredDates.map(date => (
          <div 
            key={date} 
            className="group flex items-stretch bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="p-4 md:p-6 border-r border-brand-border flex items-center">
              <input 
                type="checkbox" 
                checked={selectedDates.includes(date)} 
                onChange={() => toggleSelection(date)} 
                className="w-5 h-5 accent-brand-text rounded-none cursor-pointer" 
              />
            </div>
            <div 
              className="flex-1 flex items-center justify-between p-4 md:p-6 cursor-pointer"
              onClick={() => handleSelectDate(date)}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-8">
                <div className="text-sm md:text-base font-brand-mono font-black text-brand-text">
                  {format(new Date(date), 'dd MMM yyyy')}
                </div>
                <div className="text-[8px] md:text-[10px] font-bold uppercase tracking-[.2em] opacity-40">
                  {Object.keys(activeRecords[date] || {}).filter(k => k !== 'batches').length} OUTLETS
                </div>
              </div>
              <div className="text-[9px] font-black text-brand-text md:opacity-0 group-hover:opacity-100 uppercase underline decoration-2 underline-offset-4 flex items-center gap-1">
                {activeHistoryTab === 'old' ? 'Import & Restore' : 'View Ledger'}
              </div>
            </div>
          </div>
        ))}
        {dates.length === 0 && (
          <div className="text-center py-32 bg-brand-bg md:bg-white border border-dashed border-brand-border opacity-20 font-brand-mono uppercase text-sm">
            No Records Available in this Dataset
          </div>
        )}
      </div>
    </div>
  );
});

const ReportsComponent = React.memo(({
  records,
  currentDate,
  setCurrentDate,
  items,
  setIsSidebarOpen
}: any) => {
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const [timeRange, setTimeRange] = useState('7');
  const [reportStart, setReportStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [reportEnd, setReportEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeView, setActiveView] = useState<'visual' | 'logistics'>('visual');

  const consolidatedReport = useMemo(() => {
    const start = new Date(reportStart);
    const end = new Date(reportEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    
    const interval = eachDayOfInterval({ start, end });
    const dates = interval.map(d => format(d, 'yyyy-MM-dd'));
    
    const results: any[] = [];
    const priority = ['CAKES', 'PASTRIES', 'COOKIES'];

    items.forEach((item: any) => {
      let totalProd = 0;
      let totalRecByOutlets = 0;
      const outletBreakdown: { [id: string]: number } = {};

      dates.forEach(date => {
        const dayRecs = records[date] || {};
        
        // Sum Production from batches
        if (dayRecs.batches) {
          Object.values(dayRecs.batches).forEach((batch: any) => {
            if (!batch || !batch.items) return;
            batch.items.forEach((bi: any) => {
              if (bi.itemId === item.id) totalProd += Number(bi.qty || 0);
            });
          });
        }

        // Sum Distribution to outlets
        OUTLETS.forEach(o => {
          const qty = Number(dayRecs[o.id]?.[item.id]?.received || 0);
          totalRecByOutlets += qty;
          outletBreakdown[o.id] = (outletBreakdown[o.id] || 0) + qty;
        });
      });

      if (totalProd > 0 || totalRecByOutlets > 0) {
        results.push({
          id: item.id,
          name: item.name,
          category: item.category,
          production: totalProd,
          distribution: totalRecByOutlets,
          outletBreakdown
        });
      }
    });

    return results.sort((a, b) => {
      // 0. Absolute Priority Item Rank
      const priorityIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
      const priorityIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
      
      if (priorityIndexA !== -1 || priorityIndexB !== -1) {
        const valA = priorityIndexA === -1 ? 9999 : priorityIndexA;
        const valB = priorityIndexB === -1 ? 9999 : priorityIndexB;
        if (valA !== valB) return valA - valB;
      }

      const catA = a.category.toUpperCase();
      const catB = b.category.toUpperCase();
      const indexA = priority.indexOf(catA);
      const indexB = priority.indexOf(catB);
      if (indexA !== -1 && indexB !== -1) {
        if (indexA !== indexB) return indexA - indexB;
      } else if (indexA !== -1) return -1;
      else if (indexB !== -1) return 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
  }, [items, records, reportStart, reportEnd]);

  const analyticsData = useMemo(() => {
    const lastNDays = Array.from({ length: parseInt(timeRange) }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();

    const chartData = lastNDays.map(date => {
      const dayRecs = records[date] || {};
      let dailyTotalSold = 0;
      let dailyTotalReturns = 0;

      const outletIds = selectedOutlet === 'all' ? OUTLETS.map(o => o.id) : [selectedOutlet];

      outletIds.forEach(oId => {
        const outletData = dayRecs[oId] || {};
        Object.values(outletData).forEach((itemData: any) => {
          if (!itemData) return;
          dailyTotalSold += Number(itemData.sold || 0);
          dailyTotalReturns += Number(itemData.returned || 0);
        });
      });

      return {
        date: format(new Date(date), 'dd MMM'),
        sold: dailyTotalSold,
        returns: dailyTotalReturns,
      };
    });

    const catMap: { [cat: string]: number } = {};
    Object.values(records[currentDate] || {}).forEach((outletData: any) => {
      if (!outletData) return;
      Object.entries(outletData).forEach(([itemId, itemData]: [string, any]) => {
        if (!itemData) return;
        const item = items.find((i: any) => i.id === itemId);
        if (item) {
          catMap[item.category] = (catMap[item.category] || 0) + (itemData.sold || 0);
        }
      });
    });

    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    return { chartData, pieData, lastNDays };
  }, [records, items, currentDate, selectedOutlet, timeRange]);

  const COLORS = ['#1a1a1a', '#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed'];

  const itemPerformance = useMemo(() => {
    return items.map((item: any) => {
      let totalSold = 0;
      let totalReturns = 0;
      
      const outletIds = selectedOutlet === 'all' ? OUTLETS.map(o => o.id) : [selectedOutlet];
      
      analyticsData.lastNDays.forEach(date => {
        const dayRecs = records[date] || {};
        outletIds.forEach(oId => {
          const itemData = dayRecs[oId]?.[item.id] || {};
          totalSold += (itemData.sold || 0);
          totalReturns += (itemData.returned || 0);
        });
      });

      return {
        id: item.id,
        name: item.name,
        sold: totalSold,
        returns: totalReturns,
        successRate: totalSold > 0 ? Math.round((totalSold / (totalSold + totalReturns)) * 100) : 0
      };
    }).sort((a: any, b: any) => b.sold - a.sold);
  }, [items, records, analyticsData.lastNDays, selectedOutlet]);

  const exportReportPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text('CONSOLIDATED PERFORMANCE REPORT', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${reportStart} to ${reportEnd}`, 14, 22);

    const headers = [['Item Name', 'Category', 'Total Production', 'Total Distribution', ...OUTLETS.map(o => o.name.toUpperCase())]];
    const body = consolidatedReport.map((row: any) => [
      row.name,
      row.category,
      row.production,
      row.distribution,
      ...OUTLETS.map(o => row.outletBreakdown[o.id] || 0)
    ]).filter(row => {
      // Check if any numeric value (index 2 onwards) is non-zero
      return row.slice(2).some(val => Number(val) !== 0);
    });

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], textColor: 255 },
      styles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25 }
      }
    });

    doc.save(`consolidated-report-${reportStart}-to-${reportEnd}.pdf`);
  }, [consolidatedReport, reportStart, reportEnd]);

  return (
    <div className="flex flex-col h-full bg-[#f8f7f4]/85 backdrop-blur-md overflow-hidden">
      <header className="p-4 md:p-8 bg-white border-b-2 border-brand-text shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center">
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-3xl md:text-5xl font-brand-serif italic leading-none text-brand-text">Performance Hub</h2>
              <p className="text-[10px] font-black uppercase tracking-[.3em] opacity-40 mt-1">Real-time Visual Analytics & Outlet Performance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={exportReportPDF}
               className="h-10 px-4 bg-white border-2 border-brand-text text-[10px] font-black uppercase tracking-widest hover:bg-brand-text hover:text-white transition-all flex items-center gap-2"
             >
               <Download size={14} />
               Export PDF
             </button>

             <div className="flex bg-brand-bg p-1 border border-brand-border h-10">
                <button 
                  onClick={() => setActiveView('visual')}
                  className={`px-4 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'visual' ? 'bg-brand-text text-white' : 'text-brand-text'}`}
                >
                  Visuals
                </button>
                <button 
                  onClick={() => setActiveView('logistics')}
                  className={`px-4 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'logistics' ? 'bg-brand-text text-white' : 'text-brand-text'}`}
                >
                  Logistics
                </button>
             </div>

             {activeView === 'visual' ? (
               <>
                 <select 
                   value={selectedOutlet}
                   onChange={e => setSelectedOutlet(e.target.value)}
                   className="h-10 px-4 bg-brand-bg border border-brand-border text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-brand-text"
                 >
                   <option value="all">ALL OUTLETS</option>
                   {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                 </select>
                 <select 
                   value={timeRange}
                   onChange={e => setTimeRange(e.target.value)}
                   className="h-10 px-4 bg-brand-bg border border-brand-border text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-brand-text"
                 >
                   <option value="7">LAST 7 DAYS</option>
                   <option value="14">LAST 14 DAYS</option>
                   <option value="30">LAST 30 DAYS</option>
                 </select>
               </>
             ) : (
               <div className="flex gap-2">
                  <input 
                    type="date" 
                    className="h-10 px-2 bg-brand-bg border border-brand-border text-[10px] font-black outline-none"
                    value={reportStart}
                    onChange={e => setReportStart(e.target.value)}
                  />
                  <input 
                    type="date" 
                    className="h-10 px-2 bg-brand-bg border border-brand-border text-[10px] font-black outline-none"
                    value={reportEnd}
                    onChange={e => setReportEnd(e.target.value)}
                  />
               </div>
             )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {activeView === 'visual' ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white border border-brand-border p-6 shadow-sm">
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">Total Period Sales</div>
                    <div className="text-4xl font-brand-mono font-black">{analyticsData.chartData.reduce((acc, curr) => acc + curr.sold, 0)}</div>
                    <div className="text-[8px] font-black text-green-600 mt-1">UNITS DISTRIBUTED</div>
                 </div>
                 <div className="bg-white border border-brand-border p-6 shadow-sm">
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">Aggregate Return Rate</div>
                    <div className="text-4xl font-brand-mono font-black">
                       {Math.round((analyticsData.chartData.reduce((acc, curr) => acc + curr.returns, 0) / (analyticsData.chartData.reduce((acc, curr) => acc + curr.sold, 0) || 1)) * 100)}%
                    </div>
                    <div className="text-[8px] font-black text-red-600 mt-1">WASTAGE FACTOR</div>
                 </div>
                 <div className="bg-white border border-brand-border p-6 shadow-sm">
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">Efficiency Rating</div>
                    <div className="text-4xl font-brand-serif italic font-black">High</div>
                    <div className="text-[8px] font-black text-blue-600 mt-1">OPTIMIZED DISTRIBUTION</div>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-brand-border p-6 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-8 border-b pb-4">Sales vs Returns Trend</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 900, fill: '#1a1a1a' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 900, fill: '#1a1a1a' }} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '0', color: '#fff' }}
                        />
                        <Legend iconType="square" align="right" verticalAlign="top" wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                        <Line type="monotone" dataKey="sold" stroke="#1a1a1a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Units Sold" />
                        <Line type="monotone" dataKey="returns" stroke="#e11d48" strokeWidth={2} strokeDasharray="5 5" name="Returns" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-brand-border p-6 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-8 border-b pb-4">Category Sales Distribution</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData.pieData}
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analyticsData.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '0', color: '#fff' }}
                        />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-brand-border shadow-sm overflow-hidden">
                 <div className="p-4 bg-slate-50 border-b border-brand-border flex justify-between items-center">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-text">Itemized Performance Leaderboard</h3>
                    <div className="text-[8px] font-bold opacity-40 uppercase tracking-widest">Sorted by Volume</div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left font-brand-mono">
                       <thead className="bg-brand-text text-white text-[10px] uppercase font-black tracking-widest">
                          <tr>
                             <th className="p-4">Product Name</th>
                             <th className="p-4 text-center">Unit Sales</th>
                             <th className="p-4 text-center">Returns</th>
                             <th className="p-4 text-center">Efficiency</th>
                          </tr>
                       </thead>
                       <tbody className="text-[11px] font-bold divide-y divide-[#eee]">
                          {itemPerformance.map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                               <td className="p-4 uppercase">{item.name}</td>
                               <td className="p-4 text-center font-brand-mono">{item.sold}</td>
                               <td className="p-4 text-center font-brand-mono text-red-600">{item.returns}</td>
                               <td className="p-4 text-center">
                                  <div className="inline-block px-3 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-[9px] uppercase font-black">
                                     {item.successRate}%
                                  </div>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-brand-border shadow-sm overflow-hidden">
               <div className="p-8 border-b border-brand-border flex justify-between items-center">
                  <div>
                     <h3 className="text-xl font-brand-serif italic">Consolidated Logistics Summary</h3>
                     <p className="text-[10px] font-black uppercase opacity-40 mt-1">Cross-Reference: Production vs Outlet Distribution</p>
                  </div>
                  <div className="text-right">
                     <span className="text-[10px] font-black uppercase tracking-widest bg-brand-text text-white px-4 py-1">Period: {reportStart} - {reportEnd}</span>
                  </div>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left font-brand-mono">
                     <thead className="bg-[#f0f2f5] text-brand-text text-[9px] uppercase font-black tracking-widest">
                        <tr>
                           <th className="p-4 bg-white sticky left-0 z-10 border-r">Item Details</th>
                           <th className="p-4 text-center bg-blue-50 text-blue-800">Total Produced</th>
                           <th className="p-4 text-center bg-green-50 text-green-800">Total Received</th>
                           {OUTLETS.map(o => (
                             <th key={o.id} className="p-4 text-center whitespace-nowrap">{o.name}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="text-[10px] font-bold divide-y divide-[#eee]">
                        {consolidatedReport.map((row: any) => (
                           <tr key={row.id} className="hover:bg-slate-50">
                              <td className="p-4 bg-white sticky left-0 z-10 border-r">
                                 <div className="uppercase">{row.name}</div>
                                 <div className="text-[8px] opacity-30 uppercase">{row.category}</div>
                              </td>
                              <td className="p-4 text-center font-black bg-blue-50/30 text-blue-600">{row.production}</td>
                              <td className="p-4 text-center font-black bg-green-50/30 text-green-600">{row.distribution}</td>
                              {OUTLETS.map(o => (
                                <td key={o.id} className="p-4 text-center border-l opacity-40">{row.outletBreakdown[o.id] || 0}</td>
                              ))}
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const RecipesComponent = React.memo(({ items, ingredients, recipes, setIsSidebarOpen }: any) => {
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipes'>('ingredients');
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [newIng, setNewIng] = useState({ name: '', unit: 'kg', threshold: 0 });

  const handleAddIngredient = async () => {
    if (!newIng.name) return;
    try {
      await addDoc(collection(db, 'ingredients'), {
        name: newIng.name.toUpperCase(),
        unit: newIng.unit,
        currentStock: 0,
        lowStockThreshold: newIng.threshold
      });
      setShowAddIngredient(false);
      setNewIng({ name: '', unit: 'kg', threshold: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f7f4]/85 backdrop-blur-md">
      <header className="p-4 md:p-8 bg-white border-b-2 border-brand-text shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center shrink-0">
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-3xl md:text-5xl font-brand-serif italic text-brand-text">Recipe Studio</h2>
              <p className="text-[10px] font-black uppercase tracking-[.3em] opacity-40 mt-1">Ingredient Matrix & Production Formulations</p>
            </div>
          </div>
          <div className="flex bg-brand-bg p-1 border border-brand-border">
             <button onClick={() => setActiveTab('ingredients')} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ingredients' ? 'bg-brand-text text-white shadow-lg' : 'text-brand-text hover:bg-white'}`}>Ingredients</button>
             <button onClick={() => setActiveTab('recipes')} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'recipes' ? 'bg-brand-text text-white shadow-lg' : 'text-brand-text hover:bg-white'}`}>Recipes</button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
         <div className="max-w-7xl mx-auto">
            {activeTab === 'ingredients' ? (
              <div className="space-y-6">
                 <div className="flex justify-between items-center bg-white p-6 border border-brand-border shadow-sm">
                    <div>
                       <h3 className="text-sm font-black uppercase">Ingredient Master Catalog</h3>
                       <p className="text-[9px] font-bold opacity-40 uppercase mt-1">Manage global raw materials</p>
                    </div>
                    <button onClick={() => setShowAddIngredient(true)} className="h-10 px-6 bg-brand-text text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all">
                       <Plus size={14} /> New Material
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {ingredients.map((ing: any) => (
                      <div key={ing.id} className="bg-white border border-brand-border p-5 group hover:border-brand-text transition-all">
                         <div className="text-[8px] font-black text-[#A69D91] uppercase mb-1">{ing.unit}</div>
                         <div className="text-sm font-black uppercase mb-4">{ing.name}</div>
                         <div className="flex justify-between items-end">
                            <div>
                               <div className="text-[8px] font-black opacity-30 uppercase">In Stock</div>
                               <div className={`text-xl font-brand-mono font-black ${ing.currentStock <= ing.lowStockThreshold ? 'text-red-600' : 'text-brand-text'}`}>{ing.currentStock}</div>
                            </div>
                            <div className="text-right">
                               <div className="text-[8px] font-black opacity-30 uppercase">Threshold</div>
                               <div className="text-sm font-brand-mono font-bold">{ing.lowStockThreshold}</div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            ) : (
              <div className="space-y-6">
                 <div className="bg-white p-20 border-2 border-dashed border-brand-border flex flex-col items-center justify-center opacity-30">
                    <ChefHat size={60} strokeWidth={1} />
                    <h4 className="mt-4 font-black uppercase text-xs tracking-[.4em]">Recipe Module Scanning...</h4>
                    <p className="mt-2 text-[10px] font-bold uppercase opacity-80">Link items to ingredients to enable automatic stock deduction.</p>
                 </div>
              </div>
            )}
         </div>
      </div>

      {showAddIngredient && (
        <div className="fixed inset-0 bg-brand-bg/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md border border-brand-border shadow-2xl overflow-hidden p-8">
              <div className="flex justify-between items-center mb-8 border-b border-[#eee] pb-4">
                 <h3 className="text-xl font-brand-serif italic">Register Ingredient</h3>
                 <button onClick={() => setShowAddIngredient(false)}><X size={20} /></button>
              </div>
              <div className="space-y-6">
                 <div>
                    <label className="text-[9px] font-black uppercase opacity-40 mb-2 block">Name</label>
                    <input 
                      type="text" 
                      className="w-full h-12 px-4 bg-brand-bg border border-brand-border text-sm font-bold focus:ring-1 focus:ring-brand-text outline-none uppercase"
                      value={newIng.name}
                      onChange={e => setNewIng({...newIng, name: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[9px] font-black uppercase opacity-40 mb-2 block">Unit</label>
                       <select 
                         className="w-full h-12 px-4 bg-brand-bg border border-brand-border text-sm font-bold outline-none"
                         value={newIng.unit}
                         onChange={e => setNewIng({...newIng, unit: e.target.value})}
                       >
                          <option>kg</option>
                          <option>ltr</option>
                          <option>pcs</option>
                          <option>g</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[9px] font-black uppercase opacity-40 mb-2 block">Low Stock Alert</label>
                       <input 
                         type="number" 
                         className="w-full h-12 px-4 bg-brand-bg border border-brand-border text-sm font-bold focus:ring-1 focus:ring-brand-text outline-none"
                         value={newIng.threshold}
                         onChange={e => setNewIng({...newIng, threshold: parseInt(e.target.value)})}
                       />
                    </div>
                 </div>
                 <button 
                   onClick={handleAddIngredient}
                   className="w-full h-12 bg-brand-text text-white text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4"
                 >
                   Confirm Registration
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
});

const MismatchModalComponent = React.memo(({
  items,
  setItems,
  unmatchedLines,
  setUnmatchedLines,
  setShowMismatchPopup,
  searchQuery,
  setSearchQuery,
  handleDataChange,
  bulkMode,
}: any) => {
  const fuse = useMemo(() => new Fuse<Item>(items, { keys: ['name'] }), [items]);
  const filteredItems = useMemo(() => fuse.search(searchQuery).map(r => r.item).slice(0, 10), [fuse, searchQuery]);
  const [selectedMismatch, setSelectedMismatch] = useState<number | null>(null);
  const [activeMatchIdx, setActiveMatchIdx] = useState(-1);

  useEffect(() => {
    setActiveMatchIdx(-1);
  }, [searchQuery, selectedMismatch]);

  const handleMatch = (item: Item) => {
    if (selectedMismatch === null) return;
    const mismatch = unmatchedLines[selectedMismatch];
    
    handleDataChange(item.id, bulkMode as any, mismatch.amount);
    
    const nextMismatches = [...unmatchedLines];
    nextMismatches.splice(selectedMismatch, 1);
    setUnmatchedLines(nextMismatches);
    setSelectedMismatch(null);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveMatchIdx(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveMatchIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeMatchIdx >= 0) {
        handleMatch(filteredItems[activeMatchIdx]);
      }
    }
  };

  const handleAddNewToMenu = () => {
    if (selectedMismatch === null) return;
    const mismatch = unmatchedLines[selectedMismatch];
    const newItem: Item = {
      id: Date.now().toString(),
      name: mismatch.original.toUpperCase(),
      category: 'Others'
    };
    setItems((prev: any) => [...prev, newItem]);
    handleMatch(newItem);
  };

  return (
    <div className="fixed inset-0 bg-brand-text/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-brand-bg w-full max-w-5xl h-[700px] border border-brand-border shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Left panel: Unmatched items */}
        <div className="w-full md:w-96 bg-brand-secondary border-r border-brand-border flex flex-col overflow-hidden">
          <div className="p-8 border-b border-brand-border bg-white">
            <h3 className="text-2xl font-brand-serif italic flex items-center gap-2">
              <AlertCircle className="text-red-600" /> Resolution Required
            </h3>
            <p className="text-[10px] font-bold uppercase opacity-50 mt-1">AI could not confidently pair these entries</p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-px bg-brand-border">
            {unmatchedLines.map((line: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedMismatch(idx)}
                className={`w-full text-left p-6 transition-all ${
                  selectedMismatch === idx 
                    ? 'bg-brand-text text-white' 
                    : 'bg-brand-bg text-brand-text hover:bg-white'
                }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-bold uppercase text-[13px] tracking-tight truncate flex-1 pr-4">{line.original}</span>
                  <span className="font-brand-mono text-xs opacity-60">QTY: {line.amount}</span>
                </div>
                <div className="text-[9px] uppercase font-bold opacity-40">Original String Matching Needed</div>
              </button>
            ))}
            
            {unmatchedLines.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center p-12 bg-white text-center">
                <div className="w-16 h-16 border-2 border-green-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="text-green-500" />
                </div>
                <h4 className="font-bold text-brand-text uppercase mb-2">Sync Complete</h4>
                <p className="text-xs opacity-50 mb-6">All entries have been successfully audited and matched.</p>
                <button 
                  onClick={() => setShowMismatchPopup(false)} 
                  className="w-full py-3 bg-brand-text text-white text-[11px] font-bold uppercase tracking-widest"
                >
                  Close Session
                </button>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-white border-t border-brand-border">
            <button 
              onClick={() => setShowMismatchPopup(false)} 
              className="w-full py-2 text-[10px] font-bold text-brand-text opacity-40 hover:opacity-100 uppercase tracking-widest transition-opacity"
            >
              Abort Resolution
            </button>
          </div>
        </div>

        {/* Right panel: Search and Action */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedMismatch !== null ? (
            <div className="flex flex-col h-full">
              <div className="p-8 border-b border-brand-border shrink-0">
                <div className="mb-6">
                  <label className="text-[9px] uppercase font-bold tracking-widest opacity-50 mb-2 block">The Raw Input Was</label>
                  <div className="text-4xl font-brand-serif italic text-brand-text truncate">"{unmatchedLines[selectedMismatch].original}"</div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] uppercase font-bold tracking-widest opacity-50 mb-2 block">Search Master Catalog</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                      <input 
                        autoFocus
                        className="w-full p-4 pl-12 border border-brand-border bg-brand-bg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-brand-text"
                        placeholder="TYPE TO FILTER GLOBAL PRODUCTS..."
                        value={searchQuery}
                        onKeyDown={handleKeyDown}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="mb-4 text-[10px] uppercase font-bold opacity-40 tracking-widest">Potential Matches</div>
                <div className="grid grid-cols-1 gap-1 bg-brand-border border border-brand-border">
                  {filteredItems.map((item: any, idx: number) => (
                    <button
                      key={item.id}
                      onClick={() => handleMatch(item)}
                      className={`flex items-center justify-between p-4 transition-all text-left ${
                        activeMatchIdx === idx ? 'bg-brand-text text-white' : 'bg-white hover:bg-brand-secondary'
                      }`}
                    >
                      <div>
                        <div className={`font-bold uppercase text-sm ${activeMatchIdx === idx ? 'text-white' : 'text-brand-text'}`}>{item.name}</div>
                        <div className={`text-[9px] font-bold uppercase tracking-widest ${activeMatchIdx === idx ? 'text-white opacity-70' : 'text-[#A69D91]'}`}>{item.category}</div>
                      </div>
                      <div className={`text-[10px] font-bold border px-3 py-1 uppercase ${
                        activeMatchIdx === idx 
                          ? 'border-white text-white' 
                          : 'border-brand-border text-brand-text bg-white'
                      }`}>Pair Item</div>
                    </button>
                  ))}
                  {filteredItems.length === 0 && searchQuery && (
                    <div className="p-12 bg-brand-bg text-center">
                      <p className="text-sm opacity-50 italic font-brand-mono">No Catalog Matches</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-brand-secondary border-t border-brand-border flex items-center justify-between shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-brand-text opacity-50"> New Product Registration </div>
                <button 
                  onClick={handleAddNewToMenu}
                  className="flex items-center gap-2 px-8 py-3 bg-white border border-brand-border text-brand-text text-[11px] font-bold uppercase hover:bg-brand-text hover:text-white transition-all shadow-sm"
                >
                  <Plus size={16} /> Register as New Product
                </button>
              </div>
            </div>
          ) : unmatchedLines.length > 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-20 opacity-20">
              <LayoutDashboard size={80} strokeWidth={1} />
              <p className="mt-6 font-bold uppercase tracking-[.3em] text-sm text-center">Select an entry from the left <br/> to begin pairing</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});


export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userOutletId, setUserOutletId] = useState<string | null>(null);
  const [passInput, setPassInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showPassField, setShowPassField] = useState(false);
  const [view, setView] = useState<View>('dashboard');

  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem('broomies_db_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse items from local storage", e);
      }
    }
    return INITIAL_ITEMS;
  });
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const saved = localStorage.getItem('broomies_db_ingredients');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse ingredients from local storage", e);
      }
    }
    return [];
  });
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('broomies_db_recipes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse recipes from local storage", e);
      }
    }
    return [];
  });
  const [requirements, setRequirements] = useState<Requirement[]>(() => {
    const saved = localStorage.getItem('broomies_db_requirements');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse requirements from local storage", e);
      }
    }
    return [];
  });
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>(() => {
    const saved = localStorage.getItem('broomies_db_transfers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Failed to parse transfers from local storage", e);
      }
    }
    return [];
  });
  const [records, setRecords] = useState<AllRecords>(() => {
    const saved = localStorage.getItem('broomies_db_daily_records_v2') || localStorage.getItem('broomies_app_data_fallback_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        console.error("Failed to parse daily records from local storage", e);
      }
    }
    return {};
  });
  const [oldRecords, setOldRecords] = useState<AllRecords>(() => {
    const saved = localStorage.getItem('broomies_db_daily_records') || localStorage.getItem('broomies_app_data_fallback');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        console.error("Failed to parse old daily records from local storage", e);
      }
    }
    return {};
  });
  const [permissions, setPermissions] = useState<{ [outletId: string]: OutletPermissions }>(() => {
    const saved = localStorage.getItem('broomies_db_outlet_permissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        console.error("Failed to parse outlet permissions from local storage", e);
      }
    }
    const defaults: any = {};
    OUTLETS.forEach(o => {
      defaults[o.id] = {
        canEditOpening: true,
        canEditReceived: true,
        canEditReturned: true,
        canEditTransfer: true
      };
    });
    return defaults;
  });
  
  const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOutletId, setSelectedOutletId] = useState<string>(OUTLETS[0].id);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState<keyof Pick<DailyData, 'received' | 'opening' | 'sold' | 'testing' | 'transf_out'>>('received');
  const [bulkAction, setBulkAction] = useState<'add' | 'replace'>('add');
  const [parserEngine, setParserEngine] = useState<'local' | 'ai'>('ai');
  
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  
  // AI Bulk Entry Mismatch Modal state
  const [unmatchedLines, setUnmatchedLines] = useState<DailyRecordInput[]>([]);
  const [showMismatchPopup, setShowMismatchPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isDirty, setIsDirty] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [legacyDataFound, setLegacyDataFound] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // --- FIRESTORE REAL-TIME SYNCHRONIZATION ENGINE ---
  useEffect(() => {
    const unsubDailyRecords = onSnapshot(collection(db, DAILY_RECORDS_COL), (snapshot) => {
      setRecords(prev => {
        const nextRecords = { ...prev };
        let hasChanges = false;
        
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const data = change.doc.data();
          hasChanges = true;
          
          if (change.type === 'removed') {
            if (docId.includes('_')) {
              // Outlet record (e.g. 2026-06-03_OutletId)
              const parts = docId.split('_');
              const dateKey = parts[0];
              const outletId = parts.slice(1).join('_');
              if (nextRecords[dateKey]) {
                const subRecs = { ...nextRecords[dateKey] };
                delete subRecs[outletId];
                if (Object.keys(subRecs).length === 0) {
                  delete nextRecords[dateKey];
                } else {
                  nextRecords[dateKey] = subRecs;
                }
              }
            } else {
              // Kitchen batch record (e.g. 2026-06-03)
              const dateKey = docId;
              if (nextRecords[dateKey]) {
                const subRecs = { ...nextRecords[dateKey] };
                delete subRecs.batches;
                if (Object.keys(subRecs).length === 0) {
                  delete nextRecords[dateKey];
                } else {
                  nextRecords[dateKey] = subRecs;
                }
              }
            }
          } else {
            // 'added' or 'modified'
            if (data && data.date && data.outletId && data.records) {
              if (!nextRecords[data.date]) {
                nextRecords[data.date] = {};
              }
              nextRecords[data.date] = {
                ...nextRecords[data.date],
                [data.outletId]: data.records
              };
            } else if (data && data.batches && !docId.includes('_')) {
              const dateKey = docId;
              if (!nextRecords[dateKey]) {
                nextRecords[dateKey] = {};
              }
              nextRecords[dateKey] = {
                ...nextRecords[dateKey],
                batches: data.batches
              };
            }
          }
        });
        
        return hasChanges ? nextRecords : prev;
      });
    }, (error) => {
      console.error("Error listening to daily_records_v2:", error);
    });

    const unsubOldDailyRecords = onSnapshot(collection(db, DAILY_RECORDS_OLD_COL), (snapshot) => {
      setOldRecords(prev => {
        const nextRecords = { ...prev };
        let hasChanges = false;
        
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const data = change.doc.data();
          hasChanges = true;
          
          if (change.type === 'removed') {
            if (docId.includes('_')) {
              const parts = docId.split('_');
              const dateKey = parts[0];
              const outletId = parts.slice(1).join('_');
              if (nextRecords[dateKey]) {
                const subRecs = { ...nextRecords[dateKey] };
                delete subRecs[outletId];
                if (Object.keys(subRecs).length === 0) {
                  delete nextRecords[dateKey];
                } else {
                  nextRecords[dateKey] = subRecs;
                }
              }
            } else {
              const dateKey = docId;
              if (nextRecords[dateKey]) {
                const subRecs = { ...nextRecords[dateKey] };
                delete subRecs.batches;
                if (Object.keys(subRecs).length === 0) {
                  delete nextRecords[dateKey];
                } else {
                  nextRecords[dateKey] = subRecs;
                }
              }
            }
          } else {
            if (data && data.date && data.outletId && data.records) {
              if (!nextRecords[data.date]) {
                nextRecords[data.date] = {};
              }
              nextRecords[data.date] = {
                ...nextRecords[data.date],
                [data.outletId]: data.records
              };
            } else if (data && data.batches && !docId.includes('_')) {
              const dateKey = docId;
              if (!nextRecords[dateKey]) {
                nextRecords[dateKey] = {};
              }
              nextRecords[dateKey] = {
                ...nextRecords[data.date] || {},
                batches: data.batches
              };
            }
          }
        });
        
        return hasChanges ? nextRecords : prev;
      });
    }, (error) => {
      console.error("Error listening to old daily_records:", error);
    });

    const unsubRequirements = onSnapshot(collection(db, REQUIREMENTS_COL), (snapshot) => {
      const list: Requirement[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.outletId && data.itemId) {
          list.push({
            outletId: data.outletId,
            itemId: data.itemId,
            quantity: Number(data.quantity || 0)
          });
        }
      });
      setRequirements(list);
    }, (error) => {
      console.error("Error listening to requirements v2:", error);
    });

    const unsubTransfers = onSnapshot(collection(db, TRANSFERS_COL), (snapshot) => {
      const list: Transfer[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Transfer;
        if (data && data.toOutletId && data.itemId) {
          list.push(data);
        }
      });
      setPendingTransfers(list);
    }, (error) => {
      console.error("Error listening to transfers v2:", error);
    });

    const unsubPermissions = onSnapshot(collection(db, 'outlet_permissions'), (snapshot) => {
      const perms: { [outletId: string]: OutletPermissions } = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as OutletPermissions;
        if (data) {
          perms[doc.id] = data;
        }
      });
      if (Object.keys(perms).length > 0) {
        setPermissions(prev => ({
          ...prev,
          ...perms
        }));
      }
    }, (error) => {
      console.error("Error listening to outlet_permissions:", error);
    });

    const unsubIngredients = onSnapshot(collection(db, 'ingredients'), (snapshot) => {
      const list: Ingredient[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.name) {
          list.push({
            id: doc.id,
            name: data.name,
            unit: data.unit,
            currentStock: Number(data.currentStock || 0),
            lowStockThreshold: Number(data.lowStockThreshold || 0)
          });
        }
      });
      if (list.length > 0) setIngredients(list);
    }, (error) => {
      console.error("Error listening to ingredients:", error);
    });

    const unsubRecipes = onSnapshot(collection(db, 'recipes'), (snapshot) => {
      const list: Recipe[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.itemId) {
          list.push({
            id: doc.id,
            itemId: data.itemId,
            ingredients: data.ingredients || []
          });
        }
      });
      if (list.length > 0) setRecipes(list);
    }, (error) => {
      console.error("Error listening to recipes:", error);
    });

    const unsubItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      if (snapshot.empty) {
        // Automatically seed INITIAL_ITEMS if the Firestore collection starts empty
        INITIAL_ITEMS.forEach(async (item) => {
          try {
            await setDoc(doc(db, 'items', item.id), item);
          } catch (e) {
            console.error("Failed to seed items in Firestore:", e);
          }
        });
        setItems(INITIAL_ITEMS);
      } else {
        const list: Item[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data && data.id && data.name) {
            list.push({
              id: data.id,
              name: data.name,
              category: data.category,
              barcode: data.barcode
            });
          }
        });
        setItems(list);
      }
    }, (error) => {
      console.error("Error listening to items:", error);
    });

    // Disable general first-time connection progress blocker once Firestore real-time channels are listening
    setLoading(false);

    return () => {
      unsubDailyRecords();
      unsubOldDailyRecords();
      unsubRequirements();
      unsubTransfers();
      unsubPermissions();
      unsubIngredients();
      unsubRecipes();
      unsubItems();
    };
  }, []);

  // Debounced LocalStorage Backup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Object.keys(records).length > 0) {
        localStorage.setItem('broomies_app_data_fallback', JSON.stringify(records));
      }
    }, 2000); // 2 second delay to avoid blocking main thread during active typing
    return () => clearTimeout(timer);
  }, [records]);

  // Check for legacy data on mount
  useEffect(() => {
    const legacyRecords = localStorage.getItem('osp_records');
    if (legacyRecords) {
      try {
        const parsed = JSON.parse(legacyRecords);
        if (Object.keys(parsed).length > 0) {
          setLegacyDataFound(true);
        }
      } catch (e) {
        console.error("Legacy data parse error", e);
      }
    }
  }, []);

  const migrateLegacyData = async () => {
    const legacyRecords = localStorage.getItem('osp_records');
    if (!legacyRecords) return;

    setMigrationLoading(true);
    try {
      const parsed = JSON.parse(legacyRecords); // { date: { outletId: records } }
      let count = 0;

      setRecords(prev => {
        const next = { ...prev };
        for (const date in parsed) {
          if (!next[date]) next[date] = {};
          for (const outletId in parsed[date]) {
            next[date][outletId] = {
              ...(next[date][outletId] || {}),
              ...parsed[date][outletId]
            };
            count++;
          }
        }
        return next;
      });

      // Also migrate items if they exist
      const legacyItems = localStorage.getItem('osp_items');
      if (legacyItems) {
        const pItems = JSON.parse(legacyItems);
        if (Array.isArray(pItems) && pItems.length > 0) {
          setItems(prev => {
            const next = [...prev];
            pItems.forEach(item => {
              if (!next.some(existing => existing.id === item.id)) {
                next.push(item);
              }
            });
            return next;
          });
        }
        localStorage.removeItem('osp_items');
      }

      if (count > 0) {
        localStorage.removeItem('osp_records'); // Clear after successful migration
        setLegacyDataFound(false);
        alert(`SUCCESS: ${count} records migrated to your local workspace!`);
      }
    } catch (error) {
      console.error("Migration error:", error);
      alert("Migration failed. Please try again.");
    } finally {
      setMigrationLoading(false);
    }
  };

  // --- Shortcuts and Persistence ---
  const getCurrentRecords = useCallback(() => {
    return records[currentDate]?.[selectedOutletId] || {};
  }, [records, currentDate, selectedOutletId]);


  // --- Logic Helpers ---
  const getPreviousClosingInternal = (allRecords: AllRecords, itemId: string, date: string, outletId: string) => {
    try {
      const allDates = Object.keys(allRecords).sort((a, b) => b.localeCompare(a));
      for (const d of allDates) {
        if (d < date) {
          const rec = allRecords[d]?.[outletId]?.[itemId];
          if (rec && rec.closing !== undefined) {
            return Number(rec.closing);
          }
        }
      }
      return 0;
    } catch (e) { return 0; }
  };

  const getPreviousClosing = useCallback((itemId: string, date: string, outletId: string) => {
    return getPreviousClosingInternal(records, itemId, date, outletId);
  }, [records]);

  const calculateClosing = useCallback((data: Partial<DailyData>) => {
    const opening = Number(data.opening || 0);
    const received = Number(data.received || 0);
    const transf_in = Number(data.transf_in || 0);
    const sold = Number(data.sold || 0);
    const testing = Number(data.testing || 0);
    const returned = Number(data.returned || 0);
    const transf_out = Number(data.transf_out || 0);
    return opening + received + transf_in - sold - testing - returned - transf_out;
  }, []);

  const calculateSold = useCallback((data: Partial<DailyData>) => {
    const opening = Number(data.opening || 0);
    const received = Number(data.received || 0);
    const transf_in = Number(data.transf_in || 0);
    const closing = Number(data.closing || 0);
    const testing = Number(data.testing || 0);
    const returned = Number(data.returned || 0);
    const transf_out = Number(data.transf_out || 0);
    return (opening + received + transf_in) - (testing + returned + transf_out + closing);
  }, []);


  // Track changes and sync immediately to Firestore for high-integrity multi-user editing
  const handleDataChange = useCallback(async (itemId: string, field: keyof DailyData, value: string | number) => {
    setIsDirty(true);
    
    // Process value
    const processedValue = value === '' ? '' : (isNaN(Number(value)) ? value : Number(value));

    setRecords(prev => {
      const dayRecords = prev[currentDate] || {};
      const outletRecords = dayRecords[selectedOutletId] || {};
      const existingData = outletRecords[itemId];
      
      const currentData = existingData || {
        opening: getPreviousClosingInternal(prev, itemId, currentDate, selectedOutletId),
        received: 0,
        transf_in: 0,
        transf_in_sources: [],
        sold: 0,
        testing: 0,
        returned: 0,
        wastage: 0,
        transf_out: 0,
        transf_out_to: '',
        closing: 0,
        calculationMode: 'sold'
      };

      if (currentData.opening === undefined || currentData.opening === null) {
        currentData.opening = getPreviousClosingInternal(prev, itemId, currentDate, selectedOutletId);
      }

      // Track previous transfer info to update the target/recipient outlet
      const existingMap: Record<string, number> = {};
      const rawMap = currentData.transf_out_map || {};
      Object.entries(rawMap).forEach(([k, v]) => {
        existingMap[k] = Number(v || 0);
      });
      // Backward compatibility: if we have transfusion target but it's not in map yet
      if (currentData.transf_out_to && Number(currentData.transf_out || 0) > 0 && !existingMap[currentData.transf_out_to]) {
        existingMap[currentData.transf_out_to] = Number(currentData.transf_out || 0);
      }

      const newData = { ...currentData, [field]: processedValue };

      if (field === 'transf_out_to') {
        newData.transf_out_to = String(processedValue);
      } else if (field === 'transf_out') {
        let destId = newData.transf_out_to || currentData.transf_out_to || '';
        if (!destId) {
          const activeKeys = Object.entries(existingMap)
            .filter(([_, val]) => Number(val || 0) > 0)
            .map(([k, _]) => k);
          if (activeKeys.length > 0) {
            destId = activeKeys[0];
          }
        }
        if (destId) {
          const numValue = Number(processedValue || 0);
          if (numValue <= 0) {
            delete existingMap[destId];
          } else {
            existingMap[destId] = numValue;
          }
        }
      }

      // Re-sum total transf_out for newData
      const totalTransfOut = Object.entries(existingMap).reduce((sum, [destId, val]) => {
        if (destId) {
          return sum + Number(val || 0);
        }
        return sum;
      }, 0);

      newData.transf_out_map = existingMap;
      newData.transf_out = totalTransfOut;

      const mode = newData.calculationMode || 'sold';
      
      if (field === 'calculationMode') {
        // Mode switch
      } else if (field === 'sold') {
        newData.calculationMode = 'sold';
        newData.closing = calculateClosing(newData);
      } else if (field === 'closing') {
        newData.calculationMode = 'closing';
        newData.sold = calculateSold(newData);
      } else {
        if (mode === 'sold') {
          newData.closing = calculateClosing(newData);
        } else {
          newData.sold = calculateSold(newData);
        }
      }

      let updatedDayRecords = { ...dayRecords };
      updatedDayRecords[selectedOutletId] = {
        ...outletRecords,
        [itemId]: newData
      };

      // Recipient update logic for ALL partner outlets
      const partnerOutletIds = [...OUTLETS.map(o => o.id), 'WASTAGE'];
      
      partnerOutletIds.forEach((partnerId) => {
        const prevQty = currentData.transf_out_map?.[partnerId] ?? (currentData.transf_out_to === partnerId ? Number(currentData.transf_out || 0) : 0);
        const nextQty = newData.transf_out_map?.[partnerId] ?? (newData.transf_out_to === partnerId ? Number(newData.transf_out || 0) : 0);

        if (Number(prevQty) !== Number(nextQty)) {
          if (partnerId && partnerId !== 'WASTAGE') {
            const recipientRecords = updatedDayRecords[partnerId] || {};
            const recipientItemData = recipientRecords[itemId] || {
              opening: getPreviousClosingInternal(prev, itemId, currentDate, partnerId),
              received: 0,
              transf_in: 0,
              transf_in_sources: [],
              sold: 0,
              testing: 0,
              returned: 0,
              wastage: 0,
              transf_out: 0,
              transf_out_to: '',
              closing: 0,
              calculationMode: 'sold'
            };

            const sources = Array.isArray(recipientItemData.transf_in_sources)
              ? [...recipientItemData.transf_in_sources]
              : [];

            const updatedSources = sources.filter(src => src.fromOutletId !== selectedOutletId);
            if (Number(nextQty) > 0) {
              updatedSources.push({ fromOutletId: selectedOutletId, quantity: Number(nextQty) });
            }

            const newTransfIn = updatedSources.reduce((sum, src) => sum + Number(src.quantity || 0), 0);

            const updatedRecipientItemData = {
              ...recipientItemData,
              transf_in: newTransfIn,
              transf_in_sources: updatedSources
            };

            if (updatedRecipientItemData.calculationMode === 'closing') {
              updatedRecipientItemData.sold = calculateSold(updatedRecipientItemData);
            } else {
              updatedRecipientItemData.closing = calculateClosing(updatedRecipientItemData);
            }

            updatedDayRecords[partnerId] = {
              ...recipientRecords,
              [itemId]: updatedRecipientItemData
            };
          }
        }
      });

      return {
        ...prev,
        [currentDate]: updatedDayRecords
      };
    });
  }, [currentDate, selectedOutletId, calculateClosing, calculateSold]);

  const handleRejectTransferReceived = useCallback(async (itemId: string, fromOutletId: string) => {
    try {
      setIsDirty(true);
      
      setRecords(prev => {
        const dayRecords = prev[currentDate] || {};
        
        // --- 1. RECIPIENT (selectedOutletId) PROCESS ---
        const recipientRecords = dayRecords[selectedOutletId] || {};
        const recipientItemData = recipientRecords[itemId];
        
        if (!recipientItemData) return prev; // item record doesn't exist
        
        const oldSources = Array.isArray(recipientItemData.transf_in_sources)
          ? recipientItemData.transf_in_sources
          : [];
        
        // Find matching source
        const targetSrc = oldSources.find(s => s.fromOutletId === fromOutletId);
        if (!targetSrc) return prev; // source not found
        
        const rejectedQty = Number(targetSrc.quantity || 0);
        
        const updatedSources = oldSources.filter(src => src.fromOutletId !== fromOutletId);
        const newTransfIn = updatedSources.reduce((sum, src) => sum + Number(src.quantity || 0), 0);
        
        const updatedRecipientItemData = {
          ...recipientItemData,
          transf_in: newTransfIn,
          transf_in_sources: updatedSources
        };
        
        if (updatedRecipientItemData.calculationMode === 'closing') {
          updatedRecipientItemData.sold = calculateSold(updatedRecipientItemData);
        } else {
          updatedRecipientItemData.closing = calculateClosing(updatedRecipientItemData);
        }
        
        // --- 2. SENDER (fromOutletId) PROCESS ---
        const senderRecords = dayRecords[fromOutletId] || {};
        const senderItemData = senderRecords[itemId] || {
          opening: getPreviousClosingInternal(prev, itemId, currentDate, fromOutletId),
          received: 0,
          transf_in: 0,
          transf_in_sources: [],
          sold: 0,
          testing: 0,
          returned: 0,
          wastage: 0,
          transf_out: 0,
          transf_out_to: '',
          closing: 0,
          calculationMode: 'sold'
        };
        
        const senderMap: Record<string, number> = {};
        const rawMap = senderItemData.transf_out_map || {};
        Object.entries(rawMap).forEach(([k, v]) => {
          senderMap[k] = Number(v || 0);
        });
        
        // Remove or decrease selectedOutletId
        delete senderMap[selectedOutletId];
        
        // Also update transf_out_to if it was selectedOutletId
        let newTransfOutTo = senderItemData.transf_out_to || '';
        if (newTransfOutTo === selectedOutletId) {
          const activeKeys = Object.entries(senderMap)
            .filter(([_, val]) => Number(val || 0) > 0)
            .map(([k, _]) => k);
          newTransfOutTo = activeKeys.length > 0 ? activeKeys[0] : '';
        }
        
        const totalTransfOut = Object.entries(senderMap).reduce((sum, [destId, val]) => {
          if (destId) {
            return sum + Number(val || 0);
          }
          return sum;
        }, 0);
        
        const updatedSenderItemData = {
          ...senderItemData,
          transf_out_map: senderMap,
          transf_out_to: newTransfOutTo,
          transf_out: totalTransfOut
        };
        
        if (updatedSenderItemData.calculationMode === 'closing') {
          updatedSenderItemData.sold = calculateSold(updatedSenderItemData);
        } else {
          updatedSenderItemData.closing = calculateClosing(updatedSenderItemData);
        }
        
        // Build new Day Records copy
        const updatedDayRecords = {
          ...dayRecords,
          [selectedOutletId]: {
            ...recipientRecords,
            [itemId]: updatedRecipientItemData
          },
          [fromOutletId]: {
            ...senderRecords,
            [itemId]: updatedSenderItemData
          }
        };
        
        const itemName = items.find(i => i.id === itemId)?.name || itemId;
        const senderName = OUTLETS.find(o => o.id === fromOutletId)?.name || fromOutletId;
        addNotification(`REJECTED & DELETED: ${rejectedQty} units of ${itemName} from ${senderName}`, 'success');
        
        return {
          ...prev,
          [currentDate]: updatedDayRecords
        };
      });
      
    } catch (e) {
      console.error("Error in handleRejectTransferReceived:", e);
      addNotification("FAILED TO REJECT TRANSFER", "error");
    }
  }, [currentDate, selectedOutletId, calculateClosing, calculateSold, items]);

  // --- Local Storage Auto-Savers ---
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('broomies_db_items', JSON.stringify(items));
    }
  }, [items]);

  useEffect(() => {
    localStorage.setItem('broomies_db_ingredients', JSON.stringify(ingredients));
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem('broomies_db_recipes', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem('broomies_db_requirements', JSON.stringify(requirements));
  }, [requirements]);

  useEffect(() => {
    localStorage.setItem('broomies_db_transfers', JSON.stringify(pendingTransfers));
  }, [pendingTransfers]);

  useEffect(() => {
    localStorage.setItem('broomies_db_daily_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('broomies_db_outlet_permissions', JSON.stringify(permissions));
  }, [permissions]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const [notifications, setNotifications] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([]);
  
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncClipboardText, setSyncClipboardText] = useState('');

  const exportRawDatabase = useCallback(() => {
    const backup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('broomies_db_') || key === 'broomies_app_data_fallback' || key === 'osp_records')) {
        const val = localStorage.getItem(key);
        if (val) {
          backup[key] = val;
        }
      }
    }
    return JSON.stringify(backup, null, 2);
  }, []);

  const importRawDatabase = useCallback((jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (typeof data !== 'object' || data === null) {
        throw new Error("Invalid backup format");
      }
      const keys = Object.keys(data);
      const hasBroomiesKeys = keys.some(key => key.startsWith('broomies_db_') || key === 'broomies_app_data_fallback');
      if (!hasBroomiesKeys) {
        throw new Error("This backup is empty or does not contain Broomies data.");
      }
      
      // Clear current broomies keys to avoid mixup
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('broomies_db_') || key === 'broomies_app_data_fallback')) {
          localStorage.removeItem(key);
        }
      }

      // Save all keys from the backup
      Object.entries(data).forEach(([key, val]) => {
        if (typeof val === 'string') {
          localStorage.setItem(key, val);
        }
      });
      
      return true;
    } catch (err: any) {
      console.error("Import failed:", err);
      return false;
    }
  }, []);

  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const tryLogin = () => {
    if (userRole === 'admin' && passInput === 'Abhi9919') {
      handleLogin('admin', null);
      addNotification('ADMIN ACCESS GRANTED', 'success');
    } else if (userRole === 'outlet' && userOutletId && passInput === 'Broomies' + userOutletId) {
      handleLogin('outlet', userOutletId);
      addNotification(`OUTLET ACCESS GRANTED: ${userOutletId}`, 'success');
    } else {
      addNotification('INCORRECT PASSWORD OR LOCATION. ACCESS DENIED.', 'error');
    }
  };



  useEffect(() => {
    const authStatus = localStorage.getItem('broomies_auth_v2');
    if (authStatus) {
      try {
        const parsed = JSON.parse(authStatus);
        setIsAuthenticated(true);
        setUserRole(parsed.role);
        setUserOutletId(parsed.outletId);
        if (parsed.role === 'outlet') setSelectedOutletId(parsed.outletId);
      } catch (e) {
        localStorage.removeItem('broomies_auth_v2');
      }
    }
  }, []);

  const handleLogin = async (role: UserRole, outletId: string | null) => {
    const sessionData = { role, outletId, timestamp: Date.now() };
    localStorage.setItem('broomies_auth_v2', JSON.stringify(sessionData));
    setIsAuthenticated(true);
    setUserRole(role);
    setUserOutletId(outletId);
    if (role === 'outlet' && outletId) setSelectedOutletId(outletId);
    setView('dashboard');
    setPassInput('');
  };

  const exportToExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      
      // 1. Items Sheet
      const itemsWS = XLSX.utils.json_to_sheet(items);
      XLSX.utils.book_append_sheet(wb, itemsWS, "MasterItems");
      
      // 2. Records Sheet (Flattened)
      const flattenedRecords: any[] = [];
      Object.entries(records).forEach(([date, outlets]) => {
        if (!outlets) return;
        Object.entries(outlets).forEach(([outletId, itemRecords]) => {
          if (outletId === 'batches' || !itemRecords) return; // Skip batches metadata or null records
          Object.entries(itemRecords).forEach(([itemId, data]: any) => {
            if (!data) return;
            flattenedRecords.push({
              Date: date,
              Outlet: outletId,
              ItemID: itemId,
              Opening: data.opening,
              Received: data.received,
              Sold: data.sold,
              Testing: data.testing,
              Returned: data.returned,
              TransfOut: data.transf_out,
              Closing: data.closing
            });
          });
        });
      });
      const recordsWS = XLSX.utils.json_to_sheet(flattenedRecords);
      XLSX.utils.book_append_sheet(wb, recordsWS, "DailyRecords");
      
      // 3. Requirements
      const reqWS = XLSX.utils.json_to_sheet(requirements);
      XLSX.utils.book_append_sheet(wb, reqWS, "Requirements");

      XLSX.writeFile(wb, `Broomies_Data_Backup_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
      addNotification('EXCEL BACKUP DOWNLOADED', 'success');
    } catch (e) {
      console.error("Export error", e);
      addNotification('EXPORT FAILED', 'error');
    }
  }, [items, records, requirements, addNotification]);

  const handleLogout = async () => {
    localStorage.removeItem('broomies_auth_v2');
    setIsAuthenticated(false);
    setUserRole('outlet');
    setUserOutletId(null);
    setPassInput('');
    setShowPassField(false);
    addNotification('SIGNED OUT SECURELY', 'info');
  };

  // --- SYSTEM MAINTENANCE: Recalculate Chain ---
  // This fixes the "Loophole" where changing a previous day doesn't update the next day's opening
  const recalculateStockChain = async () => {
    setLoading(true);
    try {
      const allDates = Object.keys(records).sort((a, b) => a.localeCompare(b));
      const batch = writeBatch(db);
      let count = 0;

      for (let i = 1; i < allDates.length; i++) {
        const prevDate = allDates[i-1];
        const currDate = allDates[i];
        
        OUTLETS.forEach(outlet => {
          const prevOutletRecs = records[prevDate]?.[outlet.id] || {};
          const currOutletRecs = records[currDate]?.[outlet.id] || {};
          
          let changed = false;
          const updatedRecords = { ...currOutletRecs };

          items.forEach(item => {
            const prevClosing = Number(prevOutletRecs[item.id]?.closing || 0);
            const currOpening = Number(currOutletRecs[item.id]?.opening || 0);

            if (prevClosing !== currOpening) {
              const itemData = {
                ...(currOutletRecs[item.id] || {
                  received: 0, sold: 0, testing: 0, returned: 0, transf_out: 0, transf_out_to: '', calculationMode: 'sold'
                }),
                opening: prevClosing
              };
              
              // Re-calculate derived fields
              if (itemData.calculationMode === 'closing') {
                itemData.sold = calculateSold(itemData);
              } else {
                itemData.closing = calculateClosing(itemData);
              }
              
              updatedRecords[item.id] = itemData;
              changed = true;
            }
          });

          if (changed) {
            const docRef = doc(db, DAILY_RECORDS_COL, `${currDate}_${outlet.id}`);
            batch.update(docRef, { records: updatedRecords });
            count++;
          }
        });
      }

      if (count > 0) {
        await batch.commit();
        addNotification(`INTEGRITY FIXED: UPDATED ${count} DAYS OF STOCK`, 'success');
      } else {
        addNotification("SYSTEM INTEGRITY: ALL OPENING BALANCES ARE IN SYNC.", "info");
      }
    } catch (e) {
      console.error("Recalculate error:", e);
      addNotification("RECALCULATE FAILED. CHECK CONSOLE.", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateOutletDistribution = useCallback(async (itemId: string, outletId: string, value: number) => {
    const qty = Number(value);
    if (qty <= 0) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    try {
      const generatedId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5);
      const newTransfer: Transfer = {
        id: generatedId,
        fromOutletId: 'admin',
        toOutletId: outletId,
        itemId: itemId,
        itemName: item.name,
        quantity: qty,
        status: 'pending',
        date: currentDate,
        createdAt: new Date().toISOString()
      };
      setPendingTransfers(prev => [...prev, newTransfer]);

      // Deduct from requirements state
      let updatedReqQty = -1;
      setRequirements(prev => {
        const index = prev.findIndex(r => r.outletId === outletId && r.itemId === itemId);
        if (index > -1) {
          const updated = [...prev];
          const newQty = Math.max(0, updated[index].quantity - qty);
          updatedReqQty = newQty;
          if (newQty === 0) {
            updated.splice(index, 1);
          } else {
            updated[index] = { ...updated[index], quantity: newQty };
          }
          return updated;
        }
        return prev;
      });

      // Synchronize Transfer and Requirement changes directly to Firestore
      try {
        await setDoc(doc(db, TRANSFERS_COL, generatedId), newTransfer);
        if (updatedReqQty !== -1) {
          const reqId = `${outletId}_${itemId}`;
          if (updatedReqQty === 0) {
            await deleteDoc(doc(db, REQUIREMENTS_COL, reqId));
          } else {
            await setDoc(doc(db, REQUIREMENTS_COL, reqId), {
              outletId,
              itemId,
              quantity: updatedReqQty,
              updatedAt: serverTimestamp()
            });
          }
        }
      } catch (err) {
        console.error("Firestore sync error in distribution:", err);
      }

      addNotification(`TRANSFER INITIATED: ${qty} units of ${item.name} sent to ${OUTLETS.find(o => o.id === outletId)?.name}.`, 'success');
    } catch (e) {
      console.error("Error creating transfer:", e);
    }
  }, [items, currentDate, requirements]);

  const handleAcceptTransfer = async (transfer: Transfer) => {
    try {
      let updatedOutlet: any = null;
      // 1. Update DailyRecord state
      setRecords(prev => {
        const dayRecords = prev[transfer.date] || {};
        const outletRecords = dayRecords[transfer.toOutletId] || {};
        const existing = outletRecords[transfer.itemId];
        
        const itemRecord = existing || { 
          opening: getPreviousClosing(transfer.itemId, transfer.date, transfer.toOutletId),
          received: 0, sold: 0, returned: 0, transf_out: 0, testing: 0, closing: 0, calculationMode: 'sold'
        };

        const newReceived = Number(itemRecord.received || 0) + transfer.quantity;
        const newData = { ...itemRecord, received: newReceived };
        
        if (newData.calculationMode === 'closing') {
          newData.sold = calculateSold(newData);
        } else {
          newData.closing = calculateClosing(newData);
        }

        updatedOutlet = { ...outletRecords, [transfer.itemId]: newData };

        return {
          ...prev,
          [transfer.date]: { ...dayRecords, [transfer.toOutletId]: updatedOutlet }
        };
      });

      // Synchronize accepted record and transfer status with Firestore
      if (updatedOutlet) {
        const recordId = `${transfer.date}_${transfer.toOutletId}`;
        await setDoc(doc(db, DAILY_RECORDS_COL, recordId), {
          date: transfer.date,
          outletId: transfer.toOutletId,
          records: updatedOutlet
        }, { merge: true });
      }

      await setDoc(doc(db, TRANSFERS_COL, transfer.id), { status: 'accepted' }, { merge: true });

      // 2. Update transfer status state locally
      setPendingTransfers(prev => 
        prev.map(t => t.id === transfer.id ? { ...t, status: 'accepted' } : t)
      );
      
      addNotification(`TRANSFER ACCEPTED & ADDED TO RECEIVED`, 'success');
    } catch (e) {
      console.error("Accept error:", e);
    }
  };

  const handleRejectTransfer = async (transfer: Transfer) => {
    try {
      // Update transfer status state locally and in Firestore
      setPendingTransfers(prev => 
        prev.map(t => t.id === transfer.id ? { ...t, status: 'rejected' } : t)
      );

      await setDoc(doc(db, TRANSFERS_COL, transfer.id), { status: 'rejected' }, { merge: true });

      addNotification(`TRANSFER REJECTED`, 'info');
    } catch (e) {
      console.error("Reject error:", e);
    }
  };

  const updatePermission = async (outletId: string, key: keyof OutletPermissions, value: boolean) => {
    try {
      let updatedPerm: any = null;
      setPermissions(prev => {
        const outletPerms = prev[outletId] || {
          canEditOpening: true,
          canEditReceived: true,
          canEditReturned: true,
          canEditTransfer: true
        };
        const nextPerms = {
          ...outletPerms,
          [key]: value
        };
        updatedPerm = nextPerms;
        return {
          ...prev,
          [outletId]: nextPerms
        };
      });
      if (updatedPerm) {
        await setDoc(doc(db, 'outlet_permissions', outletId), updatedPerm, { merge: true });
      }
      addNotification(`PERMISSIONS UPDATED`, 'success');
    } catch (error) {
      console.error("Update permissions error", error);
    }
  };

  const saveDailyData = async () => {
    setLoading(true);
    try {
      const recordId = `${currentDate}_${selectedOutletId}`;
      const docRef = doc(db, DAILY_RECORDS_COL, recordId);
      const targetRecords = records[currentDate]?.[selectedOutletId] || {};
      
      await setDoc(docRef, {
        date: currentDate,
        outletId: selectedOutletId,
        records: targetRecords
      }, { merge: true });

      setIsDirty(false);
      addNotification('SUCCESS: RECORDS INSTANTLY SYNCED TO SECURE CLOUD', 'success');
    } catch (e) {
      console.error("Failed to save daily data to Firestore:", e);
      addNotification('CLOUD SYNC FAILURE. RECORD KEPT LOCALLY.', 'error');
      handleFirestoreError(e, OperationType.WRITE, `${DAILY_RECORDS_COL}/${currentDate}_${selectedOutletId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const activeSearchId = 
          view === 'dashboard' ? 'dashboard-search-input' : 
          view === 'items' ? 'catalog-search-input' :
          view === 'reports' ? 'reports-search-input' : null;
        
        if (activeSearchId) {
          const searchInput = document.getElementById(activeSearchId);
          if (searchInput) searchInput.focus();
        }
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const activeSearchId = 
          view === 'dashboard' ? 'dashboard-search-input' : 
          view === 'items' ? 'catalog-search-input' :
          view === 'reports' ? 'reports-search-input' : null;

        if (activeSearchId) {
          const searchInput = document.getElementById(activeSearchId);
          if (searchInput) searchInput.focus();
        }
      }
      if (e.key === 'F2') {
        e.preventDefault();
        saveDailyData();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [saveDailyData, view]);

  const handleRolloverPreviousClosing = useCallback(async () => {
    setIsDirty(true);
    let updatedCount = 0;

    setRecords(prev => {
      const dayRecords = { ...(prev[currentDate] || {}) };
      const outletRecords = { ...(dayRecords[selectedOutletId] || {}) };

      items.forEach((item: any) => {
        if (item.status === 'inactive') return;

        const prevClosing = getPreviousClosingInternal(prev, item.id, currentDate, selectedOutletId);
        const existingData = outletRecords[item.id];
        
        const currentData = existingData ? { ...existingData } : {
          opening: prevClosing,
          received: 0,
          transf_in: 0,
          transf_in_sources: [],
          sold: 0,
          testing: 0,
          returned: 0,
          wastage: 0,
          transf_out: 0,
          transf_out_to: '',
          closing: 0,
          calculationMode: 'sold'
        };

        // Replace the opening stock with the previous day's closing stock
        currentData.opening = Number(prevClosing);

        // Recalculate closing or sold based on mode
        if (currentData.calculationMode === 'sold') {
          currentData.closing = Number(currentData.opening) + Number(currentData.received) + Number(currentData.transf_in || 0) - Number(currentData.sold) - Number(currentData.testing) - Number(currentData.returned) - Number(currentData.transf_out);
        } else {
          currentData.sold = (Number(currentData.opening) + Number(currentData.received) + Number(currentData.transf_in || 0)) - (Number(currentData.testing) + Number(currentData.returned) + Number(currentData.transf_out) + Number(currentData.closing));
        }

        outletRecords[item.id] = currentData;
        updatedCount++;
      });

      dayRecords[selectedOutletId] = outletRecords;
      
      // Save directly to Firestore for safety and real-time sync
      const recordId = `${currentDate}_${selectedOutletId}`;
      setDoc(doc(db, DAILY_RECORDS_COL, recordId), {
        date: currentDate,
        outletId: selectedOutletId,
        records: outletRecords,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error("Error writing rollover records to Firestore:", err);
      });

      return {
        ...prev,
        [currentDate]: dayRecords
      };
    });

    addNotification(`Rolled over previous closing as today's opening stock!`, 'success');
  }, [currentDate, selectedOutletId, items, db, addNotification]);


  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans text-brand-text relative overflow-hidden">
        <BroomiesAestheticBackground />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white border-2 border-brand-border p-8 shadow-[30px_30px_0px_rgba(0,0,0,0.05)] flex flex-col items-center transition-all group relative overflow-hidden z-10"
        >
          <div className="w-16 h-16 bg-brand-text text-white flex items-center justify-center rounded-full mb-6 shadow-xl group-hover:rotate-12 transition-transform">
            <Lock size={28} />
          </div>
          
          <h1 className="text-2xl font-black tracking-tighter uppercase mb-1">BROOMIES SYSTEM</h1>
          <p className="text-[10px] font-bold uppercase tracking-[.5em] opacity-30 mb-8 text-center px-4">Identify Role to Resume Instance</p>
          
          <div className="w-full space-y-4">
            <div className="flex bg-brand-bg p-1 border border-brand-border mb-4">
              <button 
                onClick={() => setUserRole('outlet')}
                className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${userRole === 'outlet' ? 'bg-brand-text text-white' : 'text-brand-text opacity-40'}`}
              >
                Outlet Sign-in
              </button>
              <button 
                onClick={() => { setUserRole('admin'); setUserOutletId(null); }}
                className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${userRole === 'admin' ? 'bg-brand-text text-white' : 'text-brand-text opacity-40'}`}
              >
                Owner/Admin
              </button>
            </div>

            {userRole === 'outlet' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase opacity-50 mb-1 block">Select Location</label>
                  <select 
                    className="w-full bg-brand-bg border border-brand-border p-3 text-xs font-bold font-brand-mono outline-none focus:ring-1 focus:ring-brand-text"
                    value={userOutletId || ''}
                    onChange={e => setUserOutletId(e.target.value)}
                  >
                    <option value="">-- CHOOSE OUTLET --</option>
                    {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="text-[9px] font-black uppercase opacity-50 mb-1 block">
                {userRole === 'admin' ? 'Master Access Code' : 'Location Entry Shield'}
              </label>
              <input 
                type="password"
                placeholder="••••••••"
                className="w-full bg-brand-bg border border-brand-border p-3 text-center text-lg font-black tracking-widest outline-none focus:ring-1 focus:ring-brand-text mb-4"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
              />
              
              <button
                onClick={tryLogin}
                className="w-full bg-brand-text text-white py-4 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg"
              >
                ACCESS SYSTEM
              </button>

              <p className="text-[8px] mt-4 text-center font-bold opacity-30 uppercase tracking-widest leading-relaxed">
                {userRole === 'admin' ? 'Admin session will sync all locations' : 'Contact Admin if location shield is expired'}
              </p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-brand-border w-full text-center">
            <p className="text-[9px] font-mono opacity-50 uppercase tracking-widest"> हैंडक्राफ़्टेड बाय अभिषेक </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 bg-white border border-brand-border animate-spin flex items-center justify-center mb-4">
          <Database size={20} className="text-brand-text" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[.4em] opacity-40">Syncing Broomies Cloud...</p>
      </div>
    );
  }


  const handleSaveAndNextDay = () => {
    saveDailyData();
    const d = currentDate.split('-').map(Number);
    const dateObj = new Date(d[0], d[1] - 1, d[2]);
    const nextDay = format(subDays(dateObj, -1), 'yyyy-MM-dd');
    setCurrentDate(nextDay);
    addNotification(`SWITCHED TO ${nextDay}: OPENING STOCK AUTO-FILLED`, 'info');
  };

  // --- AI / Smart Local Bulk Entry (Highly Resilient Offline Fallbacks) ---
  const handleBulkEntry = async () => {
    const rawLines = bulkText.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) return;
    
    setIsProcessingAI(true);
    const activeItems = items.filter((i: any) => i.status !== 'inactive');
    
    // Helper: Fast edit (Levenshtein) distance for typo matching
    const getEditDistance = (a: string, b: string): number => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        matrix[i] = [i];
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Helper: Heavy-duty normalization for bakery and weight items (e.g. 500 Grm -> 1/2 Kg)
    const getNormalizedMatchingName = (name: string): string => {
      let s = name.toLowerCase();
      // Normalize weights so they align standard catalog weights
      s = s.replace(/\b500\s*(?:grm|gm|g|gram|grams)\b/gi, ' 1/2 kg ');
      s = s.replace(/\b(?:half|0\.5)\s*(?:kg|kilo|kilogram|kilograms)\b/gi, ' 1/2 kg ');
      s = s.replace(/\b1\s*(?:kg|kilo|kilogram|kilograms)\b/gi, ' 1 kg ');
      s = s.replace(/\b1\s*\/\s*2\s*kg\b/gi, ' 1/2 kg ');
      
      // Remove serving info descriptors e.g., (serve 4-6) or with nested braces
      s = s.replace(/\bserve\s*\d+[-to\s]+\d+\b/gi, '');
      
      // Strip out empty parentheses
      s = s.replace(/\(\s*\)/g, '');
      
      // Keep only alphanumeric characters and spaces
      return s.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // Main local line parser that extracts weight, quantity, and calculates similarity score
    const parseAndMatchLine = (line: string, catalogItems: Item[]) => {
      // Clean leading and trailing punctuation (especially trailing commas, semicolons, dashes)
      const trimmedLine = line.trim().replace(/^[,\s;_\-]+|[,\s;_\-]+$/g, '').trim();
      
      let namePart = trimmedLine;
      let amount = 1;
      let isNumericMatch = false;

      // Match trailing quantities (e.g. "Vanilla Cake - 4")
      const trailingMatch = trimmedLine.match(/^(.*?)\s*[:\-=\s]\s*(\d+)$/) || trimmedLine.match(/^(.*?)\s*(\d+)$/);
      // Match leading quantities (e.g. "4 Vanilla Cake")
      const leadingMatch = trimmedLine.match(/^\s*(\d+)\s*(?:x|X|[:\-=\s])\s*(.*)$/) || trimmedLine.match(/^\s*(\d+)\s+(.*)$/);

      if (trailingMatch) {
        namePart = trailingMatch[1].trim();
        amount = parseInt(trailingMatch[2], 10);
        isNumericMatch = true;
      } else if (leadingMatch) {
         amount = parseInt(leadingMatch[1], 10);
         namePart = leadingMatch[2].trim();
         isNumericMatch = true;
      } else {
        // Fallback: extract any digit group to guess the number of units
        const generalMatch = trimmedLine.match(/\d+/);
        amount = generalMatch ? parseInt(generalMatch[0], 10) : 1;
        namePart = trimmedLine.replace(/\d+/g, '').trim();
      }

      // Trim inner separators
      namePart = namePart.replace(/^[:\-=\s\(\)]+|[:\-=\s\(\)]+$/g, '').trim();

      if (!namePart) {
         return { matchedItemId: "", originalText: line, amount, isMatched: false };
      }

      const normUser = getNormalizedMatchingName(namePart);
      const userTokens = normUser.split(' ').filter(t => t.length > 0);

      if (userTokens.length === 0) {
        return { matchedItemId: "", originalText: line, amount, isMatched: false };
      }

      let bestItem: Item | null = null;
      let highestScore = 0;

      for (const item of catalogItems) {
        const normItem = getNormalizedMatchingName(item.name);

        // Match EXACT normalized name immediately
        if (normUser === normItem) {
          bestItem = item;
          highestScore = 1.0;
          break;
        }

        const itemTokens = normItem.split(' ').filter(t => t.length > 0);
        if (itemTokens.length === 0) continue;

        let matches = 0;

        userTokens.forEach(uToken => {
          if (itemTokens.includes(uToken)) {
            matches += 1.0;
            return;
          }

          for (const iToken of itemTokens) {
            // Check prefix containment (e.g. "customise" vs "custom")
            if (uToken.startsWith(iToken) && iToken.length >= 4) {
              matches += 0.85;
              break;
            }
            if (iToken.startsWith(uToken) && uToken.length >= 4) {
              matches += 0.85;
              break;
            }
            // Check substring overlaps
            if (uToken.includes(iToken) && iToken.length >= 3) {
              matches += 0.75;
              break;
            }
            if (iToken.includes(uToken) && uToken.length >= 3) {
              matches += 0.75;
              break;
            }
            // Check small typo edit distance
            const dist = getEditDistance(uToken, iToken);
            if (dist === 1 && Math.max(uToken.length, iToken.length) >= 4) {
              matches += 0.75;
              break;
            }
          }
        });

        // Compute similarity metrics
        const tokenUnionSize = new Set([...userTokens, ...itemTokens]).size;
        const jaccardTokenScore = matches / tokenUnionSize;
        const userCoverage = matches / userTokens.length;

        let score = (userCoverage * 0.6) + (jaccardTokenScore * 0.4);

        // Boost if the starting term aligns (highly indicative of category or main flavor match)
        if (itemTokens[0] && userTokens[0]) {
          if (itemTokens[0] === userTokens[0] || itemTokens[0].startsWith(userTokens[0]) || userTokens[0].startsWith(itemTokens[0])) {
            score += 0.12;
          }
        }

        // Weight match checking (critically important for cake weight variants)
        const hasWeightUser = normUser.includes('1/2 kg') || normUser.includes('1 kg');
        const hasWeightItem = normItem.includes('1/2 kg') || normItem.includes('1 kg');

        if (hasWeightUser && hasWeightItem) {
          const match12 = normUser.includes('1/2 kg') && normItem.includes('1/2 kg');
          const match1 = normUser.includes('1 kg') && normItem.includes('1 kg');
          if (match12 || match1) {
            score += 0.35; // Major weight group alignment boost
          } else {
            score -= 0.6;  // Heavy penalty for different weight variant
          }
        } else if (hasWeightUser && !hasWeightItem) {
          score -= 0.25;
        } else if (!hasWeightUser && hasWeightItem) {
          score -= 0.15;
        }

        // Give a tiny boost for specific brand fits like "farm house" vs "farmhouse"
        if (normUser.replace(/\s+/g, '') === normItem.replace(/\s+/g, '')) {
          score += 0.25;
        }

        if (score > highestScore) {
          highestScore = score;
          bestItem = item;
        }
      }

      const isConfidenceHigh = highestScore >= 0.32;
      return {
        matchedItemId: isConfidenceHigh && bestItem ? bestItem.id : "",
        originalText: line,
        amount: amount,
        isMatched: isConfidenceHigh && !!bestItem
      };
    };

    let finalExtractedData: any[] = [];

    try {
      const response = await fetch("/api/gemini/parse-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: rawLines,
          items: activeItems
        })
      });

      if (!response.ok) {
        throw new Error("DeepSeek server requests failed");
      }

      const aiResults = await response.json();
      if (Array.isArray(aiResults)) {
        finalExtractedData = aiResults;
      } else {
        console.warn("Server did not return a valid array, defaulting to local parser.");
        finalExtractedData = rawLines.map(line => parseAndMatchLine(line, activeItems));
      }
    } catch (error) {
      console.warn("DeepSeek is temporarily busy or unreachable. Successfully processed using emergency offline fallback parser:", error);
      addNotification("DEEPSEEK OFFLINE: INITIATING EMERGENCY BACKUP PARSER", "error");
      finalExtractedData = rawLines.map(line => parseAndMatchLine(line, activeItems));
    }

    try {
      let processed = 0;
      const errors: DailyRecordInput[] = [];
      const newRecords = { ...(records[currentDate]?.[selectedOutletId] || {}) };
      let hasChanges = false;

      finalExtractedData.forEach((entry: any) => {
        if (entry.isMatched && entry.matchedItemId) {
          const matchedItem = items.find(i => i.id === entry.matchedItemId);
          if (matchedItem) {
            const currentData = newRecords[matchedItem.id] || {
              opening: getPreviousClosing(matchedItem.id, currentDate, selectedOutletId),
              received: 0,
              sold: 0,
              testing: 0,
              returned: 0,
              transf_out: 0,
              transf_out_to: '',
              closing: 0
            };
            
            const amount = entry.amount || 0;
            const mode = bulkMode as keyof DailyData;
            currentData[mode] = Math.max(0, bulkAction === 'add' 
               ? (Number(currentData[mode] || 0) + amount) 
               : amount) as any;
              
            currentData.closing = calculateClosing(currentData);
            newRecords[matchedItem.id] = currentData;
            processed++;
            hasChanges = true;
          } else {
            errors.push({ original: entry.originalText, amount: entry.amount });
          }
        } else {
          errors.push({ original: entry.originalText, amount: entry.amount });
        }
      });

      if (hasChanges) setIsDirty(true);

      setRecords(prev => ({
        ...prev,
        [currentDate]: {
          ...prev[currentDate],
          [selectedOutletId]: newRecords
        }
      }));

      if (errors.length > 0) {
        setUnmatchedLines(errors);
        setShowMismatchPopup(true);
      } else {
        addNotification(`SUCCESS! PROCESSED ${processed} ITEMS`, 'success');
        setBulkText('');
      }
    } catch (error) {
      console.error("Bulk entry parsing master failure:", error);
      addNotification("FAILED TO MAP ITEMS. PLEASE CHECK TEXT FORMAT.", "error");
    } finally {
      setIsProcessingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex font-brand-sans antialiased text-brand-text overflow-hidden relative md:pl-64">
      <BroomiesAestheticBackground />
      <Sidebar 
        view={view} 
        setView={setView} 
        selectedOutletId={selectedOutletId} 
        setSelectedOutletId={setSelectedOutletId}
        onLogout={handleLogout}
        userRole={userRole}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onExport={exportToExcel}
      />
      <main className="flex-1 md:ml-0 overflow-hidden relative h-screen transition-all flex flex-col z-10">
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-600 text-white text-[10px] py-2 px-4 shadow-xl z-[100] flex items-center justify-center gap-3 font-black uppercase tracking-widest border-b border-white/20"
          >
            <AlertTriangle size={14} className="animate-pulse" />
            <span>Connection Offline: Data secured in local storage. Auto-syncing when restored.</span>
          </motion.div>
        )}
        {view === 'dashboard' && (
          <DashboardComponent 
            items={items}
            records={records}
            currentDate={currentDate}
            selectedOutletId={selectedOutletId}
            dashboardSearch={dashboardSearch}
            bulkText={bulkText}
            bulkMode={bulkMode}
            bulkAction={bulkAction}
            isDirty={isDirty}
            setBulkText={setBulkText}
            setBulkMode={setBulkMode}
            setBulkAction={setBulkAction}
            setDashboardSearch={setDashboardSearch}
            handleDataChange={handleDataChange}
            handleRejectTransferReceived={handleRejectTransferReceived}
            saveDailyData={saveDailyData}
            handleSaveAndNextDay={handleSaveAndNextDay}
            handleRolloverPreviousClosing={handleRolloverPreviousClosing}
            handleBulkEntry={handleBulkEntry}
            getPreviousClosing={getPreviousClosing}
            getCurrentRecords={getCurrentRecords}
            setCurrentDate={setCurrentDate}
            setSelectedOutletId={setSelectedOutletId}
            isProcessingAI={isProcessingAI}
            userRole={userRole}
            outletPermissions={permissions[selectedOutletId]}
            legacyDataFound={legacyDataFound}
            migrationLoading={migrationLoading}
            migrateLegacyData={migrateLegacyData}
            setIsSidebarOpen={setIsSidebarOpen}
            parserEngine={parserEngine}
            setParserEngine={setParserEngine}
            setShowSyncModal={setShowSyncModal}
          />
        )}
        {view === 'management' && (
          <ManagementComponent 
            permissions={permissions}
            updatePermission={updatePermission}
            setIsSidebarOpen={setIsSidebarOpen}
            recalculateStockChain={recalculateStockChain}
          />
        )}
        {view === 'requirements' && (
          <RequirementsComponent 
            items={items}
            requirements={requirements}
            selectedOutletId={selectedOutletId}
            setIsSidebarOpen={setIsSidebarOpen}
            userRole={userRole}
            records={records}
            currentDate={currentDate}
          />
        )}
        {view === 'items' && (
          <MasterItemsComponent 
            items={items}
            setItems={setItems}
            setIsDirty={setIsDirty}
            catalogSearch={catalogSearch}
            setCatalogSearch={setCatalogSearch}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}
        {view === 'smartTransfer' && (
          <SmartTransferComponent 
            items={items}
            currentDate={currentDate}
            handleDataChange={handleDataChange}
            setIsSidebarOpen={setIsSidebarOpen}
            selectedOutletId={selectedOutletId}
            records={records}
            setRecords={setRecords}
            getPreviousClosingInternal={getPreviousClosingInternal}
            calculateSold={calculateSold}
            calculateClosing={calculateClosing}
          />
        )}
        {view === 'history' && (
          <HistoryPanelComponent 
            records={records}
            setRecords={setRecords}
            oldRecords={oldRecords}
            setOldRecords={setOldRecords}
            setCurrentDate={setCurrentDate}
            setView={setView}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}
        {view === 'reports' && (
          <ReportsComponent 
            records={records}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            items={items}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}
        {view === 'lifecycle' && (
          <LifecycleComponent 
            items={items}
            records={records}
            setRecords={setRecords}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            selectedOutletId={selectedOutletId}
            setSelectedOutletId={setSelectedOutletId}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}
        {view === 'production' && (
          <ProductionComponent 
            items={items}
            records={records}
            setRecords={setRecords}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            setIsSidebarOpen={setIsSidebarOpen}
            getPreviousClosing={getPreviousClosing}
            calculateSold={calculateSold}
            calculateClosing={calculateClosing}
            requirements={requirements}
            updateOutletDistribution={updateOutletDistribution}
          />
        )}
        {view === 'prediction' && (
          <PredictionComponent 
            items={items}
            records={records}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}
        {view === 'globalClosing' && (
          <GlobalClosingComponent 
            items={items}
            records={records}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            setIsSidebarOpen={setIsSidebarOpen}
            getPreviousClosing={getPreviousClosing}
            calculateSold={calculateSold}
            calculateClosing={calculateClosing}
          />
        )}
        {view === 'recipes' && (
          <RecipesComponent items={items} ingredients={ingredients} recipes={recipes} setIsSidebarOpen={setIsSidebarOpen} />
        )}
        {view === 'ledgerSheet' && (
          <LedgerSheetComponent
            items={items}
            records={records}
            setRecords={setRecords}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            getPreviousClosing={getPreviousClosing}
            calculateSold={calculateSold}
            calculateClosing={calculateClosing}
            setIsSidebarOpen={setIsSidebarOpen}
            setPendingTransfers={setPendingTransfers}
          />
        )}
        {view === 'distribution' && (
          <DistributionComponent 
            items={items}
            records={records}
            selectedOutletId={selectedOutletId}
            setSelectedOutletId={setSelectedOutletId}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}

        {/* Popups */}
        {showMismatchPopup && (
          <MismatchModalComponent 
            items={items}
            setItems={setItems}
            unmatchedLines={unmatchedLines}
            setUnmatchedLines={setUnmatchedLines}
            setShowMismatchPopup={setShowMismatchPopup}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleDataChange={handleDataChange}
            bulkMode={bulkMode}
          />
        )}

        {showSyncModal && (
          <div className="fixed inset-0 bg-brand-text/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-brand-text max-w-lg w-full p-6 relative shadow-[12px_12px_0_0_rgba(138,34,20,0.15)] flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncClipboardText('');
                }}
                className="absolute top-4 right-4 text-brand-text opacity-40 hover:opacity-100 transition-opacity active:scale-95"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 border-b-2 border-brand-border pb-3">
                <Database className="text-blue-700" size={24} />
                <div>
                  <h3 className="font-brand-serif italic text-xl text-brand-text">Cross-Site Sync Console</h3>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Broomies Storage Transfer Engine</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-brand-border p-3 space-y-2 text-left">
                <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider leading-relaxed">
                  📢 Why is my data different across sites?
                </p>
                <p className="text-[10px] leading-relaxed text-slate-600">
                  Our database runs on high-speed, secure local browser storage. Because the <strong className="text-brand-text">Preview Site</strong> and the <strong className="text-brand-text">Published Site</strong> have different URLs, the browser separates their databases for security.
                </p>
                <p className="text-[10px] leading-relaxed text-slate-600 font-medium">
                  Use this tool to easily copy all data from your Published Site and import it here, or vice versa!
                </p>
              </div>

              <div className="space-y-3 text-left">
                <div className="border border-brand-border p-3 bg-[#f8f7f4]/50">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8a2214] mb-2">
                    1. Export Data from this site
                  </h4>
                  <p className="text-[10px] text-slate-500 mb-3">
                    Copy the current site's layout & records database to sync to the other site.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const json = exportRawDatabase();
                        navigator.clipboard.writeText(json);
                        addNotification("DATABASE BACKUP COPIED TO CLIPBOARD!", "success");
                      }}
                      className="flex-1 py-2 px-3 border-2 border-brand-text text-[10px] font-bold hover:bg-slate-100 transition-colors uppercase whitespace-nowrap bg-white text-brand-text active:scale-95 duration-100"
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => {
                        const json = exportRawDatabase();
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `broomies_database_backup_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        addNotification("DATABASE BACKUP DOWNLOADED!", "success");
                      }}
                      className="py-2 px-3 border border-brand-border text-[10px] font-bold hover:bg-slate-50 transition-colors uppercase whitespace-nowrap bg-white text-slate-700 active:scale-95 duration-100 flex items-center gap-1"
                    >
                      <Download size={12} /> File
                    </button>
                  </div>
                </div>

                <div className="border border-brand-border p-3 bg-blue-50/20">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-800 mb-2">
                    2. Import Data to this site
                  </h4>
                  <p className="text-[10px] text-slate-500 mb-3">
                    Paste the backup JSON or upload a file retrieved from your other site.
                  </p>
                  
                  <textarea
                    value={syncClipboardText}
                    onChange={(e) => setSyncClipboardText(e.target.value)}
                    placeholder="Paste database JSON here..."
                    className="w-full h-20 text-[10px] font-mono border border-brand-border p-2 outline-none focus:ring-1 focus:ring-blue-500 mb-3 bg-white"
                  />

                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => {
                        if (!syncClipboardText.trim()) {
                          addNotification("PASTE BACKUP CONTENT FIRST", "error");
                          return;
                        }
                        const success = importRawDatabase(syncClipboardText);
                        if (success) {
                          addNotification("IMPORT SUCCESSFUL! REFRESHING PAGE...", "success");
                          setTimeout(() => {
                            window.location.reload();
                          }, 1500);
                        } else {
                          addNotification("INVALID DATABASE FORMAT", "error");
                        }
                      }}
                      className="flex-1 py-1.5 px-3 bg-blue-700 text-[10px] font-bold text-white hover:bg-blue-800 uppercase tracking-widest active:scale-95 transition-all text-center"
                    >
                      Apply & Import
                    </button>

                    <label className="py-1.5 px-3 border border-brand-border text-[10px] font-bold hover:bg-slate-50 transition-colors uppercase whitespace-nowrap bg-white text-slate-600 active:scale-95 duration-100 cursor-pointer flex items-center gap-1">
                      <FileSpreadsheet size={12} />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const resultText = event.target?.result as string;
                            const success = importRawDatabase(resultText);
                            if (success) {
                              addNotification("FILE IMPORTED SUCCESSFULLY!", "success");
                              setTimeout(() => {
                                window.location.reload();
                              }, 1500);
                            } else {
                              addNotification("INVALID BACKUP FILE DETECTED", "error");
                            }
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="text-[9px] text-center opacity-40 font-black uppercase tracking-[0.1em] border-t border-brand-border pt-3">
                BROOMIES CAKE CO. SYNC CONSOLE V2
              </div>
            </motion.div>
          </div>
        )}

        <TransferNotifier 
          transfers={pendingTransfers}
          userOutletId={userOutletId || selectedOutletId}
          onAccept={handleAcceptTransfer}
          onReject={handleRejectTransfer}
        />

        {/* Global Notifications */}
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className={`pointer-events-auto flex items-center gap-3 px-6 py-4 shadow-[10px_10px_0_0_rgba(0,0,0,1)] border-2 border-brand-text ${
                  n.type === 'error' ? 'bg-[#8a2214] text-white' : 
                  n.type === 'info' ? 'bg-blue-600 text-white' : 
                  'bg-white text-brand-text'
                }`}
              >
                {n.type === 'error' && <AlertCircle size={16} />}
                {n.type === 'success' && <CheckCircle2 size={16} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{n.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

const SmartTransferComponent = React.memo(({ items, currentDate, handleDataChange, setIsSidebarOpen, selectedOutletId, records, setRecords, getPreviousClosingInternal, calculateSold, calculateClosing }: any) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [activeTab, setActiveTab] = useState<'qr' | 'ai_bulk'>('qr');
  
  // Existing states
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [transferQty, setTransferQty] = useState<number>(0);
  const [targetOutletId, setTargetOutletId] = useState<string>(() => {
    return localStorage.getItem('broomies_last_scan_outlet') || '';
  });

  // Ensure selected outlet cannot transfer to itself
  useEffect(() => {
    if (targetOutletId && targetOutletId === selectedOutletId) {
      setTargetOutletId('');
    }
  }, [selectedOutletId, targetOutletId]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // New states for AI Bulk Dispatch
  const [detectedCakes, setDetectedCakes] = useState<any[]>([]);
  const [analyzerLoading, setAnalyzerLoading] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [manuallySelectedItemId, setManuallySelectedItemId] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<string | null>("Ready to scan or upload cake crates!");
  const [scannedImages, setScannedImages] = useState<string[]>([]);

  // Webcam stream references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // QR Scanner effect
  useEffect(() => {
    if (activeTab !== 'qr') return;

    // Initialize scanner with camera only preference to avoid "Select Image" button clutter
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [0] // 0 corresponds to Html5QrcodeScanType.SCAN_TYPE_CAMERA
      },
      /* verbose= */ false
    );

    const onScanSuccess = (decodedText: string) => {
      const item = items.find((i: any) => i.barcode === decodedText);
      if (item) {
        setSelectedItem(item);
        setScanError(null);
        // Play small beep or vibrate if supported
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        setScanError(`Item not found: ${decodedText}`);
        setTimeout(() => setScanError(null), 3000);
      }
    };

    const onScanFailure = (error: any) => {};

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        const originalGetElementById = document.getElementById;
        document.getElementById = function(id) {
          if (id === "qr-reader") {
            const el = originalGetElementById.call(document, id);
            if (!el) {
              return document.createElement('div');
            }
            return el;
          }
          return originalGetElementById.call(document, id);
        };

        scannerRef.current.clear()
          .catch(err => console.error("Error clearing scanner:", err))
          .finally(() => {
            document.getElementById = originalGetElementById;
            scannerRef.current = null;
          });
      }
    };
  }, [items, activeTab]);

  // Persist outlet choice whenever it changes
  useEffect(() => {
    if (targetOutletId) {
      localStorage.setItem('broomies_last_scan_outlet', targetOutletId);
    }
  }, [targetOutletId]);

  // Stream effect for AI webcam stream
  const startWebcam = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setWebcamActive(true);
      setAnalysisStatus("Live camera active. Position your tray of cakes in the frame and click 'Capture Tray'!");
    } catch (err) {
      console.error("Camera access failed:", err);
      setWebcamActive(false);
      setAnalysisStatus("Could not start live webcam. Please use the direct taking/attachment uploader below!");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  useEffect(() => {
    if (activeTab === 'ai_bulk' && webcamActive) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [activeTab, webcamActive]);

  const captureFrame = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setScannedImages(prev => [dataUrl, ...prev]);
        processImageWithAI(dataUrl);
      }
    } catch (e) {
      console.error("Frame capture failed:", e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setAnalysisStatus(`Loading ${files.length} image(s)...`);
    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setScannedImages(prev => [reader.result as string, ...prev]);
          processImageWithAI(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const processImageWithAI = async (base64Image: string) => {
    setAnalyzerLoading(true);
    setAnalysisStatus("Broomies AI Chef is scanning the tray...");
    try {
      const response = await fetch('/api/gemini/identify-bulk-cakes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image,
          items: items
        })
      });

      if (!response.ok) {
        throw new Error("Analyzer server error: " + response.statusText);
      }

      const data = await response.json();
      if (data.detectedCakes && Array.isArray(data.detectedCakes)) {
        const detectedCount = data.detectedCakes.length;
        if (detectedCount === 0) {
          setAnalysisStatus("AI scan finished. No cakes identified in this picture. Check lighting or angle.");
          return;
        }

        // Merge into list
        setDetectedCakes(prev => {
          const updated = [...prev];
          data.detectedCakes.forEach((nc: any) => {
            const itemDetails = items.find((it: any) => it.id === nc.matchedItemId);
            
            let finalItemId = nc.matchedItemId;
            let finalName = itemDetails?.name || nc.matchedItemName || "Unknown Cake";
            let finalCategory = itemDetails?.category || "Classic Cakes";

            if (!finalItemId && nc.matchedItemName) {
              const cleanedName = nc.matchedItemName.toLowerCase();
              let matched = null;
              if (cleanedName.includes('red velvet')) {
                matched = items.find((it: any) => it.id === '95'); // Red Velvet 1/2 Kg
              } else if (cleanedName.includes('vanilla')) {
                matched = items.find((it: any) => it.id === '97'); // Vanilla 1/2 Kg
              } else if (cleanedName.includes('truffle') || (cleanedName.includes('chocolate') && !cleanedName.includes('forest'))) {
                matched = items.find((it: any) => it.id === '85'); // Chocolate Truffle 1/2 Kg
              } else if (cleanedName.includes('blueberry') || cleanedName.includes('blue barry')) {
                matched = items.find((it: any) => it.id === '81'); // Blueberry 1/2 Kg
              } else if (cleanedName.includes('forest')) {
                matched = items.find((it: any) => it.id === '79'); // Black Forest 1/2 Kg
              } else if (cleanedName.includes('pineapple')) {
                matched = items.find((it: any) => it.id === '87'); // Pineapple 1/2 Kg
              }

              if (matched) {
                finalItemId = matched.id;
                finalName = matched.name;
                finalCategory = matched.category;
              }
            }

            if (!finalItemId) {
              finalItemId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            }

            const existIndex = updated.findIndex(u => u.itemId === finalItemId);
            if (existIndex > -1) {
              updated[existIndex] = {
                ...updated[existIndex],
                quantity: updated[existIndex].quantity + (nc.quantity || 1)
              };
            } else {
              updated.push({
                itemId: finalItemId,
                name: finalName,
                category: finalCategory,
                quantity: nc.quantity || 1,
                reasoning: nc.reasoning || ""
              });
            }
          });
          return updated;
        });

        setAnalysisStatus(`Successfully identified ${detectedCount} cakes in this picture! Placed in the dispatch list below.`);
      } else {
        setAnalysisStatus("Review finished but payload was invalid. Please try again.");
      }
    } catch (err: any) {
      console.error("AI analysis failure:", err);
      setAnalysisStatus("Error: " + (err.message || "Failed to identify cakes. Please try again."));
    } finally {
      setAnalyzerLoading(false);
    }
  };

  const adjustQty = (itemId: string, diff: number) => {
    setDetectedCakes(prev => prev.map(c => {
      if (c.itemId === itemId) {
        const nextQty = Math.max(1, c.quantity + diff);
        return { ...c, quantity: nextQty };
      }
      return c;
    }));
  };

  const removeRow = (itemId: string) => {
    setDetectedCakes(prev => prev.filter(c => c.itemId !== itemId));
  };

  const addManualCake = () => {
    if (!manuallySelectedItemId) return;
    const catItem = items.find((it: any) => it.id === manuallySelectedItemId);
    if (!catItem) return;

    setDetectedCakes(prev => {
      const existIndex = prev.findIndex(u => u.itemId === catItem.id);
      if (existIndex > -1) {
        return prev.map(c => c.itemId === catItem.id ? { ...c, quantity: c.quantity + 1 } : c);
      } else {
        return [...prev, {
          itemId: catItem.id,
          name: catItem.name,
          category: catItem.category,
          quantity: 1,
          reasoning: "Manually registered item"
        }];
      }
    });
    setManuallySelectedItemId('');
  };

  const commitBulkTransfer = async () => {
    if (detectedCakes.length === 0 || !targetOutletId) return;
    setIsProcessing(true);
    try {
      setRecords(prev => {
        const next = { ...prev };
        if (!next[currentDate]) next[currentDate] = {};
        if (!next[currentDate][targetOutletId]) next[currentDate][targetOutletId] = {};
        const outletRecs = { ...next[currentDate][targetOutletId] };

        detectedCakes.forEach(cake => {
          if (cake.itemId.startsWith('temp_')) return;

          const itemRecord = outletRecs[cake.itemId] || {
            opening: getPreviousClosingInternal(next, cake.itemId, currentDate, targetOutletId),
            received: 0,
            sold: 0,
            testing: 0,
            returned: 0,
            wastage: 0,
            transf_out: 0,
            transf_out_to: '',
            closing: 0,
            calculationMode: 'sold'
          };

          const currentReceived = Number(itemRecord.received || 0);
          const updatedItemRecord = {
            ...itemRecord,
            received: currentReceived + cake.quantity
          };

          if (updatedItemRecord.calculationMode === 'closing') {
            updatedItemRecord.sold = calculateSold(updatedItemRecord);
          } else {
            updatedItemRecord.closing = calculateClosing(updatedItemRecord);
          }

          outletRecs[cake.itemId] = updatedItemRecord;
        });

        next[currentDate][targetOutletId] = outletRecs;
        return next;
      });

      alert(`SUCCESS: Dispatched ${detectedCakes.length} items to ${OUTLETS.find(o => o.id === targetOutletId)?.name || targetOutletId}!`);
      setDetectedCakes([]);
      setScannedImages([]);
      setAnalysisStatus("Dispatched successfully! Tray list reset.");
    } catch (err) {
      console.error("Bulk transfer error:", err);
      alert("Failed to submit bulk dispatch.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getCakeBadges = (name: string) => {
    const lname = name.toLowerCase();
    if (lname.includes('red velvet')) {
      return {
        bg: 'border-l-4 border-l-red-600 bg-red-50/50 hover:bg-red-50 text-red-950',
        dot: 'bg-red-600',
        label: 'Red Velvet'
      };
    }
    if (lname.includes('vanilla')) {
      return {
        bg: 'border-l-4 border-l-pink-400 bg-pink-50/30 hover:bg-pink-50 text-pink-950',
        dot: 'bg-pink-400',
        label: 'Vanilla Sprinkles'
      };
    }
    if (lname.includes('truffle') || (lname.includes('chocolate') && !lname.includes('forest'))) {
      return {
        bg: 'border-l-4 border-l-amber-900 bg-amber-50/40 hover:bg-amber-105 text-amber-950',
        dot: 'bg-yellow-800',
        label: 'Chocolate Truffle'
      };
    }
    if (lname.includes('blueberry') || lname.includes('blue barry')) {
      return {
        bg: 'border-l-4 border-l-purple-600 bg-purple-50/50 hover:bg-purple-50 text-purple-950',
        dot: 'bg-purple-600',
        label: 'Blueberry Pond'
      };
    }
    if (lname.includes('forest')) {
      return {
        bg: 'border-l-4 border-l-rose-950 bg-rose-50/40 hover:bg-rose-50 text-rose-950',
        dot: 'bg-rose-600',
        label: 'Black Forest'
      };
    }
    if (lname.includes('pineapple')) {
      return {
        bg: 'border-l-4 border-l-yellow-500 bg-yellow-50/30 hover:bg-yellow-50 text-yellow-950',
        dot: 'bg-yellow-400',
        label: 'Pineapple Pond'
      };
    }
    return {
      bg: 'border-l-4 border-l-slate-400 bg-slate-50/50 hover:bg-slate-100 text-slate-900',
      dot: 'bg-slate-500',
      label: 'Store Asset'
    };
  };

  // Legacy barcode dispatch
  const commitTransfer = async () => {
    if (!selectedItem || !targetOutletId || transferQty <= 0) return;
    setIsProcessing(true);
    try {
      setRecords(prev => {
        const next = { ...prev };
        if (!next[currentDate]) next[currentDate] = {};
        if (!next[currentDate][targetOutletId]) next[currentDate][targetOutletId] = {};
        const outletRecs = { ...next[currentDate][targetOutletId] };

        const itemRecord = outletRecs[selectedItem.id] || {
          opening: getPreviousClosingInternal(next, selectedItem.id, currentDate, targetOutletId),
          received: 0,
          sold: 0,
          testing: 0,
          returned: 0,
          wastage: 0,
          transf_out: 0,
          transf_out_to: '',
          closing: 0,
          calculationMode: 'sold'
        };

        const currentReceived = Number(itemRecord.received || 0);
        const updatedItemRecord = {
          ...itemRecord,
          received: currentReceived + transferQty
        };

        if (updatedItemRecord.calculationMode === 'closing') {
          updatedItemRecord.sold = calculateSold(updatedItemRecord);
        } else {
          updatedItemRecord.closing = calculateClosing(updatedItemRecord);
        }

        outletRecs[selectedItem.id] = updatedItemRecord;
        next[currentDate][targetOutletId] = outletRecs;
        return next;
      });

      alert(`SUCCESS: ${transferQty} ${selectedItem.name} sent to ${OUTLETS.find(o => o.id === targetOutletId)?.name}`);
      setSelectedItem(null);
      setTransferQty(0);
    } catch (err) {
      console.error("Transfer error:", err);
      alert("Failed to process transfer.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f7f4]/85 backdrop-blur-md">
      {/* Upper header */}
      <div className="p-8 border-b-2 border-brand-text bg-white shrink-0 flex items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center shrink-0">
            <Menu size={20} />
          </button>
          <div>
            <h2 className="text-4xl font-brand-serif italic text-brand-text uppercase leading-none">Smart Dispatch</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">Broomies Cargo Routing Dashboard</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-2 border-brand-text bg-slate-50 p-1">
          <button 
            onClick={() => {
              setActiveTab('qr');
              setWebcamActive(false);
            }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'qr' ? 'bg-brand-text text-white shadow' : 'text-brand-text/60 hover:text-brand-text'}`}
          >
            <QrCode size={14} /> Barcode Scanner
          </button>
          <button 
            onClick={() => setActiveTab('ai_bulk')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'ai_bulk' ? 'bg-brand-text text-white shadow' : 'text-brand-text/60 hover:text-brand-text'}`}
          >
            <Sparkles size={14} /> AI Bulk Visual Scanner
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 flex flex-col lg:flex-row gap-8 overflow-y-auto">
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Active Work Panel */}
          {activeTab === 'qr' ? (
            <div className="bg-white border-4 border-brand-text p-6 shadow-[16px_16px_0_0_rgba(0,0,0,1)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-brand-text animate-pulse"></div>
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-text text-white flex items-center justify-center">
                     <Scan size={20} />
                  </div>
                  <div>
                     <h3 className="font-bold uppercase tracking-widest text-sm">Active Barcode Camera</h3>
                     <p className="text-[9px] opacity-50 font-bold uppercase">Ready for Barcode Input</p>
                  </div>
               </div>
               
               <div id="qr-reader" className="w-full border-2 border-brand-border bg-slate-50 min-h-[300px]"></div>
               
               {scanError && (
                 <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-widest animate-bounce">
                    {scanError}
                 </div>
               )}
            </div>
          ) : (
            <div className="bg-white border-4 border-brand-text p-6 shadow-[16px_16px_0_0_rgba(0,0,0,1)] relative overflow-hidden flex flex-col gap-6">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-text animate-pulse"></div>
              
              <div className="flex items-center justify-between border-b pb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 text-white flex items-center justify-center">
                       <ChefHat size={20} />
                    </div>
                    <div>
                       <h3 className="font-bold uppercase tracking-widest text-sm">AI Bulk Basket Scanner</h3>
                       <p className="text-[9px] text-purple-600 font-bold uppercase">Instant cake & tray analysis with Gemini</p>
                    </div>
                 </div>
                 
                 {/* Live stream toggle */}
                 <button 
                  onClick={() => setWebcamActive(!webcamActive)}
                  className={`px-4 h-10 border-2 border-brand-text font-black text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all ${webcamActive ? 'bg-red-500 text-white border-red-600' : 'bg-white text-brand-text hover:bg-slate-50'}`}
                 >
                   <Camera size={14} />
                   {webcamActive ? 'STOP LIVE CAMERA' : 'START LIVE CAMERA'}
                 </button>
              </div>

              {/* Status Banner */}
              {analysisStatus && (
                <div className="p-3 bg-purple-50 border border-purple-200 text-purple-950 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                  <Sparkles size={14} className="animate-spin text-purple-600 shrink-0" />
                  <span>{analysisStatus}</span>
                </div>
              )}

              {/* Capture Box */}
              <div className="relative border-4 border-dashed border-slate-200 bg-slate-50 rounded-lg min-h-[320px] flex flex-col items-center justify-center overflow-hidden p-6 text-center">
                {webcamActive ? (
                  <div className="absolute inset-0 w-full h-full bg-black flex flex-col justify-between">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    <div className="absolute bottom-6 left-0 w-full flex justify-center z-10">
                      <button 
                        disabled={analyzerLoading}
                        onClick={captureFrame}
                        className="px-8 h-14 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)] border border-black/30"
                      >
                        {analyzerLoading ? <Loader2 className="animate-spin" /> : <Camera size={18} />}
                        {analyzerLoading ? 'ANALYZING...' : 'CAPTURE CAKE BASKET'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                      <Camera size={36} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wider text-brand-text">Snap Tray or Upload Images</p>
                      <p className="text-[10px] opacity-60 uppercase font-bold max-w-sm mt-1">Our AI instantly identifies Red Velvet, Chocolate, Vanilla, Blueberry, Black Forest, & Pineapple Cakes in less than a second!</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <button 
                        onClick={() => setWebcamActive(true)}
                        className="px-6 h-12 bg-purple-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-purple-700 transition-all flex items-center gap-2 shadow"
                      >
                        <Camera size={14} /> USE WEBCAM
                      </button>
                      <label className="px-6 h-12 bg-white text-brand-text border-2 border-brand-text font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer shadow">
                        <Download size={14} className="rotate-180" /> UPLOAD PHOTOS
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={handleFileUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>
                )}

                {analyzerLoading && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 z-20">
                    <Loader2 className="animate-spin text-purple-600" size={48} />
                    <div className="text-center">
                      <p className="text-lg font-brand-serif italic text-purple-900 animate-pulse uppercase font-black">AI Chef is Analyzing Tray Layout...</p>
                      <p className="text-[10px] text-purple-600 uppercase tracking-widest font-black max-w-xs mt-2">Differentiating Velvet Red, Blueberry pools, Sprinkle White & Truffle shapes...</p>
                    </div>
                    <div className="w-48 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 animate-[pulse_1.5s_infinite]" style={{width: '75%'}}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scanned Images Strip */}
              {scannedImages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Captured Crates ({scannedImages.length})</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {scannedImages.map((src, i) => (
                      <div key={i} className="w-16 h-16 border-2 border-brand-text shrink-0 relative rounded overflow-hidden shadow">
                        <img src={src} className="w-full h-full object-cover" />
                        <div className="absolute top-0 right-0 p-0.5 bg-black/60 text-[8px] text-white">#{scannedImages.length - i}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Quick Guide */}
          <div className="bg-amber-50/50 border-2 border-dashed border-brand-text/20 p-6">
             <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40 italic">System Manual:</h4>
             {activeTab === 'qr' ? (
               <ul className="text-[10px] font-bold uppercase space-y-2 opacity-60">
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-brand-text text-white flex shrink-0 items-center justify-center text-[8px]">1</span> Scan item barcode using camera</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-brand-text text-white flex shrink-0 items-center justify-center text-[8px]">2</span> Verify item name on appearing dialog</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-brand-text text-white flex shrink-0 items-center justify-center text-[8px]">3</span> Enter quantity & select destination</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-brand-text text-white flex shrink-0 items-center justify-center text-[8px]">4</span> Confirm to update outlet stocks instantly</li>
               </ul>
             ) : (
               <ul className="text-[10px] font-bold uppercase space-y-2 opacity-60">
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-purple-600 text-white flex shrink-0 items-center justify-center text-[8px]">1</span> Point device camera to cake crates/trays or select files</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-purple-600 text-white flex shrink-0 items-center justify-center text-[8px]">2</span> Gemini reads cake design features & populates quantities in the draft list immediately</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-purple-600 text-white flex shrink-0 items-center justify-center text-[8px]">3</span> Adjust table quantities or add manual items if needed</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-purple-600 text-white flex shrink-0 items-center justify-center text-[8px]">4</span> Select target outlet & hit dispatch to credit their received stock immediately!</li>
               </ul>
             )}
          </div>
        </div>

        {/* Right Dispatch / Verification Control Row */}
        <div className="lg:w-[420px] shrink-0 flex flex-col gap-6">
           <div className="bg-brand-text text-white p-6 shadow-xl space-y-2">
              <div className="flex items-center gap-2 opacity-50 mb-1">
                 <ShieldCheck size={14} />
                 <span className="text-[9px] font-bold uppercase tracking-widest">Admin Authorization Verified</span>
              </div>
              <h3 className="text-xl font-brand-serif italic">Operational Controls</h3>
              <p className="text-[10px] leading-relaxed opacity-70">Review lists securely before syncing inventory records to Firebase outlet storage.</p>
           </div>
           
           {activeTab === 'qr' ? (
             <div className="bg-white border border-brand-border p-6 flex-1 flex flex-col justify-center items-center text-center shadow">
                {!selectedItem ? (
                  <div className="opacity-20 flex flex-col items-center py-12">
                     <div className="w-20 h-20 border-4 border-dashed border-brand-text rounded-full mb-4 flex items-center justify-center">
                        <Plus size={32} />
                     </div>
                     <p className="text-xs font-black uppercase tracking-widest">Waiting for scan...</p>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full space-y-6"
                  >
                     <div className="p-4 bg-slate-50 border border-brand-border w-full text-left">
                        <div className="text-[8px] font-black opacity-30 uppercase tracking-widest mb-1">Detected Item</div>
                        <div className="text-xl font-brand-serif italic text-brand-text leading-tight uppercase">{selectedItem.name}</div>
                        <div className="text-[9px] font-black bg-brand-text text-white inline-block px-2 py-0.5 mt-2 uppercase tracking-tighter">{selectedItem.category}</div>
                     </div>

                     <div className="space-y-4 text-left">
                        <div>
                          <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Quantity to Transfer</label>
                          <input 
                            type="number"
                            className="w-full p-4 border border-brand-border font-brand-mono text-2xl outline-none focus:ring-2 focus:ring-brand-text"
                            value={transferQty || ''}
                            onChange={e => setTransferQty(Number(e.target.value))}
                            autoFocus
                          />
                        </div>
                        
                        <div>
                          <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Destination Outlet</label>
                          <select 
                            className="w-full p-4 border border-brand-border font-black uppercase text-xs outline-none bg-white"
                            value={targetOutletId}
                            onChange={e => setTargetOutletId(e.target.value)}
                          >
                            <option value="">Choose Outlet...</option>
                            {OUTLETS.filter(o => o.id !== selectedOutletId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                     </div>

                     <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedItem(null)}
                          className="flex-1 h-14 border-2 border-brand-text text-brand-text font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          disabled={!targetOutletId || transferQty <= 0 || isProcessing}
                          onClick={commitTransfer}
                          className={`flex-1 h-14 bg-brand-text text-white font-black uppercase text-[10px] tracking-widest shadow flex items-center justify-center gap-2 transition-all ${(!targetOutletId || transferQty <= 0 || isProcessing) ? 'opacity-20 cursor-not-allowed' : 'active:scale-95 hover:bg-black'}`}
                        >
                          {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />} 
                          {isProcessing ? 'PROCESSING...' : 'CONFIRM DISPATCH'}
                        </button>
                     </div>
                  </motion.div>
                )}
             </div>
           ) : (
             <div className="bg-white border-2 border-brand-text p-6 flex-1 flex flex-col justify-between shadow relative">
                
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-center bg-slate-100 p-2 border-b border-brand-border">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Dispatched Cake Draft</span>
                    <span className="text-[10px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full">{detectedCakes.length} types</span>
                  </div>

                  {/* Registered Cakes List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
                    {detectedCakes.length === 0 ? (
                      <div className="py-12 text-center opacity-30 flex flex-col items-center">
                        <ChefHat size={32} className="mb-2 text-purple-600 animate-bounce" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No cakes parsed yet</p>
                        <p className="text-[9px] lowercase italic">take a photo or select pictures of pastries</p>
                      </div>
                    ) : (
                      detectedCakes.map((cake, idx) => {
                        const styleMeta = getCakeBadges(cake.name);
                        return (
                          <motion.div 
                            key={cake.itemId} 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-3 border-2 border-brand-border rounded shadow-sm flex items-center justify-between transition-all ${styleMeta.bg}`}
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${styleMeta.dot}`}></span>
                                <span className="text-[8px] font-black uppercase tracking-wide opacity-50">{styleMeta.label}</span>
                              </div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 truncate">{cake.name}</h4>
                              {cake.reasoning && (
                                <p className="text-[9px] text-slate-500 italic leading-none mt-1 line-clamp-1">{cake.reasoning}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Quantity Control Buttons */}
                              <div className="flex items-center border border-brand-border bg-white rounded overflow-hidden">
                                <button 
                                  onClick={() => adjustQty(cake.itemId, -1)}
                                  className="w-7 h-7 flex items-center justify-center font-black bg-slate-50 text-slate-800 hover:bg-slate-100 active:bg-slate-200"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-brand-mono text-xs font-black text-brand-text">{cake.quantity}</span>
                                <button 
                                  onClick={() => adjustQty(cake.itemId, 1)}
                                  className="w-7 h-7 flex items-center justify-center font-black bg-slate-50 text-slate-800 hover:bg-slate-100 active:bg-slate-200"
                                >
                                  +
                                </button>
                              </div>

                              {/* Remove Line */}
                              <button 
                                onClick={() => removeRow(cake.itemId)}
                                className="w-7 h-7 border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 flex items-center justify-center rounded transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>

                  {/* Manual addition fallback */}
                  <div className="border-t pt-3 space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-wider opacity-50 block">Manual Add Deviation</label>
                    <div className="flex gap-2">
                      <select 
                        value={manuallySelectedItemId} 
                        onChange={e => setManuallySelectedItemId(e.target.value)}
                        className="flex-1 p-2 border border-brand-border text-xs uppercase font-bold outline-none bg-white"
                      >
                        <option value="">Select Cake...</option>
                        {items
                          .filter((it: any) => it.category?.toLowerCase().includes('cake') || it.category?.toLowerCase().includes('pastry'))
                          .map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)
                        }
                      </select>
                      <button 
                        onClick={addManualCake}
                        disabled={!manuallySelectedItemId}
                        className="px-4 h-9 bg-brand-text text-white font-black uppercase text-[9px] tracking-widest hover:bg-black transition-all disabled:opacity-30"
                      >
                        ADD
                      </button>
                    </div>
                  </div>

                  {/* Destination & Commit bar */}
                  <div className="border-t pt-3 space-y-3">
                    <div>
                      <label className="text-[8px] font-black uppercase opacity-45 mb-1 block">Select Destination Outlet</label>
                      <select 
                        className="w-full p-2.5 border-2 border-brand-text font-black uppercase text-xs outline-none bg-white"
                        value={targetOutletId}
                        onChange={e => setTargetOutletId(e.target.value)}
                      >
                        <option value="">Choose Outlet...</option>
                        {OUTLETS.filter(o => o.id !== selectedOutletId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>

                    <button 
                      disabled={detectedCakes.length === 0 || !targetOutletId || isProcessing}
                      onClick={commitBulkTransfer}
                      className={`w-full h-14 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all ${((detectedCakes.length === 0 || !targetOutletId || isProcessing)) ? 'opacity-20 cursor-not-allowed' : 'active:scale-95'}`}
                    >
                      {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {isProcessing ? 'CREATING STOCKS...' : `CONFIRM ${detectedCakes.reduce((tot, c) => tot + c.quantity, 0)} CAKES DISPATCH`}
                    </button>
                  </div>

                </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
});

const LifecycleComponent = React.memo(({ items, records, setRecords, currentDate, setCurrentDate, selectedOutletId, setSelectedOutletId, setIsSidebarOpen }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localOutletFilter, setLocalOutletFilter] = useState(selectedOutletId || 'all');
  const activeOutlets = useMemo(() => {
    if (localOutletFilter === 'all') return OUTLETS;
    return OUTLETS.filter(o => o.id === localOutletFilter);
  }, [localOutletFilter]);
  
  const [selectedDetail, setSelectedDetail] = useState<{item: any, outlet: any, data: any} | null>(null);

  // Reset & Table Upload States
  const [showResetWizard, setShowResetWizard] = useState(false);
  const [rawTableText, setRawTableText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isSavingRows, setIsSavingRows] = useState(false);
  const [isSuccessfullySaved, setIsSuccessfullySaved] = useState(false);
  const [overwriteDailyMetrics, setOverwriteDailyMetrics] = useState(true);

  const getExpiryStatus = (category: string, prodDateStr: string) => {
    const cat = category?.toLowerCase() || '';
    const isPastry = cat.includes('pastry');
    const isCake = cat.includes('cake');
    
    // Default shelf life
    let limit = 7; 
    if (isCake) limit = 4;
    else if (isPastry) limit = 2.5;

    const prodDate = prodDateStr ? new Date(prodDateStr) : new Date();
    const currDate = currentDate ? new Date(currentDate) : new Date();
    
    if (isNaN(prodDate.getTime()) || isNaN(currDate.getTime())) {
      return { label: 'ERROR', color: 'bg-gray-400', isCritical: false };
    }

    const diffDays = (currDate.getTime() - prodDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays >= limit) return { label: 'EXPIRED', color: 'bg-red-600', isCritical: true };
    if (diffDays >= limit - 0.5) return { label: 'CRITICAL', color: 'bg-orange-500', isCritical: true };
    if (diffDays < 1) return { label: 'FRESH', color: 'bg-green-500', isCritical: false };
    return { label: 'STABLE', color: 'bg-blue-500', isCritical: false };
  };

  const getExpiryDate = (category: string, prodDateStr: string) => {
    const cat = category?.toLowerCase() || '';
    const isPastry = cat.includes('pastry');
    const isCake = cat.includes('cake');
    
    let days = 7;
    if (isCake) days = 4;
    else if (isPastry) days = 2.5;

    const date = new Date(prodDateStr);
    date.setHours(date.getHours() + (days * 24));
    return format(date, 'dd MMM (HH:mm)');
  };

  // Core FIFO Processor
  const fifoData = useMemo(() => {
    const results: { [itemId: string]: { [outletId: string]: { total: number, batches: any[], highestRisk: number, buckets: { today: number, yesterday: number, older: number } } } } = {};
    const sortedDates = Object.keys(records || {}).sort((a, b) => a.localeCompare(b));

    const todayStr = currentDate;
    const yesterdayDate = subDays(new Date(currentDate), 1);
    const yesterdayStr = isValid(yesterdayDate) ? format(yesterdayDate, 'yyyy-MM-dd') : '';

    items.forEach((item: any) => {
      results[item.id] = {};
      activeOutlets.forEach(o => {
        results[item.id][o.id] = { 
          total: 0, 
          batches: [], 
          highestRisk: 0, 
          buckets: { today: 0, yesterday: 0, older: 0 } 
        };
      });
    });

    sortedDates.forEach(date => {
      if (date > currentDate) return; 

      const dayRecords = records[date] || {};
      
      items.forEach((item: any) => {
        activeOutlets.forEach(outlet => {
          const raw = dayRecords[outlet.id]?.[item.id] || {};
          const received = Number(raw.received || 0);
          const consumed = Number(raw.sold || 0) + Number(raw.returned || 0) + Number(raw.transf_out || 0) + Number(raw.testing || 0);

          let outletStock = results[item.id][outlet.id];

          if (received > 0) {
            outletStock.batches.push({ date, quantity: received });
          }

          let toRemove = consumed;
          while (toRemove > 0 && outletStock.batches.length > 0) {
            const oldest = outletStock.batches[0];
            if (oldest.quantity <= toRemove) {
              toRemove -= oldest.quantity;
              outletStock.batches.shift();
            } else {
              oldest.quantity -= toRemove;
              toRemove = 0;
            }
          }
          
          outletStock.total = outletStock.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
          
          // Re-calculate buckets and risk
          outletStock.buckets = { today: 0, yesterday: 0, older: 0 };
          outletStock.highestRisk = 0;

          outletStock.batches.forEach(b => {
             if (b.date === todayStr) outletStock.buckets.today += b.quantity;
             else if (b.date === yesterdayStr) outletStock.buckets.yesterday += b.quantity;
             else outletStock.buckets.older += b.quantity;

             const status = getExpiryStatus(item.category, b.date);
             let riskValue = 0;
             if (status.label === 'EXPIRED') riskValue = 3;
             else if (status.label === 'CRITICAL') riskValue = 2;
             else if (status.label === 'STABLE') riskValue = 1;
             outletStock.highestRisk = Math.max(outletStock.highestRisk, riskValue);
          });
        });
      });
    });

    return results;
  }, [items, records, currentDate, activeOutlets]);

  // SMART AUTO PARSING UTILITIES
  const matchDateText = (rawText: string, defaultDate: string) => {
    // Try YYYY-MM-DD
    let match = rawText.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (match) return match[0];

    // Try DD-MM-YYYY or DD/MM/YYYY
    match = rawText.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
    if (match) {
      const d = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      let y = match[3];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }

    return defaultDate;
  };

  const matchOutletText = (rawText: string) => {
    const clean = rawText.toLowerCase();
    
    if (clean.includes('31') || clean.includes('sec 31') || clean.includes('sec31')) {
      return OUTLETS.find(o => o.id === '31');
    }
    if (clean.includes('42') || clean.includes('sec 42') || clean.includes('sec42')) {
      return OUTLETS.find(o => o.id === '42');
    }
    if (clean.includes('35') || clean.includes('sec 35') || clean.includes('sec35')) {
      return OUTLETS.find(o => o.id === '35');
    }
    if (clean.includes('88') || clean.includes('sec 88') || clean.includes('sec88')) {
      return OUTLETS.find(o => o.id === '88');
    }
    if (clean.includes('bk') || clean.includes('base kitchen') || clean.includes('kitchen')) {
      return OUTLETS.find(o => o.id === 'bk');
    }

    for (const outlet of OUTLETS) {
      if (clean.includes(outlet.name.toLowerCase()) || clean.includes(outlet.id)) {
        return outlet;
      }
    }
    return null;
  };

  const matchItemByName = (rawText: string, itemsList: any[]) => {
    const cleanText = rawText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    
    let bestMatch: any = null;
    let highestScore = 0;

    itemsList.forEach(item => {
      const cat = (item.category || '').toLowerCase();
      if (!cat.includes('cake') && !cat.includes('pastry') && !cat.includes('cookie') && !cat.includes('sweet')) {
        return;
      }

      const cleanItemName = item.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
      const itemWords = cleanItemName.split(/\s+/).filter((w: string) => w.length > 2);
      
      let score = 0;
      
      if (cleanText.includes(item.name.toLowerCase())) {
        score += 25;
      } else {
        itemWords.forEach((iw: string) => {
          if (cleanText.includes(iw)) {
            score += 5;
          }
        });
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    });

    return { item: bestMatch, score: highestScore };
  };

  const matchQuantityText = (rawLine: string, dateStr: string) => {
    let clean = rawLine;
    
    if (dateStr) {
      clean = clean.replace(dateStr, '');
      const parts = dateStr.split('-');
      parts.forEach(p => {
        clean = clean.replace(p, '');
      });
    }

    const matches = clean.match(/\b\d+\b/g);
    if (matches && matches.length > 0) {
      for (const numStr of matches) {
        const num = parseInt(numStr, 10);
        if (num > 0 && num < 1000) return num;
      }
    }
    return 1;
  };

  const handleParseTable = () => {
    if (!rawTableText.trim()) return;

    const lines = rawTableText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results: any[] = [];

    lines.forEach((line, idx) => {
      const normalized = line.toLowerCase();
      if ((normalized.includes('date') || normalized.includes('day')) && 
          (normalized.includes('item') || normalized.includes('cake') || normalized.includes('qty') || normalized.includes('outlet'))) {
        return;
      }

      const dateStr = matchDateText(line, currentDate);
      const outlet = matchOutletText(line) || OUTLETS[0];
      const { item: matchedItem } = matchItemByName(line, items);
      const quantity = matchQuantityText(line, dateStr);

      results.push({
        id: `row_${idx}_${Date.now()}`,
        dateStr,
        outletId: outlet.id,
        itemId: matchedItem ? matchedItem.id : '',
        quantity,
        rawLine: line,
      });
    });

    setParsedRows(results);
    setIsSuccessfullySaved(false);
  };

  const handleLoadPresetUserBatchData = () => {
    const PRESET_DATA = [
      // 1. Chocolate Truffle 1/2kg (85)
      { dateStr: '2026-05-19', outletId: '42', itemId: '85', quantity: 3, rawLine: 'Chocolate Truffle 1/2kg (Sec 42)' },
      { dateStr: '2026-05-18', outletId: '35', itemId: '85', quantity: 2, rawLine: 'Chocolate Truffle 1/2kg (Sec 35)' },
      { dateStr: '2026-05-16', outletId: 'bk', itemId: '85', quantity: 1, rawLine: 'Chocolate Truffle 1/2kg (Base Kitchen)' },
      { dateStr: '2026-05-17', outletId: 'bk', itemId: '85', quantity: 1, rawLine: 'Chocolate Truffle 1/2kg (Base Kitchen)' },
      { dateStr: '2026-05-18', outletId: 'bk', itemId: '85', quantity: 1, rawLine: 'Chocolate Truffle 1/2kg (Base Kitchen)' },

      // 2. Chocolate Truffle 1 Kg (84)
      { dateStr: '2026-05-18', outletId: '31', itemId: '84', quantity: 1, rawLine: 'Chocolate Truffle 1 Kg (Sec 31)' },
      { dateStr: '2026-05-16', outletId: '42', itemId: '84', quantity: 1, rawLine: 'Chocolate Truffle 1 Kg (Sec 42)' },
      { dateStr: '2026-05-16', outletId: '35', itemId: '84', quantity: 1, rawLine: 'Chocolate Truffle 1 Kg (Sec 35)' },
      { dateStr: '2026-05-20', outletId: 'bk', itemId: '84', quantity: 1, rawLine: 'Chocolate Truffle 1 Kg (Base Kitchen)' },

      // 3. Pineapple 1/2 Kg (87)
      { dateStr: '2026-05-20', outletId: '42', itemId: '87', quantity: 1, rawLine: 'Pineapple 1/2 Kg (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '87', quantity: 1, rawLine: 'Pineapple 1/2 Kg (Sec 35)' },
      { dateStr: '2026-05-20', outletId: 'bk', itemId: '87', quantity: 2, rawLine: 'Pineapple 1/2 Kg (Base Kitchen)' },

      // 4. Butterscotch 1/2 Kg (83)
      { dateStr: '2026-05-20', outletId: '42', itemId: '83', quantity: 1, rawLine: 'Butterscotch 1/2 Kg (Sec 42)' },
      { dateStr: '2026-05-20', outletId: '35', itemId: '83', quantity: 1, rawLine: 'Butterscotch 1/2 Kg (Sec 35)' },

      // 5. Vanilla 1/2 Kg (97)
      { dateStr: '2026-05-18', outletId: '31', itemId: '97', quantity: 1, rawLine: 'Vanilla 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-19', outletId: '31', itemId: '97', quantity: 1, rawLine: 'Vanilla 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-20', outletId: '42', itemId: '97', quantity: 1, rawLine: 'Vanilla 1/2 Kg (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '88', itemId: '97', quantity: 1, rawLine: 'Vanilla 1/2 Kg (Sec 88)' },

      // 6. Fresh Fruit 1/2 Kg (89)
      { dateStr: '2026-05-20', outletId: '88', itemId: '89', quantity: 1, rawLine: 'Fresh Fruit (1/2 Kg) (Sec 88)' },

      // 7. Blueberry 1/2 Kg (81)
      { dateStr: '2026-05-19', outletId: '42', itemId: '81', quantity: 1, rawLine: 'Blueberry (1/2 Kg) (Sec 42)' },
      { dateStr: '2026-05-20', outletId: '42', itemId: '81', quantity: 1, rawLine: 'Blueberry (1/2 Kg) (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '88', itemId: '81', quantity: 1, rawLine: 'Blueberry (1/2 Kg) (Sec 88)' },

      // 8. Tiramisu 1/2 Kg (182)
      { dateStr: '2026-05-20', outletId: '31', itemId: '182', quantity: 1, rawLine: 'Tiramisu 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-20', outletId: '42', itemId: '182', quantity: 1, rawLine: 'Tiramisu 1/2 Kg (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '88', itemId: '182', quantity: 1, rawLine: 'Tiramisu 1/2 Kg (Sec 88)' },

      // 9. Black Forest 1/2 Kg (79)
      { dateStr: '2026-05-18', outletId: '31', itemId: '79', quantity: 1, rawLine: 'Black Forest 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-19', outletId: '31', itemId: '79', quantity: 1, rawLine: 'Black Forest 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-20', outletId: '31', itemId: '79', quantity: 2, rawLine: 'Black Forest 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-19', outletId: '35', itemId: '79', quantity: 1, rawLine: 'Black Forest 1/2 Kg (Sec 35)' },
      { dateStr: '2026-05-20', outletId: '35', itemId: '79', quantity: 1, rawLine: 'Black Forest 1/2 Kg (Sec 35)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '79', quantity: 1, rawLine: 'Black Forest 1/2 Kg (Sec 88)' },
      { dateStr: '2026-05-16', outletId: 'bk', itemId: '79', quantity: 1, rawLine: 'Black Forest 1/2 Kg (Base Kitchen)' },

      // 10. Red Velvet 1/2 Kg (95)
      { dateStr: '2026-05-16', outletId: '31', itemId: '95', quantity: 1, rawLine: 'Red Velvet (1/2 Kg) (Sec 31)' },
      { dateStr: '2026-05-18', outletId: '31', itemId: '95', quantity: 1, rawLine: 'Red Velvet (1/2 Kg) (Sec 31)' },
      { dateStr: '2026-05-20', outletId: '31', itemId: '95', quantity: 2, rawLine: 'Red Velvet (1/2 Kg) (Sec 31)' },
      { dateStr: '2026-05-17', outletId: '88', itemId: '95', quantity: 1, rawLine: 'Red Velvet (1/2 Kg) (Sec 88)' },

      // 13. Fresh Mango/Strawberry 1/2 Kg (91)
      { dateStr: '2026-05-19', outletId: 'bk', itemId: '91', quantity: 1, rawLine: 'Fresh Mango/Strawberry 1/2 Kg (Base Kitchen)' },

      // 14. Ferro Rocher 1/2 Kg (170)
      { dateStr: '2026-05-20', outletId: '31', itemId: '170', quantity: 1, rawLine: 'Ferro Rocher 1/2 Kg (Sec 31)' },
      { dateStr: '2026-05-17', outletId: '88', itemId: '170', quantity: 1, rawLine: 'Ferro Rocher 1/2 Kg (Sec 88)' },

      // 15. Classic Pineapple Pastry (217)
      { dateStr: '2026-05-17', outletId: '31', itemId: '217', quantity: 4, rawLine: 'Classic Pineapple Pastry (Sec 31)' },
      { dateStr: '2026-05-18', outletId: '42', itemId: '217', quantity: 2, rawLine: 'Classic Pineapple Pastry (Sec 42)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '217', quantity: 4, rawLine: 'Classic Pineapple Pastry (Sec 88)' },
      { dateStr: '2026-05-17', outletId: 'bk', itemId: '217', quantity: 3, rawLine: 'Classic Pineapple Pastry (Base Kitchen)' },
      { dateStr: '2026-05-19', outletId: 'bk', itemId: '217', quantity: 1, rawLine: 'Classic Pineapple Pastry (Base Kitchen)' },

      // 16. Black Forest Pastry (213)
      { dateStr: '2026-05-17', outletId: '31', itemId: '213', quantity: 4, rawLine: 'Black Forest Pastry (Sec 31)' },
      { dateStr: '2026-05-16', outletId: '42', itemId: '213', quantity: 6, rawLine: 'Black Forest Pastry (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '213', quantity: 2, rawLine: 'Black Forest Pastry (Sec 35)' },
      { dateStr: '2026-05-20', outletId: 'bk', itemId: '213', quantity: 1, rawLine: 'Black Forest Pastry (Base Kitchen)' },

      // 17. Chocolate Truffle Pastry (216)
      { dateStr: '2026-05-20', outletId: '31', itemId: '216', quantity: 1, rawLine: 'Chocolate Truffle Pastry (Sec 31)' },
      { dateStr: '2026-05-17', outletId: '42', itemId: '216', quantity: 2, rawLine: 'Chocolate Truffle Pastry (Sec 42)' },
      { dateStr: '2026-05-18', outletId: '42', itemId: '216', quantity: 5, rawLine: 'Chocolate Truffle Pastry (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '216', quantity: 4, rawLine: 'Chocolate Truffle Pastry (Sec 35)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '216', quantity: 3, rawLine: 'Chocolate Truffle Pastry (Sec 88)' },
      { dateStr: '2026-05-17', outletId: 'bk', itemId: '216', quantity: 1, rawLine: 'Chocolate Truffle Pastry (Base Kitchen)' },
      { dateStr: '2026-05-18', outletId: 'bk', itemId: '216', quantity: 7, rawLine: 'Chocolate Truffle Pastry (Base Kitchen)' },

      // 18. Red Velvet Pastry (225)
      { dateStr: '2026-05-17', outletId: '31', itemId: '225', quantity: 4, rawLine: 'Red Velvet Pastry (Sec 31)' },
      { dateStr: '2026-05-17', outletId: '42', itemId: '225', quantity: 5, rawLine: 'Red Velvet Pastry (Sec 42)' },
      { dateStr: '2026-05-20', outletId: '35', itemId: '225', quantity: 2, rawLine: 'Red Velvet Pastry (Sec 35)' },
      { dateStr: '2026-05-18', outletId: 'bk', itemId: '225', quantity: 6, rawLine: 'Red Velvet Pastry (Base Kitchen)' },

      // 19. Blueberry Pastry (214)
      { dateStr: '2026-05-17', outletId: '31', itemId: '214', quantity: 4, rawLine: 'Blueberry Pastry (Sec 31)' },
      { dateStr: '2026-05-16', outletId: '42', itemId: '214', quantity: 3, rawLine: 'Blueberry Pastry (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '214', quantity: 3, rawLine: 'Blueberry Pastry (Sec 35)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '214', quantity: 2, rawLine: 'Blueberry Pastry (Sec 88)' },
      { dateStr: '2026-05-18', outletId: 'bk', itemId: '214', quantity: 4, rawLine: 'Blueberry Pastry (Base Kitchen)' },

      // 20. Rainbow Pastry (224)
      { dateStr: '2026-05-16', outletId: '31', itemId: '224', quantity: 3, rawLine: 'Rainbow Pastry (Sec 31)' },
      { dateStr: '2026-05-19', outletId: '31', itemId: '224', quantity: 3, rawLine: 'Rainbow Pastry (Sec 31)' },
      { dateStr: '2026-05-16', outletId: '42', itemId: '224', quantity: 3, rawLine: 'Rainbow Pastry (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '224', quantity: 3, rawLine: 'Rainbow Pastry (Sec 35)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '224', quantity: 3, rawLine: 'Rainbow Pastry (Sec 88)' },
      { dateStr: '2026-05-19', outletId: 'bk', itemId: '224', quantity: 4, rawLine: 'Rainbow Pastry (Base Kitchen)' },

      // 21. Blueberry Cheese Pastry (215)
      { dateStr: '2026-05-20', outletId: '31', itemId: '215', quantity: 7, rawLine: 'Blueberry Cheese Pastry (Sec 31)' },
      { dateStr: '2026-05-17', outletId: '42', itemId: '215', quantity: 4, rawLine: 'Blueberry Cheese Pastry (Sec 42)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '215', quantity: 3, rawLine: 'Blueberry Cheese Pastry (Sec 35)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '215', quantity: 3, rawLine: 'Blueberry Cheese Pastry (Sec 88)' },

      // 22. Nutella Cheese Pastry (223)
      { dateStr: '2026-05-17', outletId: '31', itemId: '223', quantity: 6, rawLine: 'Nutella Cheese Pastry (Sec 31)' },
      { dateStr: '2026-05-17', outletId: '42', itemId: '223', quantity: 3, rawLine: 'Nutella Cheese Pastry (Sec 42)' },
      { dateStr: '2026-05-16', outletId: '35', itemId: '223', quantity: 1, rawLine: 'Nutella Cheese Pastry (Sec 35)' },
      { dateStr: '2026-05-17', outletId: '35', itemId: '223', quantity: 2, rawLine: 'Nutella Cheese Pastry (Sec 35)' },
      { dateStr: '2026-05-16', outletId: '88', itemId: '223', quantity: 3, rawLine: 'Nutella Cheese Pastry (Sec 88)' },

      // 25. Date and Walnut Dry Cake (155)
      { dateStr: '2026-05-20', outletId: '31', itemId: '155', quantity: 2, rawLine: 'Date and Walnut Dry Cake (Sec 31)' },
    ];

    const results = PRESET_DATA.map((row, idx) => ({
      id: `row_preset_${idx}_${Date.now()}`,
      dateStr: row.dateStr,
      outletId: row.outletId,
      itemId: row.itemId,
      quantity: row.quantity,
      rawLine: row.rawLine,
    }));

    setParsedRows(results);
    setIsSuccessfullySaved(false);
  };

  const handleUpdateParsedRow = (rowId: string, key: string, value: any) => {
    setParsedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [key]: value };
      }
      return row;
    }));
  };

  const handleAddParsedRow = () => {
    const sampleCake = items.find((it: any) => it.category.toLowerCase().includes('cake') || it.category.toLowerCase().includes('pastry'));
    setParsedRows(prev => [
      ...prev,
      {
        id: `row_manual_${Date.now()}_${Math.random()}`,
        dateStr: currentDate,
        outletId: OUTLETS[0].id,
        itemId: sampleCake ? sampleCake.id : items[0].id,
        quantity: 1,
        rawLine: 'Manually added entry',
      }
    ]);
  };

  const handleRemoveParsedRow = (rowId: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleApplyResetAndUpload = async () => {
    if (parsedRows.length === 0) return;
    
    setIsSavingRows(true);
    try {
      const clustered: { [key: string]: { date: string, outletId: string, rows: any[] } } = {};
      parsedRows.forEach(row => {
        if (!row.itemId) return; 
        const key = `${row.dateStr}_${row.outletId}`;
        if (!clustered[key]) {
          clustered[key] = { date: row.dateStr, outletId: row.outletId, rows: [] };
        }
        clustered[key].rows.push(row);
      });

      for (const key of Object.keys(clustered)) {
        const cluster = clustered[key];
        const docRef = doc(db, DAILY_RECORDS_COL, key);
        
        const updateObj: any = {
          date: cluster.date,
          outletId: cluster.outletId
        };

        cluster.rows.forEach(r => {
          updateObj[`records.${r.itemId}`] = {
            received: Number(r.quantity),
            opening: 0,
            sold: 0,
            closing: Number(r.quantity),
            testing: 0,
            returned: 0,
            transf_out: 0
          };
        });

        await setDoc(docRef, updateObj, { merge: true });
      }

      setRecords((prev: any) => {
        const next = { ...prev };
        parsedRows.forEach(row => {
          if (!row.itemId) return;
          if (!next[row.dateStr]) next[row.dateStr] = {};
          if (!next[row.dateStr][row.outletId]) next[row.dateStr][row.outletId] = {};
          
          next[row.dateStr][row.outletId][row.itemId] = {
            received: Number(row.quantity),
            opening: 0,
            sold: 0,
            closing: Number(row.quantity),
            testing: 0,
            returned: 0,
            transf_out: 0
          };
        });
        return next;
      });

      setIsSuccessfullySaved(true);
      setTimeout(() => {
        setShowResetWizard(false);
        setParsedRows([]);
        setRawTableText('');
      }, 1500);

    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'daily_records/bulk_fifo_reset');
    } finally {
      setIsSavingRows(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items
      .filter(item => 
        (item.status !== 'inactive') && (
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      .sort((a, b) => {
        const priorityIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
        const priorityIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
        
        if (priorityIndexA !== -1 || priorityIndexB !== -1) {
          const valA = priorityIndexA === -1 ? 9999 : priorityIndexA;
          const valB = priorityIndexB === -1 ? 9999 : priorityIndexB;
          if (valA !== valB) return valA - valB;
        }

        let stockA = 0;
        let stockB = 0;
        activeOutlets.forEach(o => {
          stockA += (fifoData[a.id]?.[o.id]?.total || 0);
          stockB += (fifoData[b.id]?.[o.id]?.total || 0);
        });

        const hasStockA = stockA > 0 ? 1 : 0;
        const hasStockB = stockB > 0 ? 1 : 0;
        if (hasStockA !== hasStockB) return hasStockB - hasStockA;

        const getW = (c: string) => {
          const cat = (c || '').toLowerCase();
          if (cat.includes('cake')) return 1;
          if (cat.includes('pastries')) return 2;
          if (cat.includes('cookie')) return 3;
          return 4;
        };
        const weightA = getW(a.category);
        const weightB = getW(b.category);
        if (weightA !== weightB) return weightA - weightB;

        return a.name.localeCompare(b.name);
      });
  }, [items, searchTerm, fifoData, activeOutlets]);

  const exportPDF = () => {
    const doc = new jsPDF('l', 'pt');
    doc.text(`EXPIRY & FIFO REPORT - ALL OUTLETS (${currentDate})`, 40, 40);
    
    const body = filteredItems.map((item: any) => {
      const row = [item.name];
      activeOutlets.forEach(o => {
        const data = fifoData[item.id][o.id];
        row.push(data.total > 0 ? `${data.total} pcs` : '-');
      });
      return row;
    });

    autoTable(doc, {
      startY: 60,
      head: [['Item Description', ...activeOutlets.map(o => o.name.toUpperCase())]],
      body
    });
    doc.save(`fifo-report-${currentDate}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f7f4]/85 backdrop-blur-md">
      <header className="p-4 md:p-8 bg-white border-b-2 border-brand-text shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center">
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-3xl md:text-4xl font-brand-serif italic text-brand-text">Shelf-Life Grid</h2>
              <div className="flex items-center gap-4 mt-2">
                 <input 
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="bg-brand-bg border border-brand-border px-2 py-0.5 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-brand-text"
                  />
                  <select 
                    value={localOutletFilter}
                    onChange={(e) => setLocalOutletFilter(e.target.value)}
                    className="bg-brand-bg border border-brand-border px-2 py-1 text-[10px] font-black uppercase outline-none"
                  >
                    <option value="all">All Outlets</option>
                    {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                <input 
                  type="text" 
                  placeholder="SEARCH CAKES/PASTRIES..." 
                  className="pl-9 pr-4 py-2 bg-brand-bg border border-brand-border text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-brand-text outline-none w-64"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             
             {/* Dynamic FIFO Custom Table Loader & Reset */}
             <button 
               onClick={() => setShowResetWizard(true)}
               className="h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-[.2em] shadow-lg flex items-center gap-2 active:scale-95 transition-all text-transform duration-100"
             >
                <RefreshCw size={14} /> Reset & Update FIFO
             </button>

             <button onClick={exportPDF} className="h-10 px-6 bg-brand-text text-white text-[10px] font-black uppercase tracking-[.2em] shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                <FileDown size={14} /> Full Export
             </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-8 no-scrollbar">
        <div className="bg-white border border-brand-border shadow-[12px_12px_0px_rgba(0,0,0,0.02)] min-w-max">
          <table className="w-full text-left font-brand-mono text-[10px] border-collapse">
            <thead className="bg-[#1a1a1a] text-white font-black sticky top-0 z-20">
              <tr>
                <th className="p-4 border-r border-white/10 w-64 backdrop-blur-md">ITEM & CATEGORY</th>
                {activeOutlets.map(o => (
                  <th key={o.id} className="p-4 text-center border-r border-white/10 uppercase tracking-tighter min-w-[150px]">
                    {o.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee]">
              {filteredItems.map((item: any) => {
                const maxRisk = Math.max(...activeOutlets.map(o => fifoData[item.id][o.id].highestRisk));
                const rowColor = maxRisk === 3 ? 'bg-red-50/50' : maxRisk === 2 ? 'bg-orange-50/30' : 'bg-white';
                
                return (
                  <tr key={item.id} className={`${rowColor} hover:bg-slate-50 transition-colors group`}>
                    <td className={`p-4 border-r border-brand-border font-brand-sans sticky left-0 ${maxRisk === 3 ? 'bg-[#fff5f5]' : 'bg-white'} group-hover:bg-slate-50 z-10 box-border`}>
                      <div className="flex items-start gap-2">
                        {maxRisk === 3 && <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse mt-1"></div>}
                        <div className="flex-1">
                          <div className="font-black text-brand-text uppercase text-xs leading-none">{item.name}</div>
                          <div className="text-[8px] opacity-40 font-bold uppercase tracking-widest mt-1">{item.category}</div>
                        </div>
                      </div>
                    </td>
                    {activeOutlets.map(outlet => {
                      const data = fifoData[item.id][outlet.id];
                      const b = data.buckets;
                      return (
                        <td key={outlet.id} 
                            onClick={() => data.total > 0 && setSelectedDetail({item, outlet, data})}
                            className={`p-2 border-r border-brand-border align-top transition-all cursor-pointer ${data.total > 0 ? 'bg-white hover:shadow-[inset_0_0_0_1px_#000]' : 'bg-transparent opacity-20 cursor-default'}`}>
                          {data.total > 0 ? (
                            <div className="flex flex-col gap-1">
                               <div className="flex justify-between items-baseline mb-0.5">
                                  <span className="text-xl font-brand-mono font-bold leading-none">{data.total}</span>
                                  <span className="text-[7px] font-black opacity-30 uppercase">Closing</span>
                               </div>
                               
                               <div className="flex items-center gap-1.5 flex-wrap">
                                  {b.today > 0 && (
                                    <div className="flex items-center gap-1">
                                       <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                       <span className="text-[10px] font-black text-green-600">{b.today}</span>
                                    </div>
                                  )}
                                  {b.yesterday > 0 && (
                                    <div className="flex items-center gap-1">
                                       <span className="text-[9px] font-bold opacity-20">/</span>
                                       <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                       <span className="text-[10px] font-black text-blue-600">{b.yesterday}</span>
                                    </div>
                                  )}
                                  {b.older > 0 && (
                                    <div className="flex items-center gap-1">
                                       <span className="text-[9px] font-bold opacity-20">/</span>
                                       <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                       <span className="text-[10px] font-black text-orange-600">{b.older}</span>
                                    </div>
                                  )}
                               </div>
                               
                               <div className="mt-1 pt-1 border-t border-dotted border-[#eee] flex justify-between items-center">
                                  <span className="text-[7px] font-black opacity-30 uppercase tracking-tighter">Batches</span>
                                  <span className="text-[7px] font-black bg-brand-text text-white px-1">{data.batches.length}</span>
                                </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-6 grayscale opacity-10">
                               <div className="w-1 h-1 bg-black rounded-full"></div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="py-40 text-center font-brand-serif italic opacity-20 text-3xl">
              No matching items found...
            </div>
          )}
        </div>
      </div>

      <footer className="h-12 bg-white border-t-2 border-brand-text px-8 flex items-center justify-between text-[9px] font-black uppercase tracking-[.2em] shrink-0">
        <div className="flex items-center gap-8">
           <span className="flex items-center gap-2 font-bold"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> TODAY</span>
           <span className="flex items-center gap-2 font-bold"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> YESTERDAY</span>
           <span className="flex items-center gap-2 font-bold"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div> OLDER</span>
           <span className="h-6 w-px bg-brand-border mx-2"></span>
           <span className="animate-pulse flex items-center gap-1 text-red-600"><AlertTriangle size={10} /> CRITICAL STOCK MOVES TO TOP</span>
        </div>
        <div className="flex gap-6 opacity-40 font-black">
           <span>CAKES: 4D</span>
           <span>PASTRIES: 2.5D</span>
        </div>
      </footer>

      {/* FIFO Table Parser and Reset Wizard Modal */}
      <AnimatePresence>
        {showResetWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => !isSavingRows && setShowResetWizard(false)}
               className="absolute inset-0 bg-brand-text/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="relative bg-[#f8f7f4] border-4 border-brand-text w-full max-w-4xl shadow-[24px_24px_0px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col max-h-[90vh]"
             >
                {/* Header */}
                <div className="bg-brand-text text-white p-6 shrink-0 flex justify-between items-center border-b-2 border-white/10">
                   <div>
                      <h3 className="text-2xl font-brand-serif italic leading-none">⚡ FIFO Reset & Batch Table Loader</h3>
                      <p className="text-[9px] font-black uppercase tracking-[.3em] opacity-60 mt-2">
                        Paste date-wise available cake tables from excel or sheets to reset FIFO batches
                      </p>
                   </div>
                   {!isSavingRows && (
                      <button onClick={() => setShowResetWizard(false)} className="p-2 hover:bg-white/10 transition-colors">
                         <X size={20} />
                      </button>
                   )}
                </div>

                {/* Body Split */}
                <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 no-scrollbar">
                  
                  {/* Left Column: paste block */}
                  <div className="md:col-span-5 flex flex-col space-y-4">
                     <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-text block mb-1">
                          Step 1: Paste Excel or Sheet Table Data
                        </span>
                        <p className="text-[9px] text-zinc-500 mb-2 font-medium">
                          The columns should generally represent: <br/>
                          <strong>Date | Outlet Name/Id | Cake Description | Quantity</strong>
                        </p>
                     </div>

                     {/* User Provided Batch Preset Load Component */}
                     <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5 mb-1.5 font-bold">
                           💡 PRE-MAPPED WHATSAPP EXPIRES TABLE
                        </span>
                        <p className="text-[9px] text-indigo-950 font-medium leading-normal mb-2.5">
                           We converted your full date-wise cake list into clean data objects. Click below to load it instantly.
                        </p>
                        <button
                          onClick={handleLoadPresetUserBatchData}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 rounded active:scale-95 transition-all shadow-md"
                        >
                           ⚡ CLICK TO LOAD VERIFIED WHATSAPP BATCHES
                        </button>
                     </div>

                     <textarea
                       rows={10}
                       value={rawTableText}
                       onChange={e => setRawTableText(e.target.value)}
                       placeholder={`Example Format:\n2026-05-18\tSec 31\tChocolate Fudge Cake\t10\n19 May 2026\tSec 42\tRed Velvet Small\t5\n2026-05-19\tSec 88\tTruffle Cake\t8`}
                       className="w-full flex-1 p-3 bg-white border border-brand-border outline-none text-xs font-brand-mono leading-relaxed resize-none focus:ring-1 focus:ring-brand-text"
                     />

                     <button
                       onClick={handleParseTable}
                       disabled={!rawTableText.trim()}
                       className="w-full py-3 bg-black hover:bg-zinc-800 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                     >
                       <RefreshCw size={12} /> Auto-Parse Stock Table
                     </button>

                     <div className="p-3 bg-amber-50 border border-amber-200">
                       <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block mb-1">Important Warning</span>
                       <p className="text-[8px] text-amber-900 leading-normal font-medium">
                         Applying this will re-initialize the stock for the parsed cakes on their specific dates, making them fresh FIFO batches starting on that day. Standard fields (sold, returns) will be cleared to prevent immediate batch decay.
                       </p>
                     </div>
                  </div>

                  {/* Right Column: preview block */}
                  <div className="md:col-span-7 flex flex-col space-y-4 overflow-hidden border-l border-dashed border-brand-border md:pl-6">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-text">
                          Step 2: Preview & Match Verification ({parsedRows.length} Rows)
                        </span>
                        <button
                          onClick={handleAddParsedRow}
                          className="px-2 py-1 text-[8px] border border-brand-border font-black uppercase hover:bg-slate-100 flex items-center gap-1"
                        >
                          <Plus size={10} /> Add Raw Row
                        </button>
                     </div>

                     <div className="flex-1 overflow-auto border border-brand-border bg-white min-h-[300px] no-scrollbar">
                       {parsedRows.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-45">
                           <AlertCircle size={24} className="mb-2 text-zinc-400" />
                           <span className="font-brand-serif italic text-lg text-zinc-600">Scratchpad is empty...</span>
                           <p className="text-[8px] tracking-wider uppercase font-black mt-1">Paste stock records on the left to review</p>
                         </div>
                       ) : (
                         <table className="w-full text-left font-brand-sans text-[10px] border-collapse">
                            <thead className="bg-slate-100 uppercase font-black tracking-tighter text-zinc-500 sticky top-0 z-10 border-b border-brand-border text-[9px]">
                              <tr>
                                <th className="p-2 w-20 border-r border-[#eee]">Date</th>
                                <th className="p-2 w-24 border-r border-[#eee]">Outlet</th>
                                <th className="p-2 border-r border-[#eee]">Cake Description</th>
                                <th className="p-2 w-16 text-center border-r border-[#eee]">Qty</th>
                                <th className="p-2 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 font-brand-sans">
                              {parsedRows.map((row) => {
                                const isUnmatched = !row.itemId;
                                
                                return (
                                  <tr key={row.id} className={`${isUnmatched ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                                    {/* Date */}
                                    <td className="p-2 border-r border-zinc-100">
                                      <input
                                        type="date"
                                        value={row.dateStr}
                                        onChange={e => handleUpdateParsedRow(row.id, 'dateStr', e.target.value)}
                                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-brand-text border border-transparent hover:border-zinc-300 p-0.5 text-[10px]"
                                      />
                                    </td>
                                    
                                    {/* Outlet */}
                                    <td className="p-2 border-r border-zinc-100">
                                      <select
                                        value={row.outletId}
                                        onChange={e => handleUpdateParsedRow(row.id, 'outletId', e.target.value)}
                                        className="w-full bg-transparent outline-none border border-transparent hover:border-zinc-300 p-0.5 text-[10px] uppercase font-bold"
                                      >
                                        {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                      </select>
                                    </td>

                                    {/* Cake Description (Dropdown Select Matcher) */}
                                    <td className="p-2 border-r border-zinc-100 relative">
                                      <select
                                        value={row.itemId}
                                        onChange={e => handleUpdateParsedRow(row.id, 'itemId', e.target.value)}
                                        className={`w-full bg-transparent outline-none border border-transparent hover:border-zinc-300 p-0.5 text-[10px] font-black uppercase ${isUnmatched ? 'text-red-700 bg-red-100/50 hover:bg-red-100 rounded' : 'text-brand-text'}`}
                                      >
                                        <option value="">-- CHOOSE MATCHED CAKE --</option>
                                        {items
                                          .filter((it: any) => it.status !== 'inactive')
                                          .map((it: any) => (
                                            <option key={it.id} value={it.id}>{it.name} ({it.category})</option>
                                          ))}
                                      </select>
                                    </td>

                                    {/* Quantity */}
                                    <td className="p-2 border-r border-zinc-100 text-center">
                                      <input
                                        type="number"
                                        value={row.quantity}
                                        min="1"
                                        onChange={e => handleUpdateParsedRow(row.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                                        className="w-12 text-center bg-transparent outline-none focus:ring-1 focus:ring-brand-text border border-transparent hover:border-zinc-300 p-0.5 text-[10px] font-brand-mono font-bold"
                                      />
                                    </td>

                                    {/* Delete Row button */}
                                    <td className="p-2 text-center">
                                      <button 
                                        onClick={() => handleRemoveParsedRow(row.id)}
                                        className="text-red-600 hover:text-red-700 p-0.5 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                         </table>
                       )}
                     </div>

                     {/* Configuration checkboxes */}
                     <div className="p-2 space-y-2 shrink-0 bg-slate-50 border border-brand-border rounded flex flex-col">
                       <label className="flex items-center gap-2 cursor-pointer text-[9px] font-bold text-zinc-700 uppercase">
                         <input
                           type="checkbox"
                           checked={overwriteDailyMetrics}
                           onChange={e => setOverwriteDailyMetrics(e.target.checked)}
                           className="rounded border-zinc-300 focus:ring-brand-text h-3 w-3 text-brand-text"
                         />
                         Reset daily entry metrics (sold, returns) of target items for pristine batch FIFO start
                       </label>
                     </div>
                  </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-slate-100 border-t border-brand-border shrink-0 flex justify-between items-center">
                   <div className="text-[10px] font-black uppercase opacity-40">
                     System Context: Active Date is {currentDate}
                   </div>

                   <div className="flex gap-4">
                      <button 
                         onClick={() => setShowResetWizard(false)}
                         disabled={isSavingRows}
                         className="px-6 py-3 border border-brand-border text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                      >
                         Cancel
                      </button>
                      
                      <button 
                         onClick={handleApplyResetAndUpload}
                         disabled={parsedRows.length === 0 || isSavingRows || isSuccessfullySaved}
                         className="px-8 py-3 bg-amber-600 enabled:hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
                      >
                         {isSavingRows ? (
                           <>
                             <Loader2 size={14} className="animate-spin" /> Saving...
                           </>
                         ) : isSuccessfullySaved ? (
                           <>
                             <CheckCircle2 size={14} className="text-white" /> Saved Successfully!
                           </>
                         ) : (
                           <>
                             <Check size={14} /> Reset FIFO & Apply Rows
                           </>
                         )}
                      </button>
                   </div>
                </div>

             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Detail Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedDetail(null)}
               className="absolute inset-0 bg-brand-text/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="relative bg-white border-4 border-brand-text w-full max-w-lg shadow-[24px_24px_0px_rgba(0,0,0,0.2)] overflow-hidden"
             >
                <div className="bg-brand-text text-white p-6">
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-3xl font-brand-serif italic leading-none">{selectedDetail.item.name}</h3>
                         <p className="text-[10px] font-black uppercase tracking-[.3em] opacity-60 mt-2">{selectedDetail.outlet.name} • CURRENT STOCK: {selectedDetail.data.total} PCS</p>
                      </div>
                      <button onClick={() => setSelectedDetail(null)} className="p-2 hover:bg-white/10 transition-colors">
                         <X size={24} />
                      </button>
                   </div>
                </div>
                
                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar space-y-4">
                   <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="p-4 bg-green-50 border border-green-100">
                         <div className="text-[8px] font-black opacity-40 uppercase">Today</div>
                         <div className="text-2xl font-brand-mono font-bold text-green-700">{selectedDetail.data.buckets.today}</div>
                      </div>
                      <div className="p-4 bg-blue-50 border border-blue-100">
                         <div className="text-[8px] font-black opacity-40 uppercase">Yesterday</div>
                         <div className="text-2xl font-brand-mono font-bold text-blue-700">{selectedDetail.data.buckets.yesterday}</div>
                      </div>
                      <div className="p-4 bg-orange-50 border border-orange-100">
                         <div className="text-[8px] font-black opacity-40 uppercase">Older</div>
                         <div className="text-2xl font-brand-mono font-bold text-orange-700">{selectedDetail.data.buckets.older}</div>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[.2em] border-b border-[#eee] pb-2 font-black leading-none uppercase">Individual Batch Breakdown (FIFO Order)</p>
                      {selectedDetail.data.batches.map((batch: any, idx: number) => {
                         const status = getExpiryStatus(selectedDetail.item.category, batch.date);
                         return (
                            <div key={idx} className={`p-4 border-2 flex items-center justify-between transition-all ${idx === 0 ? 'border-brand-text bg-slate-50' : 'border-brand-border'}`}>
                               <div className="flex items-center gap-4">
                                  <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                                  <div>
                                     <div className="text-xs font-black uppercase tracking-tight">PRODUCED: {format(new Date(batch.date), 'dd MMMM yyyy')}</div>
                                     <div className="text-[9px] font-bold opacity-40 uppercase">EXPIRES: {getExpiryDate(selectedDetail.item.category, batch.date)}</div>
                                  </div>
                                </div>
                               <div className="text-right">
                                  <div className="text-xl font-brand-mono font-bold">{batch.quantity} <span className="text-[10px] opacity-30">PCS</span></div>
                                  {idx === 0 && <span className="text-[8px] font-black bg-brand-text text-white px-2 py-0.5">NEXT TO SELL</span>}
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-brand-border flex justify-between items-center">
                   <div className="text-[9px] font-black uppercase opacity-40">System Timestamp: {format(new Date(), 'HH:mm:ss')}</div>
                   <button 
                     onClick={() => setSelectedDetail(null)}
                     className="px-8 py-3 bg-brand-text text-white text-xs font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all"
                   >
                     CLOSE ANALYSIS
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

// --- TRANSFER NOTIFIER COMPONENT ---
const TransferNotifier = React.memo(({ transfers, userOutletId, onAccept, onReject }: any) => {
  const pending = transfers.filter((t: any) => t.toOutletId === userOutletId && t.status === 'pending');

  if (pending.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-full max-w-sm space-y-3">
      <AnimatePresence>
        {pending.map((t: any) => (
          <motion.div
            key={t.id}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="bg-white border-4 border-brand-text shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-brand-text text-white p-2">
                <Truck size={20} />
              </div>
              <div>
                <h4 className="font-black uppercase text-xs text-brand-text mb-1">Stock Arrival</h4>
                <p className="text-[10px] font-bold opacity-60">ADMIN SENT {t.quantity} PCS OF</p>
                <div className="text-sm font-black uppercase text-brand-text">{t.itemName}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(t)}
                className="flex-1 py-3 bg-brand-text text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
              >
                ACCEPT & FILL
              </button>
              <button
                onClick={() => onReject(t)}
                className="px-4 py-3 bg-white border-2 border-brand-text text-brand-text text-[10px] font-black uppercase hover:bg-slate-50 transition-all"
              >
                SKIP
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

// --- REQUIREMENTS COMPONENT ---
const RequirementsComponent = React.memo(({ items, requirements, selectedOutletId, setIsSidebarOpen, userRole, records, currentDate }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'matrix'>(userRole === 'admin' ? 'matrix' : 'grid');
  
  const filteredItems = items.filter((i: any) => 
    i.status !== 'inactive' && 
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.category.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a: any, b: any) => {
    // 0. Absolute Priority Item Rank
    const priorityIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
    const priorityIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
    
    if (priorityIndexA !== -1 || priorityIndexB !== -1) {
      const valA = priorityIndexA === -1 ? 9999 : priorityIndexA;
      const valB = priorityIndexB === -1 ? 9999 : priorityIndexB;
      if (valA !== valB) return valA - valB;
    }

    const p = (c: string) => {
      const cat = c.toLowerCase();
      if (cat.includes('cake')) return 1;
      if (cat.includes('pastry')) return 2;
      return 3;
    };
    return p(a.category) - p(b.category) || a.name.localeCompare(b.name);
  });

  const updateReq = async (outletId: string, itemId: string, val: string) => {
    const qty = parseInt(val) || 0;
    const reqId = `${outletId}_${itemId}`;
    try {
      if (qty <= 0) {
        await deleteDoc(doc(db, REQUIREMENTS_COL, reqId));
      } else {
        await setDoc(doc(db, REQUIREMENTS_COL, reqId), {
          outletId,
          itemId,
          quantity: qty,
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Error updating requirement:", e);
    }
  };

  const getReq = (oId: string, iId: string) => requirements.find((r: any) => r.outletId === oId && r.itemId === iId);

  const exportRequirementsPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text('OUTLET STOCK REQUIREMENTS', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 22);

    const activeOutlets = userRole === 'admin' ? OUTLETS : OUTLETS.filter(o => o.id === selectedOutletId);
    const headers = [['Item Name', ...activeOutlets.map(o => o.name.toUpperCase()), 'TOTAL']];
    
    const body = filteredItems.map((item: any) => {
      const row = [item.name];
      let rowTotal = 0;
      activeOutlets.forEach(o => {
        const qty = getReq(o.id, item.id)?.quantity || 0;
        row.push(qty || '-');
        rowTotal += Number(qty || 0);
      });
      row.push(rowTotal || '-');
      return row;
    }).filter(row => row.some((val, idx) => idx > 0 && val !== '-'));

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [26,26,26], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 }
      }
    });

    doc.save(`requirements-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }, [filteredItems, requirements, userRole, selectedOutletId]);

  return (
    <div className="flex flex-col h-full bg-brand-bg md:bg-white overflow-hidden">
      <header className="px-6 py-8 md:px-12 md:py-12 bg-white border-b border-brand-border shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-brand-text">
                <Menu size={24} />
              </button>
              <h2 className="text-3xl md:text-5xl font-brand-serif italic text-brand-text tracking-tight">Stock Requirements</h2>
            </div>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-[.3em] opacity-40">Outlet Needs & Special Orders Console</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <button 
               onClick={exportRequirementsPDF}
               className="h-11 px-6 bg-white border-2 border-brand-text text-[10px] font-black uppercase tracking-widest hover:bg-brand-text hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
             >
               <Download size={14} />
               Export PDF
            </button>
            {userRole === 'admin' && (
              <div className="flex bg-slate-100 p-1 border border-brand-border">
                <button 
                  onClick={() => setViewMode('matrix')}
                  className={`px-4 py-2 text-[10px] font-black uppercase transition-all ${viewMode === 'matrix' ? 'bg-brand-text text-white shadow-lg' : 'text-brand-text opacity-40'}`}
                >
                  Matrix
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 text-[10px] font-black uppercase transition-all ${viewMode === 'grid' ? 'bg-brand-text text-white shadow-lg' : 'text-brand-text opacity-40'}`}
                >
                  Grid
                </button>
              </div>
            )}
            <div className="relative w-full md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
              <input 
                type="text" 
                placeholder="SEARCH ITEMS..." 
                className="w-full pl-10 pr-4 py-3 bg-white border border-brand-border text-[9px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-brand-text shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-[#F5F5F7]">
        <div className="max-w-7xl mx-auto">
          {viewMode === 'matrix' ? (
            <div className="bg-white border-4 border-brand-text shadow-[12px_12px_0_0_rgba(0,0,0,1)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-brand-text text-white border-b-4 border-brand-text">
                      <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest sticky left-0 bg-brand-text z-10 w-64 border-r border-white/20">ITEM NAME</th>
                      {OUTLETS.map(o => (
                        <th key={o.id} className="p-4 text-center text-[10px] font-black uppercase tracking-widest border-r border-white/20 min-w-[120px]">
                          {(o as any).shortName || o.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => {
                      const hasAnyReq = requirements.some((r: any) => r.itemId === item.id);
                      if (!hasAnyReq && searchTerm === '') return null;
                      
                      return (
                        <tr key={item.id} className="border-b border-brand-border hover:bg-slate-50 transition-colors">
                          <td className="p-4 sticky left-0 bg-white z-10 border-r border-brand-border">
                            <div className="text-[8px] font-black uppercase opacity-40 mb-0.5">{item.category}</div>
                            <div className="text-xs font-black uppercase text-brand-text">{item.name}</div>
                          </td>
                          {OUTLETS.map(o => {
                            const req = getReq(o.id, item.id);
                            const recToday = records[currentDate]?.[o.id]?.[item.id] || {};
                            const received = Number(recToday.received || 0);
                            const net = Math.max(0, (req?.quantity || 0) - received);

                            return (
                              <td key={o.id} className={`p-0 border-r border-brand-border ${req ? 'bg-amber-50' : ''}`}>
                                <div className="relative group/req">
                                  <input 
                                    type="number"
                                    className="w-full h-14 bg-transparent text-center font-brand-mono text-lg font-bold outline-none focus:bg-white focus:ring-inset focus:ring-2 focus:ring-brand-text transition-all"
                                    placeholder="-"
                                    defaultValue={req?.quantity || ""}
                                    onBlur={(e) => updateReq(o.id, item.id, e.target.value)}
                                  />
                                  {req && received > 0 && (
                                    <div className="absolute top-1 right-1 text-[8px] font-black bg-green-100 text-green-800 px-1 border border-green-200">
                                      NET: {net}
                                    </div>
                                  )}
                                </div>
                                {req?.updatedAt && (
                                  <div className="text-[6px] font-bold text-center opacity-30 pb-1 -mt-1">
                                    {format(req.updatedAt.toDate ? req.updatedAt.toDate() : new Date(req.updatedAt), 'HH:mm')}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item: any) => {
                const req = getReq(selectedOutletId, item.id);
                const recToday = records[currentDate]?.[selectedOutletId]?.[item.id] || {};
                const received = Number(recToday.received || 0);
                const net = Math.max(0, (req?.quantity || 0) - received);

                return (
                  <div key={item.id} className={`bg-white border-2 p-6 group transition-all relative ${req ? 'border-brand-text shadow-[6px_6px_0_0_rgba(0,0,0,1)]' : 'border-brand-border hover:border-brand-text'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-[9px] font-black uppercase opacity-40 mb-1 tracking-widest">{item.category}</div>
                        <div className="text-sm md:text-base font-black uppercase text-brand-text leading-tight">{item.name}</div>
                      </div>
                      {req && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="bg-amber-400 text-white p-1.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                            <Bell size={12} className={net > 0 ? "animate-pulse" : ""} />
                          </div>
                          {received > 0 && (
                            <div className={`text-[8px] font-black px-2 py-0.5 border ${net === 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                              {net === 0 ? 'FULFILLED' : `PENDING: ${net}`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="text-[7px] font-black uppercase opacity-40 mb-1 block">QUANTITY NEEDED</label>
                        <input 
                          type="number"
                          className="w-full p-4 bg-slate-50 border border-brand-border font-brand-mono text-2xl font-bold outline-none focus:ring-2 focus:ring-brand-text focus:bg-white transition-all shadow-inner"
                          placeholder="0"
                          defaultValue={req?.quantity || ""}
                          onBlur={(e) => updateReq(selectedOutletId, item.id, e.target.value)}
                        />
                      </div>
                      <div className="text-[8px] font-black uppercase text-brand-text opacity-40 vertical-rl h-12 rotate-180 tracking-[0.2em]">PCS REQUIRED</div>
                    </div>

                    {req?.updatedAt && (
                      <div className="mt-4 pt-3 border-t border-brand-border flex justify-between items-center">
                        <div className="text-[8px] font-black opacity-30 flex items-center gap-1">
                          <Clock size={8} /> LAST UPDATED: {format(req.updatedAt.toDate ? req.updatedAt.toDate() : new Date(req.updatedAt), 'HH:mm')}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// --- GLOBAL CLOSING STOCK COMPONENT ---
const GlobalClosingComponent = React.memo(({ items, records, currentDate, setCurrentDate, setIsSidebarOpen, getPreviousClosingInternal, calculateSold, calculateClosing }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'inventory' | 'returns'>('inventory');
  const [selectedReturnItem, setSelectedReturnItem] = useState<any>(null);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');

  const handleWastageAction = async (item: any) => {
    // Collect all returns into global wastage for this item
    const totalToWastage = item.totalReturns;
    if (totalToWastage === 0) return;

    try {
      // 1. Update each outlet's record to acknowledge return was processed (optional but good for tracking)
      // Here we just alert success in this version as the user asked for a "section to track wastage"
      
      const wastageId = `${currentDate}_${item.id}_global`;
      await setDoc(doc(db, GLOBAL_WASTAGE_COL, wastageId), {
        date: currentDate,
        itemId: item.id,
        quantity: totalToWastage,
        processedAt: serverTimestamp(),
        type: 'RETURN_TO_WASTAGE'
      });

      alert(`Success: ${totalToWastage} units of ${item.name} moved to Global Wastage Ledger.`);
      setSelectedReturnItem(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, GLOBAL_WASTAGE_COL);
    }
  };

  const handleTransferAction = async (item: any, targetOutletId: string) => {
    if (!targetOutletId) return;
    const totalToTransfer = Number(item.totalReturns || 0);
    if (totalToTransfer === 0) return;
    
    try {
      // Add the returned quantity to the target outlet's received stock in DAILY_RECORDS
      const recordId = `${currentDate}_${targetOutletId}`;
      const docRef = doc(db, DAILY_RECORDS_COL, recordId);
      
      const existingData = records[currentDate]?.[targetOutletId]?.[item.id] || {
        opening: getPreviousClosingInternal(records, item.id, currentDate, targetOutletId),
        received: 0,
        sold: 0,
        testing: 0,
        returned: 0,
        wastage: 0,
        transf_out: 0,
        transf_out_to: '',
        closing: 0,
        calculationMode: 'sold'
      };

      const newData = {
        ...existingData,
        received: Number(existingData.received || 0) + totalToTransfer
      };

      // Recalculate derived
      if (newData.calculationMode === 'closing') {
        newData.sold = calculateSold(newData);
      } else {
        newData.closing = calculateClosing(newData);
      }

      await updateDoc(docRef, {
        [`records.${item.id}`]: newData,
        outletId: targetOutletId,
        date: currentDate
      });

      alert(`Success: ${totalToTransfer} units of ${item.name} transferred and updated in ${OUTLETS.find(o => o.id === targetOutletId)?.name} console.`);
      setSelectedReturnItem(null);
    } catch (e: any) {
      if (e.code === 'not-found') {
        // Create if missing
        const recordId = `${currentDate}_${targetOutletId}`;
        const docRef = doc(db, DAILY_RECORDS_COL, recordId);
        const opening = getPreviousClosingInternal(records, item.id, currentDate, targetOutletId);
        const newData = {
          opening,
          received: totalToTransfer,
          sold: 0, testing: 0, returned: 0, wastage: 0, transf_out: 0, transf_out_to: '',
          closing: opening + totalToTransfer,
          calculationMode: 'sold'
        };
        await setDoc(docRef, {
          date: currentDate,
          outletId: targetOutletId,
          records: { [item.id]: newData }
        });
        alert(`Success: New day record created for target outlet.`);
      } else {
        handleFirestoreError(e, OperationType.WRITE, DAILY_RECORDS_COL);
      }
    }
  };

  const tableData = useMemo(() => {
    const results = items
      .filter((i: any) => i.status !== 'inactive')
      .map((item: any) => {
      const outletStocks: { [id: string]: number } = {};
      const returns: { [id: string]: number } = {};
      const wastes: { [id: string]: number } = {};
      const receivedAtOutlet: { [id: string]: number } = {};
      let total = 0;
      let totalReturns = 0;
      let totalWastage = 0;
      let totalReceived = 0;
      
      OUTLETS.forEach(o => {
        const outletData = records[currentDate]?.[o.id]?.[item.id] || {};
        const qty = Number(outletData.closing || 0);
        const ret = Number(outletData.returned || 0); 
        const waste = Number(outletData.wastage || 0);
        const rec = Number(outletData.received || 0);

        outletStocks[o.id] = qty;
        returns[o.id] = ret;
        wastes[o.id] = waste;
        receivedAtOutlet[o.id] = rec;
        
        if (selectedOutletFilter === 'all' || selectedOutletFilter === o.id) {
          total += qty;
          totalReturns += ret;
          totalWastage += waste;
          totalReceived += rec;
        }
      });

      return {
        ...item,
        outletStocks,
        returns,
        wastes,
        receivedAtOutlet,
        total,
        totalReturns,
        totalWastage,
        totalReceived
      };
    }).filter((item: any) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    return results.sort((a: any, b: any) => {
      // 0. Absolute Priority Item Rank
      const priorityIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
      const priorityIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
      
      if (priorityIndexA !== -1 || priorityIndexB !== -1) {
        const valA = priorityIndexA === -1 ? 9999 : priorityIndexA;
        const valB = priorityIndexB === -1 ? 9999 : priorityIndexB;
        if (valA !== valB) return valA - valB;
      }

      const hasStockA = a.total > 0 ? 1 : 0;
      const hasStockB = b.total > 0 ? 1 : 0;

      // 1. Primary: Any stock at all (Global priority)
      if (hasStockA !== hasStockB) return hasStockB - hasStockA;

      // 2. Secondary: Category Rank
      const getW = (c: string) => {
        const cat = (c || '').toUpperCase();
        if (cat.includes('CAKE')) return 0;
        if (cat.includes('PASTRIES')) return 1;
        if (cat.includes('COOKIE')) return 2;
        return 99;
      };
      const wA = getW(a.category);
      const wB = getW(b.category);
      if (wA !== wB) return wA - wB;

      return a.name.localeCompare(b.name);
    });
  }, [items, records, currentDate, searchTerm, selectedOutletFilter]);

  const downloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    const title = activeView === 'inventory' ? 'Inventory Closing Report' : 'Returns & Logistics Audit';
    const outletName = selectedOutletFilter === 'all' ? 'All Outlets' : OUTLETS.find(o => o.id === selectedOutletFilter)?.name;
    
    doc.text(`${title} - ${currentDate} (${outletName})`, 14, 20);
    
    let tableHeaders;
    let tableBody;

    if (activeView === 'inventory') {
      tableHeaders = [['Category', 'Item Name', ...OUTLETS.map(o => o.name), 'Total']];
      tableBody = tableData.map((row: any) => [
        row.category,
        row.name,
        ...OUTLETS.map(o => row.outletStocks[o.id] || 0),
        row.total
      ]);
    } else {
      tableHeaders = [['Item Name', 'Total Received', 'Total Returned', 'Wastage']];
      tableBody = tableData
        .filter((i: any) => i.totalReceived > 0 || i.totalReturns > 0 || i.totalWastage > 0)
        .map((row: any) => [
          row.name,
          row.totalReceived,
          row.totalReturns,
          row.totalWastage
        ]);
    }

    autoTable(doc, {
      head: tableHeaders,
      body: tableBody,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 30 }
    });

    doc.save(`${title.replace(/ /g, '_')}_${currentDate}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f7f4]/85 backdrop-blur-md">
      <header className="p-4 md:p-8 bg-white border-b-2 border-brand-text shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center shrink-0">
                <Menu size={20} />
              </button>
              <div>
                <h2 className="text-2xl md:text-3xl font-brand-serif italic uppercase">Global Stock Monitor</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-[9px] font-black uppercase tracking-[.3em] opacity-40">Report for:</div>
                  <input 
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="bg-brand-bg border border-brand-border px-2 py-0.5 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-brand-text"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text opacity-30" />
                <input 
                  type="text"
                  placeholder="Filter by name..."
                  className="w-full h-11 pl-10 pr-4 bg-brand-bg border border-brand-border text-xs font-bold outline-none focus:ring-1 focus:ring-brand-text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={downloadPDF}
                className="h-11 px-6 bg-brand-text text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-opacity-90 active:scale-95 transition-all"
              >
                <FileDown size={14} /> PDF
              </button>
            </div>
          </div>

          {/* Quick Outlet Filter in Header */}
          <div className="flex flex-col gap-2 pt-4 border-t border-brand-border">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Filter by Specific Outlet:</div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setSelectedOutletFilter('all')}
                className={`px-4 py-2 text-[9px] font-black uppercase border-2 transition-all ${selectedOutletFilter === 'all' ? 'border-brand-text bg-brand-text text-white shadow-md' : 'border-brand-border bg-white text-brand-text hover:bg-slate-50'}`}
              >
                Show All Outlets
              </button>
              {OUTLETS.map(o => (
                <button 
                  key={o.id}
                  onClick={() => setSelectedOutletFilter(o.id)}
                  className={`px-4 py-2 text-[9px] font-black uppercase border-2 transition-all ${selectedOutletFilter === o.id ? 'border-brand-text bg-brand-text text-white shadow-md' : 'border-brand-border bg-white text-brand-text hover:bg-slate-50'}`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        {/* Modal for Returns Management */}
        <AnimatePresence>
          {selectedReturnItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedReturnItem(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white w-full max-w-2xl border-4 border-brand-text shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 bg-brand-text text-white flex justify-between items-center">
                   <div>
                      <h3 className="text-xl font-brand-serif italic">Manage Returns: {selectedReturnItem.name}</h3>
                      <p className="text-[10px] font-black uppercase opacity-60">Total Pending: {selectedReturnItem.totalReturns} Units</p>
                   </div>
                   <button onClick={() => setSelectedReturnItem(null)} className="p-2 hover:bg-white/10 transition-colors"><X size={24} /></button>
                </div>
                
                <div className="p-8 space-y-6">
                   <div className="bg-slate-50 p-6 border border-brand-border">
                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Returned From Outlets</h4>
                      <div className="space-y-3">
                         {OUTLETS.map(o => {
                            const qty = selectedReturnItem.returns[o.id] || 0;
                            if (qty === 0) return null;
                            return (
                               <div key={o.id} className="flex justify-between items-center bg-white p-3 border border-brand-border">
                                  <span className="text-[10px] font-black uppercase">{o.name}</span>
                                  <span className="text-lg font-brand-mono font-bold text-red-600">{qty} Units</span>
                               </div>
                            );
                         })}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleWastageAction(selectedReturnItem)}
                        className="p-6 border-2 border-brand-text group hover:bg-red-600 hover:text-white transition-all flex flex-col items-center gap-3"
                      >
                         <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
                         <span className="text-xs font-black uppercase text-center">Move All to<br/>Global Wastage</span>
                      </button>
                      
                      <div className="p-6 border-2 border-brand-text flex flex-col items-center gap-3">
                         <Repeat size={24} />
                         <select 
                           id="transfer-target-select"
                           className="w-full text-[10px] font-black uppercase bg-brand-bg border border-brand-border p-2 outline-none"
                         >
                            <option value="">Transfer to...</option>
                            {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                         </select>
                         <button 
                           onClick={() => {
                             const sel = document.getElementById('transfer-target-select') as HTMLSelectElement;
                             handleTransferAction(selectedReturnItem, sel.value);
                           }}
                           className="w-full py-2 bg-brand-text text-white text-[9px] font-black uppercase shadow-inner active:scale-95 transition-all"
                         >
                           Confirm Transfer
                         </button>
                      </div>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex bg-brand-bg p-1 border border-brand-border h-12 mb-4">
          <button 
            onClick={() => setActiveView('inventory')}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'inventory' ? 'bg-brand-text text-white' : 'text-brand-text'}`}
          >
            Inventory Monitor
          </button>
          <button 
            onClick={() => setActiveView('returns')}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'returns' ? 'bg-brand-text text-white' : 'text-brand-text'}`}
          >
            Returns & Logistics
          </button>
        </div>

        {activeView === 'inventory' ? (
          <div className="max-w-7xl mx-auto bg-white border border-brand-border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-brand-mono border-collapse">
                <thead>
                  <tr className="bg-[#f0f2f5] text-brand-text text-[9px] uppercase font-black tracking-widest">
                    <th className="p-4 border-b border-brand-border sticky left-0 z-20 bg-[#f0f2f5]">Product Info</th>
                    {OUTLETS.map(o => (
                      <th key={o.id} className="p-4 border-b border-brand-border text-center border-l whitespace-nowrap">{o.name}</th>
                    ))}
                    <th className="p-4 border-b border-brand-border text-center bg-brand-text text-white border-l">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee]">
                  {tableData.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50 text-[10px] font-bold">
                      <td className="p-4 sticky left-0 z-10 bg-white border-r">
                        <div className="uppercase text-base">{row.name}</div>
                        <div className="text-[8px] opacity-30 uppercase">{row.category}</div>
                      </td>
                      {OUTLETS.map(o => (
                        <td key={o.id} className="p-4 text-center border-l font-brand-mono">
                          <span className={row.outletStocks[o.id] === 0 ? 'opacity-20' : 'text-brand-text text-xl'}>
                            {row.outletStocks[o.id] || 0}
                          </span>
                        </td>
                      ))}
                      <td className="p-4 text-center border-l bg-slate-50 font-black text-brand-text text-2xl">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6 pb-12">
            <div className="grid grid-cols-1 gap-6 text-brand-text">

            <div className="bg-white border border-brand-border shadow-sm overflow-hidden">
               <div className="p-6 border-b border-brand-border bg-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest">
                    {selectedOutletFilter === 'all' ? 'Global Movement Audit' : `${OUTLETS.find(o => o.id === selectedOutletFilter)?.name} Audit`}
                  </h3>
                  <div className="text-[8px] font-bold opacity-40 uppercase">Tracking Dispatched, Received & Returned</div>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left font-brand-mono">
                     <thead className="bg-[#f0f2f5] text-brand-text text-[9px] uppercase font-black tracking-widest border-b border-brand-border">
                        <tr>
                           <th className="p-4">Item Name</th>
                           <th className="p-4 text-center">Received</th>
                           <th className="p-4 text-center">Returned</th>
                           <th className="p-4 text-center">Wastage</th>
                           <th className="p-4 text-center">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#eee] text-[10px] font-bold">
                        {tableData.filter((i: any) => i.totalReceived > 0 || i.totalReturns > 0 || i.totalWastage > 0).map((row: any) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                               <td className="p-4 uppercase text-sm border-r">{row.name}</td>
                               <td className="p-4 text-center font-brand-mono text-xl text-green-600 border-r">{row.totalReceived}</td>
                               <td className="p-4 text-center font-brand-mono text-xl text-red-600 border-r">{row.totalReturns}</td>
                               <td className="p-4 text-center font-brand-mono text-xl text-amber-600 border-r">{row.totalWastage}</td>
                               <td className="p-4 text-center">
                                  <button 
                                    onClick={() => setSelectedReturnItem(row)}
                                    className="px-4 py-2 bg-brand-bg border border-brand-border text-[9px] font-black uppercase hover:bg-brand-text hover:text-white transition-all shadow-sm"
                                  >
                                    Manage Returns
                                  </button>
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
    </div>
  );
});

// --- MEMOIZED PRODUCTION ROW ---
const ProductionRow = React.memo(({ p, idx, updateOutletDistribution, updateProducedDirectly, updateColdRoom, modes, activeMobileOutlet, requirements }: any) => {
  const [localProduced, setLocalProduced] = useState(p.todayProduced);
  const [inputValues, setInputValues] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    setLocalProduced(p.todayProduced);
  }, [p.todayProduced]);

  const handleBlur = (outletId: string, val: string) => {
     const num = parseInt(val) || 0;
     updateOutletDistribution(p.id, outletId, num);
     // Always clear input after transfer session
     setInputValues(prev => ({ ...prev, [outletId]: '' }));
  };

  const handleProducedBlur = () => {
    const num = Number(localProduced) || 0;
    if (num !== p.todayProduced) {
      updateProducedDirectly(p.id, num);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, colId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = document.querySelector(`input[data-prod-row="${idx + 1}"][data-prod-col="${colId}"]`) as HTMLInputElement;
      if (nextRow) {
        nextRow.focus();
        nextRow.select();
      }
    }
  };

  return (
    <motion.tr 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${p.todayProduced > 0 || p.overnightColdRoom > 0 ? 'bg-white' : 'opacity-40 bg-zinc-50'} hover:bg-slate-50 transition-colors group`}
    >
      <td className="p-4 border-r border-brand-border font-brand-sans sticky left-0 z-10 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
         <div className="font-black uppercase text-[10px] md:text-sm leading-none">{p.name}</div>
         <div className="text-[8px] opacity-40 tracking-wider font-bold mt-1 uppercase">{p.category}</div>
      </td>

      <td className={`p-4 text-center border-r border-brand-border bg-blue-50/30 ${activeMobileOutlet === null || activeMobileOutlet === 'ALL_TABS' ? 'table-cell' : 'hidden md:table-cell'}`}>
         <div className="flex flex-col items-center">
            <span className="md:hidden text-[7px] font-black uppercase mb-1 opacity-40">Made Today</span>
            <input 
               type="number" 
               data-prod-row={idx}
               data-prod-col="produced"
               className="w-16 md:w-24 text-center p-1 md:p-2 border border-brand-border/20 font-brand-serif italic text-blue-900 bg-transparent text-xl md:text-2xl outline-none focus:bg-white transition-all focus:ring-2 focus:ring-blue-400"
               value={localProduced || ""}
               onChange={(e) => setLocalProduced(e.target.value)}
               onBlur={handleProducedBlur}
               onKeyDown={(e) => onKeyDown(e, 'produced')}
            />
         </div>
      </td>
      
      {OUTLETS.map(outlet => (
        <td key={outlet.id} className={`p-0 border-r border-brand-border bg-[#F9F9F9] ${activeMobileOutlet === outlet.id ? 'table-cell' : 'hidden md:table-cell'}`}>
           <div className="flex h-12 w-full">
              {/* Input side */}
              <div className="flex-1 border-r border-brand-border/10 bg-white group-hover:bg-blue-50/20 relative">
                {requirements?.find((r: any) => r.outletId === outlet.id && r.itemId === p.id) && (
                  <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full z-20 shadow-sm animate-pulse">
                    REQ: {requirements.find((r: any) => r.outletId === outlet.id && r.itemId === p.id).quantity}
                  </div>
                )}
                <input 
                  type="number" 
                  data-prod-row={idx}
                  data-prod-col={outlet.id}
                  className="w-full h-full text-center bg-transparent font-black text-brand-text outline-none focus:bg-blue-100 transition-all border-0 text-sm focus:ring-2 focus:ring-brand-text"
                  placeholder={modes[outlet.id] === 'add' ? "+0" : "0"}
                  value={inputValues[outlet.id] ?? ""}
                  onChange={(e) => setInputValues(prev => ({ ...prev, [outlet.id]: e.target.value }))}
                  onBlur={(e) => handleBlur(outlet.id, e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, outlet.id)}
                />
              </div>
              {/* Final side */}
              <div className="flex-1 flex items-center justify-center bg-slate-50">
                 <span className={`text-sm font-black ${p.distribution[outlet.id] > 0 ? 'text-brand-text' : 'text-slate-300'}`}>
                    {p.distribution[outlet.id] || 0}
                 </span>
              </div>
           </div>
        </td>
      ))}

      <td className={`p-4 text-center bg-brand-text text-white ${activeMobileOutlet === null || activeMobileOutlet === 'ALL_TABS' ? 'table-cell' : 'hidden md:table-cell'}`}>
         <div className="flex flex-col items-center">
            <span className={`text-xl font-brand-mono font-bold ${p.liveColdRoom < 5 ? 'text-red-400' : 'text-white'}`}>{p.liveColdRoom}</span>
            <div className="flex flex-col items-center leading-tight">
               <span className="text-[7px] font-black opacity-40 uppercase tracking-widest text-white">Coldroom Stock</span>
               {p.liveColdRoom < 5 && <span className="text-[6px] font-black bg-red-600 px-1 mt-0.5 animate-pulse">REPLENISH</span>}
            </div>
         </div>
      </td>
    </motion.tr>
  );
}, (prev, next) => {
  return prev.p.id === next.p.id && 
         prev.activeMobileOutlet === next.activeMobileOutlet &&
         prev.p.liveColdRoom === next.p.liveColdRoom && 
         prev.p.todayProduced === next.p.todayProduced && 
         prev.p.overnightColdRoom === next.p.overnightColdRoom;
});

const ProductionComponent = React.memo(({ items, records, setRecords, currentDate, setCurrentDate, setIsSidebarOpen, getPreviousClosing, calculateSold, calculateClosing, requirements, updateOutletDistribution }: any) => {
  const [coldRoomState, setColdRoomState] = useState<{ [date: string]: { [itemId: string]: number } }>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [distributionModes, setDistributionModes] = useState<{ [id: string]: 'add' | 'replace' }>(
    OUTLETS.reduce((acc, o) => ({ ...acc, [o.id]: 'replace' }), {})
  );
  const [activeMobileOutlet, setActiveMobileOutlet] = useState(OUTLETS[0].id);
  const [activeTab, setActiveTab] = useState<'production' | 'distribution'>('production');

  const toggleMode = (oid: string) => {
    setDistributionModes(prev => ({ ...prev, [oid]: prev[oid] === 'add' ? 'replace' : 'add' }));
  };

  const setGlobalMode = (mode: 'add' | 'replace') => {
    setDistributionModes(OUTLETS.reduce((acc, o) => ({ ...acc, [o.id]: mode }), {}));
  };

  useEffect(() => {
    const fortyFiveDaysAgo = format(subDays(new Date(), 45), 'yyyy-MM-dd');
    const q = query(
      collection(db, COLD_ROOM_COL),
      where('date', '>=', fortyFiveDaysAgo)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: any = {};
      // Optimization: Only process changes to avoid full redraw if persistence is busy
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!data[d.date]) data[d.date] = {};
        data[d.date][d.itemId] = d.quantity;
      });
      setColdRoomState(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, COLD_ROOM_COL));
    return unsub;
  }, []);

  const getPreviousColdRoomClosing = (itemId: string, date: string) => {
    // Find previous day's live stock
    const allDates = Object.keys(records).sort((a, b) => b.localeCompare(a));
    const targetDate = allDates.find(d => d < date);
    if (!targetDate) return 0;

    // To calculate yesterday's closing:
    // Opening(Y) + Produced(Y) - Distributed(Y)
    const dayRecs = records[targetDate] || {};
    
    // 1. Opening(Y)
    const openingY = Number(coldRoomState[targetDate]?.[itemId] ?? 0);
    
    // 2. Produced(Y)
    let producedY = 0;
    if (dayRecs.batches) {
      Object.values(dayRecs.batches).forEach((batch: any) => {
        if (!batch || !batch.items) return;
        batch.items.forEach((bi: any) => {
          if (bi.itemId === itemId) producedY += Number(bi.qty || 0);
        });
      });
    }

    // 3. Distributed(Y)
    let distributedY = 0;
    OUTLETS.forEach(o => {
      distributedY += Number(dayRecs[o.id]?.[itemId]?.received || 0);
    });

    return Math.max(0, openingY + producedY - distributedY);
  };

  const updateProducedDirectly = async (itemId: string, qty: number) => {
    const batchId = `DIRECT_${itemId}`; // Use stable ID to prevent duplicates
    const newBatch = {
      id: batchId,
      timestamp: Date.now(),
      items: [{ itemId, qty }]
    };

    const docId = `PROD_${currentDate}`;
    
    // Functional update for records to include production immediately
    setRecords((prev: any) => {
      const dayRecs = prev[currentDate] || {};
      const batches = dayRecs.batches || {};
      return {
        ...prev,
        [currentDate]: {
          ...dayRecs,
          batches: {
            ...batches,
            [batchId]: newBatch
          }
        }
      };
    });

    try {
      const docRef = doc(db, DAILY_RECORDS_COL, docId);
      try {
        await updateDoc(docRef, {
          [`batches.${batchId}`]: newBatch
        });
      } catch (e: any) {
        if (e.code === 'not-found') {
          await setDoc(docRef, {
            date: currentDate,
            batches: {
              [batchId]: newBatch
            }
          }, { merge: true });
        } else {
          throw e;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${DAILY_RECORDS_COL}/${docId}`);
    }
  };

  const [stableItems, setStableItems] = useState<any[]>([]);

  useEffect(() => {
    const priority = ['CAKES', 'PASTRIES', 'COOKIES'];
    const sorted = [...items]
      .filter((i: any) => i.status !== 'inactive')
      .sort((a, b) => {
      // 0. Absolute Priority Item Rank
      const priorityIndexA = PRIORITY_ITEM_NAMES.indexOf(a.name);
      const priorityIndexB = PRIORITY_ITEM_NAMES.indexOf(b.name);
      
      if (priorityIndexA !== -1 || priorityIndexB !== -1) {
        const valA = priorityIndexA === -1 ? 9999 : priorityIndexA;
        const valB = priorityIndexB === -1 ? 9999 : priorityIndexB;
        if (valA !== valB) return valA - valB;
      }

      // 1. Category Rank
      const getW = (c: string) => {
        const cat = c.toUpperCase();
        const idx = priority.indexOf(cat);
        return idx === -1 ? 99 : idx;
      };
      const weightA = getW(a.category);
      const weightB = getW(b.category);
      if (weightA !== weightB) return weightA - weightB;

      // 2. Quantity (Live context check is hard inside stableItems without full records, 
      // but we can sort the results later in useMemo or here if we have records)
      return a.name.localeCompare(b.name);
    });
    setStableItems(sorted);
  }, [items]);

  const productionData = useMemo(() => {
    const dayRecords = records[currentDate] || {};
    const dailyProduction: { [itemId: string]: number } = {};
    
    if (dayRecords.batches) {
      Object.values(dayRecords.batches).forEach((batch: any) => {
        if (!batch || !batch.items) return;
        batch.items.forEach((bi: any) => {
          dailyProduction[bi.itemId] = Number(dailyProduction[bi.itemId] || 0) + Number(bi.qty || 0);
        });
      });
    }

    const results: any[] = [];
    
    stableItems.forEach((item: any) => {
      let totalDistributed = 0;
      const distributionPerOutlet: { [key: string]: number } = {};
      
      OUTLETS.forEach(outlet => {
        const qty = Number(dayRecords[outlet.id]?.[item.id]?.received || 0);
        distributionPerOutlet[outlet.id] = qty;
        totalDistributed += qty;
      });
      
      const isMatch = !searchTerm.trim() || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (isMatch) {
        const initialFromState = coldRoomState[currentDate]?.[item.id];
        const systemOpening = getPreviousColdRoomClosing(item.id, currentDate);
        const actualOpening = (initialFromState === undefined || initialFromState === null) ? systemOpening : Number(initialFromState);
        const produced = dailyProduction[item.id] || 0;
        const liveCrQty = actualOpening + produced - totalDistributed;
        
        const hasRequirements = requirements.some(r => r.itemId === item.id);

        results.push({
          id: item.id,
          name: item.name,
          category: item.category,
          todayProduced: produced,
          overnightColdRoom: actualOpening,
          systemOpening: systemOpening,
          liveColdRoom: liveCrQty,
          distribution: distributionPerOutlet,
          hasReq: hasRequirements
        });
      }
    });

    // --- SORT RESULTS ---
    return results.sort((a, b) => {
      const activeA = a.todayProduced > 0 || a.overnightColdRoom > 0;
      const activeB = b.todayProduced > 0 || b.overnightColdRoom > 0;

      // 1. Items with quantity first
      if (activeA && !activeB) return -1;
      if (!activeA && activeB) return 1;

      // 2. Items with requirements next
      if (a.hasReq && !b.hasReq) return -1;
      if (!a.hasReq && b.hasReq) return 1;

      // 3. Category Priority (Cakes > Pastries > Patty/Savouries)
      const getPriority = (item: any) => {
        const cat = (item.category || "").toLowerCase();
        const name = (item.name || "").toLowerCase();
        
        if (cat.includes('cake')) return 1;
        if (cat.includes('pastry')) return 2;
        if (name.includes('patty') || name.includes('puff')) return 3;
        if (cat.includes('savouries')) return 4;
        return 99;
      };

      const pA = getPriority(a);
      const pB = getPriority(b);
      
      if (pA !== pB) return pA - pB;

      // 4. Name
      return a.name.localeCompare(b.name);
    });
  }, [stableItems, records, currentDate, coldRoomState, searchTerm, requirements]);

  const productionSummary = useMemo(() => {
    return productionData.reduce((acc, curr) => {
      acc.totalProduced += curr.todayProduced;
      acc.totalDistributed += Object.values(curr.distribution).reduce((a: any, b: any) => a + b, 0);
      acc.totalColdRoom += curr.liveColdRoom;
      if (curr.liveColdRoom < 5 && (curr.todayProduced > 0 || curr.overnightColdRoom > 0)) acc.lowStockCount++;
      return acc;
    }, { totalProduced: 0, totalDistributed: 0, totalColdRoom: 0, lowStockCount: 0 });
  }, [productionData]);

  const addProductionBatch = async (batchItems: { itemId: string, qty: number }[]) => {
    const batchId = `BATCH_${Date.now()}`;
    const newBatch = {
      id: batchId,
      timestamp: Date.now(),
      items: batchItems
    };

    try {
      await setDoc(doc(db, DAILY_RECORDS_COL, currentDate), {
        batches: {
          [batchId]: newBatch
        }
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${DAILY_RECORDS_COL}/${currentDate}`);
    }
  };

  const updateColdRoom = async (itemId: string, qty: number) => {
    const id = `${currentDate}_${itemId}`;
    try {
      await setDoc(doc(db, COLD_ROOM_COL, id), {
        date: currentDate,
        itemId,
        itemName: items.find((i: any) => i.id === itemId)?.name,
        quantity: qty
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, COLD_ROOM_COL);
    }
  };

  const saveColdRoom = async () => {
    setSaving(true);
    try {
      // Small delay to simulate final sync/verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Success! Kitchen stock has been synchronized with all outlets.");
    } finally {
      setSaving(false);
    }
  };

  const exportConsolidated = () => {
    const doc = new jsPDF('l', 'pt'); // Landscape for more columns
    doc.setFontSize(20);
    doc.text(`KITCHEN PRODUCTION & DISTRIBUTION SUMMARY - ${currentDate}`, 40, 50);
    
    const headers = ['Item Name', 'Opening', 'Produced', ...OUTLETS.map(o => o.name), 'Coldroom Closing'];
    const body = productionData
      .filter(p => p.todayProduced > 0 || p.overnightColdRoom > 0 || Object.values(p.distribution).some((v: any) => v > 0))
      .map(p => {
        const row = [
          p.name,
          p.overnightColdRoom,
          p.todayProduced,
          ...OUTLETS.map(o => p.distribution[o.id] || 0),
          p.liveColdRoom
        ];
        return row;
      });

    autoTable(doc, {
      startY: 80,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8, cellPadding: 5 }
    });
    
    doc.save(`kitchen-report-${currentDate}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f3f0]">
      <header className="p-4 md:p-8 border-b-2 border-brand-text bg-white shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center">
                <Menu size={24} />
             </button>
             <div>
                <h2 className="text-3xl md:text-5xl font-brand-serif italic leading-none text-brand-text">Kitchen Console</h2>
                <div className="flex items-center gap-4 mt-3">
                   <input 
                      type="date" 
                      className="text-[10px] font-black border border-brand-border px-3 py-1.5 outline-none shadow-inner bg-white" 
                      value={currentDate} 
                      onChange={e => setCurrentDate(e.target.value)}
                   />
                   <div className="flex bg-slate-100 p-1 border border-brand-border gap-1 overflow-x-auto no-scrollbar">
                      <button 
                        onClick={() => setGlobalMode('add')}
                        className={`whitespace-nowrap px-3 py-1.5 text-[8px] font-black uppercase transition-all ${Object.values(distributionModes).every(v => v === 'add') ? 'bg-brand-text text-white shadow-md' : 'text-slate-400 hover:text-brand-text'}`}
                      >ADD</button>
                      <button 
                        onClick={() => setGlobalMode('replace')}
                        className={`whitespace-nowrap px-3 py-1.5 text-[8px] font-black uppercase transition-all ${Object.values(distributionModes).every(v => v === 'replace') ? 'bg-brand-text text-white shadow-md' : 'text-slate-400 hover:text-brand-text'}`}
                      >REPLACE</button>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-2xl mx-auto md:mx-0">
             <div className="bg-blue-50 border border-blue-200 p-3 flex flex-col justify-center">
                <span className="text-[7px] font-black uppercase opacity-40">Total Produced</span>
                <span className="text-xl font-brand-mono font-bold leading-none text-blue-900">{productionSummary.totalProduced}</span>
             </div>
             <div className="bg-orange-50 border border-orange-200 p-3 flex flex-col justify-center">
                <span className="text-[7px] font-black uppercase opacity-40">Total Dispatched</span>
                <span className="text-xl font-brand-mono font-bold leading-none text-orange-900">{productionSummary.totalDistributed}</span>
             </div>
             <div className="bg-green-50 border border-green-200 p-3 flex flex-col justify-center">
                <span className="text-[7px] font-black uppercase opacity-40">Stock In Coldroom</span>
                <span className="text-xl font-brand-mono font-bold leading-none text-green-900">{productionSummary.totalColdRoom}</span>
             </div>
             <div className={`border p-3 flex flex-col justify-center ${productionSummary.lowStockCount > 0 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[7px] font-black uppercase opacity-40">Low Stock Items</span>
                <span className={`text-xl font-brand-mono font-bold leading-none ${productionSummary.lowStockCount > 0 ? 'text-red-900' : 'text-slate-400'}`}>{productionSummary.lowStockCount}</span>
             </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:flex-initial">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                <input 
                  type="text" 
                  placeholder="SEARCH KITCHEN LOG..." 
                  className="w-full md:w-64 pl-9 pr-4 py-3 bg-brand-bg border border-brand-border text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-brand-text outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             
             <div className="flex gap-2">
               <button 
                 onClick={saveColdRoom}
                 disabled={saving}
                 className={`flex-1 md:flex-none h-12 px-6 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl ${saving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'}`}
               >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Save size={16} /> <span className="md:inline">SAVE</span>
                    </>
                  )}
               </button>

               <button onClick={exportConsolidated} className="flex-1 md:flex-none px-6 h-12 border-2 border-brand-text text-brand-text text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-text hover:text-white transition-colors group">
                  <FileDown size={14} className="group-hover:scale-110 transition-transform" /> <span className="md:inline">EXPORT</span>
               </button>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* MOBILE TABBED CONTROLLER */}
          <div className="md:hidden grid grid-cols-2 border-4 border-brand-text shadow-[6px_6px_0_0_rgba(0,0,0,1)] mb-8 overflow-hidden bg-white">
             <button 
               onClick={() => setActiveTab('production')}
               className={`flex flex-col items-center justify-center py-4 gap-2 transition-all ${activeTab === 'production' ? 'bg-brand-text text-white' : 'text-brand-text hover:bg-slate-50'}`}
             >
                <Database size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Production</span>
             </button>
             <button 
               onClick={() => setActiveTab('distribution')}
               className={`flex flex-col items-center justify-center py-4 gap-2 transition-all border-l-4 border-brand-text ${activeTab === 'distribution' ? 'bg-brand-text text-white' : 'text-brand-text hover:bg-slate-50'}`}
             >
                <Truck size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Distribution</span>
             </button>
          </div>

          {activeTab === 'distribution' && (
            <div className="md:hidden mb-8 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 border-l-4 border-slate-200">Select Destination</div>
              <div className="flex overflow-x-auto no-scrollbar gap-3 px-1 pb-2">
                {OUTLETS.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setActiveMobileOutlet(o.id)}
                    className={`whitespace-nowrap px-6 py-3 text-[10px] font-black uppercase border-2 transition-all shrink-0 ${activeMobileOutlet === o.id ? 'border-brand-text bg-brand-text text-white shadow-[4px_4px_0_0_rgba(0,0,0,1)]' : 'border-brand-border bg-white text-slate-400 hover:border-brand-text/30'}`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {Object.entries(
            productionData.reduce((acc: any, p: any) => {
              if (!acc[p.category]) acc[p.category] = [];
              acc[p.category].push(p);
              return acc;
            }, {})
          ).map(([category, items]: any) => (
            <div key={category} className="bg-white border border-brand-border shadow-sm p-4 overflow-hidden">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-4 border-b border-brand-border pb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-text rotate-45" /> {category}
              </h3>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left font-brand-mono text-[10px] border-collapse">
                  <thead className="bg-[#1a1a1a] text-white border-b border-brand-border">
                    <tr>
                      <th className="p-4 border-r border-white/10 uppercase tracking-tighter w-48 sticky left-0 z-20 bg-[#1a1a1a]">ITEM NAME</th>
                      <th className={`${activeTab === 'production' ? 'table-cell' : 'hidden md:table-cell'} p-4 text-center border-r border-white/10 uppercase tracking-tighter bg-blue-900/40 w-24`}>MADE TODAY</th>
                      {OUTLETS.map(outlet => (
                        <th key={outlet.id} className={`p-2 border-r border-white/10 bg-[#222] min-w-[120px] ${activeTab === 'distribution' && (activeMobileOutlet === outlet.id) ? 'table-cell' : 'hidden md:table-cell'}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[7px] uppercase tracking-tighter opacity-80">{outlet.name}</span>
                            <div className="flex bg-white/5 p-0.5 rounded border border-white/10 w-full overflow-hidden">
                              <button 
                                onClick={() => setDistributionModes(prev => ({ ...prev, [outlet.id]: 'add' }))}
                                className={`flex-1 text-[6px] font-black py-1 transition-colors ${distributionModes[outlet.id] === 'add' ? 'bg-white text-black' : 'text-white/40 hover:bg-white/10'}`}
                              >ADD</button>
                              <button 
                                onClick={() => setDistributionModes(prev => ({ ...prev, [outlet.id]: 'replace' }))}
                                className={`flex-1 text-[6px] font-black py-1 transition-colors ${distributionModes[outlet.id] === 'replace' ? 'bg-white text-black' : 'text-white/40'}`}
                              >REPLACE</button>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className={`${activeTab === 'production' ? 'table-cell' : 'hidden md:table-cell'} p-4 text-center uppercase tracking-tighter bg-brand-text/20 w-32`}>KITCHEN STOCK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee]">
                    {items.map((p: any) => (
                      <ProductionRow 
                        key={p.id}
                        p={p}
                        idx={productionData.indexOf(p)}
                        updateOutletDistribution={updateOutletDistribution}
                        updateProducedDirectly={updateProducedDirectly}
                        updateColdRoom={updateColdRoom}
                        modes={distributionModes}
                        activeMobileOutlet={activeTab === 'production' ? 'ALL_TABS' : activeMobileOutlet}
                        requirements={requirements}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// --- NEW COMPONENT: DISTRIBUTION TRACKER ---
const DistributionComponent = React.memo(({ items, records, selectedOutletId, setSelectedOutletId, setIsSidebarOpen }: any) => {
  const [dateRange, setDateRange] = useState({ 
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd') 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [localOutletFilter, setLocalOutletFilter] = useState(selectedOutletId || 'all');
  
  const distributionData = useMemo(() => {
    const results: any[] = [];
    const sortedDates = Object.keys(records || {}).sort((a, b) => b.localeCompare(a));
    
    sortedDates.forEach(date => {
      if (date < dateRange.start || date > dateRange.end) return;
      
      const dayData = records[date] || {};
      Object.keys(dayData).forEach(outletId => {
        if (localOutletFilter !== 'all' && outletId !== localOutletFilter) return;
        
        const outlet = OUTLETS.find(o => o.id === outletId);
        const dailyRecord = dayData[outletId];
        if (!dailyRecord) return;
        
        Object.keys(dailyRecord).forEach(itemId => {
          const item = items.find((i: any) => i.id === itemId);
          const data = dailyRecord[itemId];
          if (!data) return;
          
          if (data.received > 0) {
            const matchesSearch = !searchTerm.trim() || 
                                  item?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  outlet?.name.toLowerCase().includes(searchTerm.toLowerCase());
                                  
            if (matchesSearch) {
              results.push({
                date,
                outletName: outlet?.name || outletId,
                itemName: item?.name || itemId,
                category: item?.category || 'General',
                quantity: data.received
              });
            }
          }
        });
      });
    });
    
    return results;
  }, [items, records, dateRange, searchTerm, localOutletFilter]);

  const exportDistributionPDF = useCallback(() => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text('DISPATCH LOG REPORT', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 22);

    const headers = [['Date', 'Outlet', 'Item Description', 'Qty']];
    const body = distributionData.map(d => [
      format(new Date(d.date), 'dd MMM yyyy'),
      d.outletName,
      d.itemName,
      d.quantity
    ]).filter(row => Number(row[3]) !== 0);

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50], textColor: 255 },
      styles: { fontSize: 8 }
    });

    doc.save(`dispatch-log-${dateRange.start}-to-${dateRange.end}.pdf`);
  }, [distributionData, dateRange]);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <header className="p-4 md:p-8 bg-white border-b-2 border-brand-text shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border h-12 w-12 flex items-center justify-center">
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-3xl md:text-5xl font-brand-serif italic leading-none text-brand-text">Dispatch Log</h2>
              <div className="flex items-center gap-4 mt-2">
                <select 
                  value={localOutletFilter}
                  onChange={(e) => setLocalOutletFilter(e.target.value)}
                  className="bg-brand-bg border border-brand-border px-2 py-1 text-[10px] font-black uppercase outline-none"
                >
                  <option value="all">All Outlets</option>
                  {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <p className="text-[10px] font-black uppercase tracking-[.3em] opacity-40">Outlet Supply Tracker & Audit Log</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <button 
               onClick={exportDistributionPDF}
               className="h-10 px-6 bg-white border-2 border-brand-text text-[10px] font-black uppercase tracking-widest hover:bg-brand-text hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
             >
               <Download size={14} />
               Export PDF
             </button>
             <div className="flex items-center gap-2 bg-brand-bg p-1 border border-brand-border h-10">
                <Calendar size={14} className="ml-2 opacity-30" />
                <input 
                  type="date" 
                  className="bg-transparent text-[10px] font-black outline-none w-28" 
                  value={dateRange.start}
                  onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
                <span className="text-[10px] opacity-30 px-1">→</span>
                <input 
                  type="date" 
                  className="bg-transparent text-[10px] font-black outline-none w-28"
                  value={dateRange.end}
                  onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
             </div>
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                <input 
                  type="text" 
                  placeholder="SEARCH DISPATCH..." 
                  className="h-10 pl-9 pr-4 bg-white border border-brand-border text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-brand-text outline-none w-48"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border-2 border-brand-text shadow-[12px_12px_0px_rgba(0,0,0,0.05)] overflow-hidden">
             <table className="w-full text-left font-brand-mono text-[10px]">
                <thead className="bg-brand-text text-white">
                   <tr>
                      <th className="p-4 uppercase tracking-widest">Date</th>
                      <th className="p-4 uppercase tracking-widest">Outlet</th>
                      <th className="p-4 uppercase tracking-widest">Item Distributed</th>
                      <th className="p-4 uppercase tracking-widest text-right">Quantity</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-[#eee]">
                   {distributionData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 font-black">{format(new Date(row.date), 'dd MMM yyyy')}</td>
                         <td className="p-4">
                            <span className="px-2 py-1 bg-brand-bg border border-brand-border font-black uppercase text-[9px]">{row.outletName}</span>
                         </td>
                         <td className="p-4">
                            <div className="font-black uppercase">{row.itemName}</div>
                            <div className="text-[8px] opacity-40 uppercase font-bold">{row.category}</div>
                         </td>
                         <td className="p-4 text-right">
                            <span className="text-xl font-brand-serif italic">{row.quantity}</span>
                         </td>
                      </tr>
                   ))}
                   {distributionData.length === 0 && (
                      <tr>
                         <td colSpan={4} className="p-20 text-center font-brand-serif italic opacity-30 text-2xl">No distribution records for this period.</td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
});

// --- NEW COMPONENT: AI FORECASTER ---
const PredictionComponent = React.memo(({ items, records, setIsSidebarOpen }: any) => {
  const [predictionDate, setPredictionDate] = useState(format(subDays(new Date(), -1), 'yyyy-MM-dd'));
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const generatePredictions = async () => {
    setRunning(true);
    try {
      // Collect last 7 days of data for context
      const historyContext: any[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = format(subDays(new Date(predictionDate), i), 'yyyy-MM-dd');
        const dayRecs = records[d] || {};
        const dailySummary: any = { date: d, items: {} };
        items.forEach((item: any) => {
          let totalSold = 0;
          OUTLETS.forEach(o => {
            totalSold += (dayRecs[o.id]?.[item.id]?.sold || 0);
          });
          dailySummary.items[item.id] = totalSold;
        });
        historyContext.push(dailySummary);
      }

      const response = await fetch("/api/gemini/predict-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictionDate,
          items,
          historyContext
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate prediction");
      }

      const aiResponse = await response.json();

      const enriched = aiResponse.map((rec: any) => {
        const item = items.find((i: any) => i.id === rec.itemId);
        const outletNeeds: any = {};
        OUTLETS.forEach(o => {
           outletNeeds[o.name] = Math.ceil(rec.suggested / OUTLETS.length);
        });
        return {
          id: rec.itemId,
          name: item?.name || 'Unknown',
          category: item?.category || 'General',
          total: rec.suggested,
          reason: rec.reason,
          outlets: outletNeeds
        };
      });

      setRecommendations(enriched);
    } catch (e) {
      console.error("AI Prediction Failed:", e);
      // Fallback
    } finally {
      setRunning(false);
    }
  };

  const filteredRecommendations = useMemo(() => {
    if (!searchTerm.trim()) return recommendations;
    return recommendations.filter(rec => 
      rec.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      rec.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recommendations, searchTerm]);

  const exportPredictionsPDF = useCallback(() => {
    if (recommendations.length === 0) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text(`AI DEMAND FORECAST - ${predictionDate}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 22);

    const headers = [['Item Description', 'Suggested Production', 'AI Reasoning']];
    const body = recommendations.map(rec => [
      rec.name,
      rec.total,
      rec.reason
    ]).filter(row => Number(row[1]) !== 0);

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50] },
      styles: { fontSize: 9 }
    });

    doc.save(`ai-forecast-${predictionDate}.pdf`);
  }, [recommendations, predictionDate]);

  return (
    <div className="flex flex-col h-full bg-[#f8f7f4]/85 backdrop-blur-md">
      <header className="p-4 md:p-8 bg-white border-b-2 border-brand-text shrink-0">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 border border-brand-border">
                  <Menu size={20} />
               </button>
               <div>
                  <h2 className="text-3xl font-brand-serif italic">AI Forecaster</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">Smart Demand Prediction Engine</p>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               {recommendations.length > 0 && (
                 <button 
                  onClick={exportPredictionsPDF}
                  className="h-10 px-4 bg-white border-2 border-brand-text text-[10px] font-black uppercase tracking-widest hover:bg-brand-text hover:text-white transition-all flex items-center gap-2"
                 >
                   <Download size={14} />
                   Export PDF
                 </button>
               )}
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                  <input 
                    type="text" 
                    placeholder="SEARCH FORECAST..." 
                    className="h-10 pl-9 pr-4 bg-brand-bg border border-brand-border text-[10px] font-black uppercase tracking-widest outline-none w-48"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
               <div>
                  <input 
                    type="date" 
                    className="h-10 border border-brand-border px-3 font-black text-xs outline-none"
                    value={predictionDate}
                    onChange={e => setPredictionDate(e.target.value)}
                  />
               </div>
               <button 
                  onClick={generatePredictions}
                  disabled={running}
                  className="h-10 px-8 bg-brand-text text-white text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-3 active:scale-95 transition-all disabled:opacity-30"
               >
                  {running ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Run Prediction
               </button>
            </div>
         </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
         <div className="max-w-6xl mx-auto">
            {filteredRecommendations.length > 0 ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredRecommendations.map(rec => (
                    <div key={rec.id} className="bg-white border border-brand-border p-6 shadow-sm group hover:border-brand-text transition-all">
                       <div className="flex justify-between items-start mb-4 border-b border-brand-border pb-4">
                          <div>
                            <h3 className="text-base font-black uppercase text-brand-text">{rec.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{rec.category}</span>
                               <span className="text-[8px] font-black bg-blue-50 text-blue-800 px-1 border border-blue-100 uppercase">{rec.reason}</span>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-2xl font-brand-serif italic text-brand-text">{rec.total}</div>
                             <div className="text-[8px] font-black opacity-30 uppercase tracking-[.2em]">Suggested Made</div>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-y-3">
                          {Object.entries(rec.outlets || {}).map(([name, qty]: any) => (
                             <div key={name} className="flex justify-between items-center pr-4 border-r border-[#eee] last:border-0 odd:border-r border-dotted">
                                <span className="text-[9px] font-black uppercase opacity-60 truncate">{name}</span>
                                <span className="font-brand-mono text-xs font-bold">{qty}</span>
                             </div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            ) : (
               <div className="py-24 text-center border-2 border-dashed border-brand-border opacity-20">
                  <Sparkles size={40} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[.3em] max-w-sm mx-auto leading-relaxed">
                     Select target date and run model <br/> to generate demand insights.
                  </p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
});

const BroomiesAestheticBackground = React.memo(() => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. Luxurious ambient gradient backdrops resembling a cozy artisan golden baking hearth */}
      <div className="absolute top-[10%] left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#E6DFD3]/60 to-transparent blur-[120px] mix-blend-multiply opacity-70 animate-pulse" />
      <div className="absolute bottom-[10%] right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#ECE8DF]/40 to-transparent blur-[140px] mix-blend-multiply opacity-60 animate-pulse" />

      {/* 2. Delicate, high-precision baker's coordinate grid */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: `linear-gradient(to right, #141414 1px, transparent 1px), linear-gradient(to bottom, #141414 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* 4. Real-time floating bakers star dust and particles rising elegantly */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => {
          const size = Math.random() * 5 + 3; // beautiful micro sparks
          const duration = Math.random() * 25 + 20; // slow cozy motion
          const delay = Math.random() * -15; // start pre-dispersed across screen
          const left = Math.random() * 100;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                bottom: `-5%`,
                width: size,
                height: size,
                background: i % 3 === 0 ? '#CEC9C2' : i % 3 === 1 ? '#e1ab3f' : '#141414',
                opacity: 0,
              }}
              animate={{
                y: ['0vh', '-105vh'],
                x: [0, Math.sin(i) * 35, Math.cos(i) * -35, 0],
                opacity: [0, 0.4, 0.7, 0.4, 0],
              }}
              transition={{
                duration: duration,
                repeat: Infinity,
                delay: delay,
                ease: "linear"
              }}
            />
          );
        })}
      </div>
    </div>
  );
});
BroomiesAestheticBackground.displayName = 'BroomiesAestheticBackground';
