import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { 
  Milk, Flame, Plus, Settings, Calendar, ChevronLeft, ChevronRight, 
  Trash2, Edit3, X, Check, Droplet, Zap, Wifi, ShoppingCart, 
  Wrench, Package, PauseCircle, PlayCircle, Download, Upload, Info
} from 'lucide-react';

// ==========================================
// 1. INDEXED-DB WRAPPER (OFFLINE STORAGE)
// ==========================================
const DB_NAME = 'TrackitProDB';
const DB_VERSION = 1;

class LocalDB {
  constructor() {
    this.db = null;
    this.isFallback = false;
    this.memoryStore = { 
      settings: [], milk: [], gas: [], water: [], 
      grocery: [], electricity_lotus: [], electricity_sadri: [], 
      water_bill: [], other_expenses: [], categories: [], custom: [] 
    };
  }

  async init() {
    if (this.db || this.isFallback) return;
    return new Promise((resolve) => {
      let idb;
      try {
        idb = window.indexedDB;
      } catch (err) {
        console.warn('IndexedDB access blocked. Using memory fallback.');
        this.isFallback = true;
        return resolve();
      }

      if (!idb) {
        this.isFallback = true;
        return resolve();
      }

      try {
        const request = idb.open(DB_NAME, DB_VERSION);
        request.onerror = (e) => {
          this.isFallback = true;
          resolve();
        };
        request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          const stores = [
            'settings', 'milk', 'gas', 'water', 
            'grocery', 'electricity_lotus', 'electricity_sadri', 
            'water_bill', 'other_expenses', 'categories', 'custom'
          ];
          stores.forEach(store => {
            if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
          });
        };
      } catch (e) {
         this.isFallback = true;
         resolve();
      }
    });
  }

  async get(storeName, key) {
    await this.init();
    if (this.isFallback) return this.memoryStore[storeName].find(item => item.id === key);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    if (this.isFallback) return [...this.memoryStore[storeName]];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, item) {
    await this.init();
    if (this.isFallback) {
      const index = this.memoryStore[storeName].findIndex(i => i.id === item.id);
      if (index > -1) this.memoryStore[storeName][index] = item;
      else this.memoryStore[storeName].push(item);
      return item;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    if (this.isFallback) {
      this.memoryStore[storeName] = this.memoryStore[storeName].filter(item => item.id !== key);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    await this.init();
    if (this.isFallback) {
      this.memoryStore = { 
        settings: [], milk: [], gas: [], water: [], 
        grocery: [], electricity_lotus: [], electricity_sadri: [], 
        water_bill: [], other_expenses: [], categories: [], custom: [] 
      };
      return;
    }
    const stores = [
      'settings', 'milk', 'gas', 'water', 
      'grocery', 'electricity_lotus', 'electricity_sadri', 
      'water_bill', 'other_expenses', 'categories', 'custom'
    ];
    for (let store of stores) {
      await new Promise((resolve) => {
        const tx = this.db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = resolve;
      });
    }
  }
}

const db = new LocalDB();

// Default Settings
const DEFAULT_SETTINGS = {
  id: 'main', theme: 'dark', currency: '₹', 
  milkPrice: 84, milkQty: 1, gasWeight: 14.2,
  waterTarget: 4
};

// ==========================================
// 2. HELPER COMPONENTS & ICONS
// ==========================================
const GlassCard = ({ children, className = '', onClick, style = {} }) => (
  <motion.div 
    whileTap={onClick ? { scale: 0.98 } : {}}
    onClick={onClick}
    style={style}
    className={`bg-neutral-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const IconButton = ({ icon: Icon, onClick, className = '', active }) => (
  <motion.button
    whileTap={{ scale: 0.85 }}
    onClick={onClick}
    className={`p-3 rounded-full flex items-center justify-center transition-colors
      ${active ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-neutral-400 hover:bg-white/10'} ${className}`}
  >
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
  </motion.button>
);

const ICONS_MAP = { Droplet, Zap, Wifi, ShoppingCart, Wrench, Package };

// Swipeable List Item
const SwipeableItem = ({ children, onDelete, onEdit }) => {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-3 bg-neutral-800/50">
      <div className="absolute inset-0 flex items-center justify-between px-6">
        <div className="text-blue-500 flex items-center gap-2"><Edit3 size={20}/> Edit</div>
        <div className="text-red-500 flex items-center gap-2">Delete <Trash2 size={20}/></div>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={(e, info) => {
          if (info.offset.x < -80 && onDelete) onDelete();
          if (info.offset.x > 80 && onEdit) onEdit();
        }}
        className="relative bg-neutral-900 border border-white/5 rounded-2xl p-4 shadow-lg z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

// ==========================================
// 3. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('milk'); // milk, gas, settings, custom-{id}
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState([]);
  const [isReady, setIsReady] = useState(false);
  
  // Modals state
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  
  // Global Month/Year filter
  const [filterDate, setFilterDate] = useState(new Date());

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedSettings = await db.get('settings', 'main');
        if (storedSettings) setSettings(storedSettings);
        else await db.put('settings', DEFAULT_SETTINGS);

        const storedCats = await db.getAll('categories');
        setCategories(storedCats || []);
      } catch (err) {
        console.error("Failed to load DB", err);
      } finally {
        setIsReady(true);
      }
    };
    loadData();
  }, []);

  const updateSettings = async (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await db.put('settings', updated);
  };

  if (!isReady) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;  return (
    <div className={`min-h-screen w-full font-sans selection:bg-blue-500/30 ${settings.theme === 'dark' ? 'dark bg-black text-white' : 'bg-gray-50 text-neutral-900'}`}>
      {/* Mobile Wrapper */}
      <div className="max-w-md mx-auto h-screen flex flex-col relative overflow-hidden bg-black">
        
        {/* Main Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto pb-24 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-4"
            >
              {activeTab === 'milk' && <MilkView filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'gas' && <GasView filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'water' && <WaterView filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'settings' && <SettingsView settings={settings} updateSettings={updateSettings} db={db} />}
              {activeTab === 'grocery' && <ExpenseView type="grocery" title="Grocery" icon={ShoppingCart} filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'elec-lotus' && <ExpenseView type="electricity_lotus" title="Electricity (Lotus)" icon={Zap} filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'elec-sadri' && <ExpenseView type="electricity_sadri" title="Electricity (Sadri)" icon={Zap} filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'water-bill' && <ExpenseView type="water_bill" title="Water Bill" icon={Droplet} filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              {activeTab === 'other' && <ExpenseView type="other_expenses" title="Other" icon={Package} filterDate={filterDate} setFilterDate={setFilterDate} settings={settings} />}
              
              {activeTab.startsWith('custom-') && (
                <CustomCategoryView 
                  categoryId={activeTab.replace('custom-', '')} 
                  categories={categories}
                  settings={settings}
                  filterDate={filterDate}
                  setFilterDate={setFilterDate}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation Bar */}
        <div className="absolute bottom-0 w-full px-4 pb-6 pt-2 bg-gradient-to-t from-black via-black/90 to-transparent z-40">
          <div className="flex items-center justify-around bg-neutral-900/80 backdrop-blur-3xl border border-white/10 rounded-full py-2 px-2 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <NavIcon icon={Milk} label="Milk" isActive={activeTab === 'milk'} onClick={() => setActiveTab('milk')} />
            <NavIcon icon={Flame} label="Gas" isActive={activeTab === 'gas'} onClick={() => setActiveTab('gas')} />
            <NavIcon icon={Droplet} label="Water" isActive={activeTab === 'water'} onClick={() => setActiveTab('water')} />
            
            {/* FAB (Add More) */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsAddSheetOpen(true)}
              className="bg-blue-500 text-white p-4 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] -mt-6 border-4 border-black z-50"
            >
              <Plus size={28} />
            </motion.button>

            <NavIcon icon={Settings} label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        </div>

        {/* Add More Bottom Sheet */}
        <BottomSheet isOpen={isAddSheetOpen} onClose={() => setIsAddSheetOpen(false)} title="Track Expenses" isCentered={true}>
          <div className="grid grid-cols-2 gap-4 mt-6">
             <ExpenseMenuItem icon={ShoppingCart} label="Grocery" onClick={() => { setActiveTab('grocery'); setIsAddSheetOpen(false); }} color="#10b981" />
             <ExpenseMenuItem icon={Zap} label="Elec (Lotus)" onClick={() => { setActiveTab('elec-lotus'); setIsAddSheetOpen(false); }} color="#f59e0b" />
             <ExpenseMenuItem icon={Zap} label="Elec (Sadri)" onClick={() => { setActiveTab('elec-sadri'); setIsAddSheetOpen(false); }} color="#f59e0b" />
             <ExpenseMenuItem icon={Droplet} label="Water Bill" onClick={() => { setActiveTab('water-bill'); setIsAddSheetOpen(false); }} color="#3b82f6" />
             <ExpenseMenuItem icon={Package} label="Other" onClick={() => { setActiveTab('other'); setIsAddSheetOpen(false); }} color="#8b5cf6" />
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}

const ExpenseMenuItem = ({ icon: Icon, label, onClick, color }) => (
  <button onClick={onClick} className="flex items-center gap-3 bg-neutral-800/50 hover:bg-neutral-800 border border-white/5 p-4 rounded-2xl transition-colors">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
      <Icon size={20} />
    </div>
    <span className="text-white font-semibold text-sm">{label}</span>
  </button>
);

const NavIcon = ({ icon: Icon, label, isActive, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 w-16">
    <Icon size={24} className={`transition-colors duration-300 ${isActive ? 'text-blue-500' : 'text-neutral-500'}`} strokeWidth={isActive ? 2.5 : 2} />
    <span className={`text-[10px] font-medium transition-colors duration-300 ${isActive ? 'text-blue-500' : 'text-neutral-500'}`}>{label}</span>
  </button>
);

// ==========================================
// 4. UI COMPONENTS (SHEET, HEADER)
// ==========================================
const BottomSheet = ({ isOpen, onClose, title, children, isCentered = false }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className={`absolute inset-0 z-50 flex ${isCentered ? 'items-center justify-center p-4' : 'items-end'}`}>
            <motion.div
              initial={isCentered ? { scale: 0.9, opacity: 0 } : { y: '100%' }}
              animate={isCentered ? { scale: 1, opacity: 1 } : { y: 0 }}
              exit={isCentered ? { scale: 0.9, opacity: 0 } : { y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`bg-neutral-900 border-t border-white/10 w-full max-h-[85vh] overflow-y-auto 
                ${isCentered ? 'rounded-[40px] border shadow-2xl relative' : 'rounded-t-[40px] pb-12'}`}
            >
              {!isCentered && <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-6 mb-6" />}
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
                  <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white"><X size={20}/></button>
                </div>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

const StickyHeader = ({ title, date, setDate }) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const handlePrev = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const handleNext = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));

  return (
    <div className="sticky top-0 pt-12 pb-4 px-2 z-30 bg-black/80 backdrop-blur-xl flex justify-between items-end mb-6 border-b border-white/5">
      <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
        <button onClick={handlePrev} className="text-neutral-400 hover:text-white"><ChevronLeft size={18}/></button>
        <span className="text-sm font-semibold text-white min-w-[70px] text-center">
          {monthNames[date.getMonth()]} {date.getFullYear()}
        </span>
        <button onClick={handleNext} className="text-neutral-400 hover:text-white"><ChevronRight size={18}/></button>
      </div>
    </div>
  );
};

// ==========================================
// 5. MILK MODULE
// ==========================================
function MilkView({ filterDate, setFilterDate, settings }) {
  const [entries, setEntries] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isListExpanded, setIsListExpanded] = useState(false);
  
  // Selection Mode for Pause
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);

  // Form State
  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    qty: settings.milkQty, 
    price: settings.milkPrice 
  });

  const loadEntries = useCallback(async () => {
    const all = await db.getAll('milk');
    const filtered = all.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === filterDate.getMonth() && d.getFullYear() === filterDate.getFullYear();
    });
    setEntries(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }, [filterDate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Calculations
  const stats = useMemo(() => {
    let qty = 0, amount = 0, active = 0, pause = 0;
    entries.forEach(e => {
      if (e.isPaused) { pause++; } 
      else { active++; qty += Number(e.qty); amount += Number(e.total); }
    });
    return { qty, amount, active, pause };
  }, [entries]);

  const handleSave = async () => {
    const total = formData.qty * formData.price;
    const item = {
      id: editingEntry?.id || Date.now().toString(),
      date: formData.date,
      qty: formData.qty,
      price: formData.price,
      total,
      isPaused: false
    };
    await db.put('milk', item);
    setIsModalOpen(false);
    loadEntries();
  };

  const handleDelete = async (id) => {
    await db.delete('milk', id);
    loadEntries();
  };

  const togglePauseStatus = async (dateStr) => {
    const existing = entries.find(e => e.date === dateStr);
    if (existing) {
      await db.put('milk', { ...existing, isPaused: !existing.isPaused, qty: 0, total: 0 });
    } else {
      await db.put('milk', { id: Date.now().toString(), date: dateStr, isPaused: true, qty: 0, price: 0, total: 0 });
    }
    loadEntries();
  };

  const handleBulkPause = async () => {
    for (let date of selectedDates) {
      await togglePauseStatus(date);
    }
    setIsSelectMode(false);
    setSelectedDates([]);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({ date: entry.date, qty: entry.qty, price: entry.price });
    setIsModalOpen(true);
  };

  const openAdd = (dateStr = new Date().toISOString().split('T')[0]) => {
    setEditingEntry(null);
    setFormData({ date: dateStr, qty: settings.milkQty, price: settings.milkPrice });
    setIsModalOpen(true);
  };

  // Generate Calendar Days
  const daysInMonth = new Date(filterDate.getFullYear(), filterDate.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({length: daysInMonth}, (_, i) => {
    const d = new Date(filterDate.getFullYear(), filterDate.getMonth(), i + 1);
    // Adjust to local timezone string format YYYY-MM-DD
    const dateStr = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
    return dateStr;
  });

  return (
    <div>
      <StickyHeader title="Milk Tracker" date={filterDate} setDate={setFilterDate} />
      
      {/* Summary Card */}
      <GlassCard className="p-5 mb-6 bg-gradient-to-br from-blue-500/20 to-purple-500/10 relative overflow-hidden">
        <img src="./milk-icon.png" alt="Milk" className="absolute -right-4 -top-4 w-24 h-24 opacity-30 rotate-12 pointer-events-none" />
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div>
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-white">{settings.currency}{stats.amount}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Total Quantity</p>
            <p className="text-3xl font-bold text-white">{stats.qty} L</p>
          </div>
          <div className="pt-3 border-t border-white/10">
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Active Days</p>
            <p className="text-xl font-semibold text-green-400">{stats.active}</p>
          </div>
          <div className="pt-3 border-t border-white/10">
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Pause Days</p>
            <p className="text-xl font-semibold text-orange-400">{stats.pause}</p>
          </div>
        </div>
      </GlassCard>

      {/* Calendar Grid */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Daily Tracking</h3>
        <button 
          onClick={() => { setIsSelectMode(!isSelectMode); setSelectedDates([]); }}
          className={`text-sm font-medium px-3 py-1 rounded-full ${isSelectMode ? 'bg-orange-500 text-white' : 'bg-white/10 text-neutral-300'}`}
        >
          {isSelectMode ? 'Cancel Selection' : 'Bulk Pause'}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-neutral-500 font-bold">{d}</div>
        ))}
        
        {/* Empty slots for offset */}
        {Array.from({length: new Date(filterDate.getFullYear(), filterDate.getMonth(), 1).getDay()}).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {calendarDays.map(dateStr => {
          const entry = entries.find(e => e.date === dateStr);
          const isSelected = selectedDates.includes(dateStr);
          const dayNum = parseInt(dateStr.split('-')[2], 10);
          const isToday = dateStr === new Date().toISOString().split('T')[0];

          return (
            <motion.button
              whileTap={{ scale: 0.9 }}
              key={dateStr}
              onClick={() => {
                if (isSelectMode) {
                  setSelectedDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
                } else {
                  if (entry && entry.isPaused) togglePauseStatus(dateStr); // Unpause
                  else if (entry) openEdit(entry);
                  else openAdd(dateStr);
                }
              }}
              onContextMenu={(e) => { e.preventDefault(); togglePauseStatus(dateStr); }} // Quick pause on long press/right click
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center relative border transition-colors
                ${isToday ? 'border-blue-500' : 'border-transparent'}
                ${isSelected ? 'bg-orange-500/40 border-orange-500' : 
                  entry?.isPaused ? 'bg-neutral-800/80 border-dashed border-orange-500/50 opacity-60' : 
                  entry ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/5'}
              `}
            >
              <span className={`text-sm font-medium ${entry ? 'text-white' : 'text-neutral-400'}`}>{dayNum}</span>
              {entry && !entry.isPaused && <span className="text-[9px] text-blue-300 font-bold">{entry.qty}L</span>}
              {entry?.isPaused && <PauseCircle size={12} className="text-orange-400 mt-1 absolute bottom-1" />}
            </motion.button>
          );
        })}
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {isSelectMode && selectedDates.length > 0 && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-24 left-4 right-4 z-40">
            <button onClick={handleBulkPause} className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2">
              <PauseCircle size={20} /> Mark {selectedDates.length} {selectedDates.length === 1 ? 'Day' : 'Days'} as Paused
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List View (Recent) */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Entries List</h3>
          <button 
            onClick={() => setIsListExpanded(!isListExpanded)}
            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isListExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        
        <AnimatePresence>
          {isListExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {entries.length === 0 && <p className="text-neutral-500 text-center py-4 text-sm">No entries this month.</p>}
              {entries.map(entry => (
                <SwipeableItem key={entry.id} onDelete={() => handleDelete(entry.id)} onEdit={() => openEdit(entry)}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.isPaused ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {entry.isPaused ? <PauseCircle size={20}/> : <Droplet size={20}/>}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{new Date(entry.date).toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}</p>
                        <p className="text-xs text-neutral-400">{entry.isPaused ? 'Paused' : `${entry.qty}L @ ${settings.currency}${entry.price}`}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${entry.isPaused ? 'text-neutral-500' : 'text-white'}`}>
                        {entry.isPaused ? '-' : `${settings.currency}${entry.total}`}
                      </p>
                    </div>
                  </div>
                </SwipeableItem>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <BottomSheet 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingEntry ? "Edit Milk Entry" : "Add Milk Entry"}
        isCentered={true}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 focus:border-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Quantity (L)</label>
              <input type="number" step="0.5" value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 text-xl font-bold focus:border-blue-500 outline-none" />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Price/L</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">{settings.currency}</span>
                <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 pl-7 text-white mt-1 text-xl font-bold focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
             {editingEntry && (
                <button onClick={() => handleDelete(editingEntry.id)} className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-xl">Delete</button>
             )}
            <button onClick={handleSave} className="flex-[2] bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20">
              Save Entry
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ==========================================
// 6. GAS MODULE
// ==========================================
function GasView({ filterDate, setFilterDate, settings }) {
  const [entries, setEntries] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [formData, setFormData] = useState({ 
    installDate: new Date().toISOString().split('T')[0], 
    uninstallDate: '',
    amount: '',
    weight: settings.gasWeight,
    notes: ''
  });

  const loadEntries = useCallback(async () => {
    const all = await db.getAll('gas');
    // Sort descending by install date
    setEntries(all.sort((a, b) => new Date(b.installDate) - new Date(a.installDate)));
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Utility to calculate days used correctly handling cross-month logic.
  const calculateDays = (start, end) => {
    if (!start) return 0;
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date(); // If no end date, use today
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  // Filter stats for the selected month/year
  const stats = useMemo(() => {
    const month = filterDate.getMonth();
    const year = filterDate.getFullYear();
    let cylindersUsed = 0, totalSpend = 0, activeDaysThisMonth = 0;

    entries.forEach(entry => {
      const install = new Date(entry.installDate);
      const uninstall = entry.uninstallDate ? new Date(entry.uninstallDate) : new Date(); // Active assumed until today

      // Check if cylinder was active during this month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);

      if (install <= endOfMonth && uninstall >= startOfMonth) {
        // It overlaps with the selected month
        const overlapStart = install > startOfMonth ? install : startOfMonth;
        const overlapEnd = uninstall < endOfMonth ? uninstall : endOfMonth;
        
        const daysInMonth = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
        activeDaysThisMonth += daysInMonth;

        // If installed in this month, count towards spend/cylinders
        if (install.getMonth() === month && install.getFullYear() === year) {
          cylindersUsed++;
          totalSpend += Number(entry.amount);
        }
      }
    });

    return { cylindersUsed, totalSpend, activeDaysThisMonth };
  }, [entries, filterDate]);

  const handleSave = async () => {
    const item = {
      id: editingEntry?.id || Date.now().toString(),
      ...formData
    };
    await db.put('gas', item);
    setIsModalOpen(false);
    loadEntries();
  };

  const handleDelete = async (id) => {
    await db.delete('gas', id);
    loadEntries();
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setFormData(entry);
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingEntry(null);
    setFormData({ 
      installDate: new Date().toISOString().split('T')[0], 
      uninstallDate: '', amount: '', weight: settings.gasWeight, notes: '' 
    });
    setIsModalOpen(true);
  };

  return (
    <div>
      <StickyHeader title="Gas Tracker" date={filterDate} setDate={setFilterDate} />

      {/* Summary Card */}
      <GlassCard className="p-5 mb-6 bg-gradient-to-br from-orange-500/20 to-red-500/10">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">New Cylinders</p>
            <p className="text-3xl font-bold text-white">{stats.cylindersUsed}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Total Spend</p>
            <p className="text-3xl font-bold text-white">{settings.currency}{stats.totalSpend}</p>
          </div>
          <div className="col-span-2 pt-3 border-t border-white/10">
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Usage Days This Month</p>
            <p className="text-xl font-semibold text-orange-400">{stats.activeDaysThisMonth} Days</p>
          </div>
        </div>
      </GlassCard>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Cylinder History</h3>
        <button onClick={openAdd} className="text-sm font-medium bg-orange-500 text-white px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg shadow-orange-500/20">
          <Plus size={16}/> Add New
        </button>
      </div>

      <div className="space-y-4">
        {entries.length === 0 && <p className="text-neutral-500 text-center py-4 text-sm">No gas records found.</p>}
        {entries.map((entry, idx) => {
           const daysUsed = calculateDays(entry.installDate, entry.uninstallDate);
           const isActive = !entry.uninstallDate;
           return (
            <SwipeableItem key={entry.id} onDelete={() => handleDelete(entry.id)} onEdit={() => openEdit(entry)}>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 mt-1 rounded-2xl flex items-center justify-center border ${isActive ? 'bg-orange-500/20 border-orange-500 text-orange-500' : 'bg-neutral-800 border-white/5 text-neutral-500'}`}>
                    <Flame size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-lg">Cylinder #{entries.length - idx}</p>
                      {isActive && <span className="bg-orange-500 text-white text-[9px] uppercase px-2 py-0.5 rounded-full font-bold">Active</span>}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Installed: {new Date(entry.installDate).toLocaleDateString()}
                    </p>
                    {entry.uninstallDate && (
                       <p className="text-xs text-neutral-500 mt-0.5">
                         Ended: {new Date(entry.uninstallDate).toLocaleDateString()}
                       </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{settings.currency}{entry.amount}</p>
                  <p className={`text-sm font-semibold mt-1 ${isActive ? 'text-orange-400' : 'text-neutral-500'}`}>{daysUsed} Days</p>
                </div>
              </div>
            </SwipeableItem>
           )
        })}
      </div>

      <BottomSheet isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEntry ? "Edit Cylinder" : "Add Cylinder"}>
         <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Install Date</label>
              <input type="date" value={formData.installDate} onChange={e => setFormData({...formData, installDate: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">End Date (Optional)</label>
              <input type="date" value={formData.uninstallDate} onChange={e => setFormData({...formData, uninstallDate: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 outline-none focus:border-orange-500 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">{settings.currency}</span>
                <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 pl-8 text-white mt-1 text-xl font-bold outline-none focus:border-orange-500" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Weight (KG)</label>
              <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 text-xl font-bold outline-none focus:border-orange-500" />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
             {editingEntry && (
                <button onClick={() => handleDelete(editingEntry.id)} className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-xl">Delete</button>
             )}
            <button onClick={handleSave} className="flex-[2] bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20">
              Save Cylinder
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ==========================================
// 7. CUSTOM CATEGORY MODULE
// ==========================================
function CustomCategoryView({ categoryId, categories, settings, filterDate, setFilterDate }) {
  const category = categories.find(c => c.id === categoryId) || {};
  const [entries, setEntries] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    qty: category.defaultQty || 1,
    amount: category.defaultAmount || 0,
    notes: ''
  });

  const loadEntries = useCallback(async () => {
    const all = await db.getAll('custom');
    const filtered = all.filter(e => {
      const d = new Date(e.date);
      return e.categoryId === categoryId && d.getMonth() === filterDate.getMonth() && d.getFullYear() === filterDate.getFullYear();
    });
    setEntries(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }, [categoryId, filterDate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const stats = useMemo(() => {
    return entries.reduce((acc, curr) => {
      acc.qty += Number(curr.qty || 0);
      acc.amount += Number(curr.amount || 0);
      return acc;
    }, { qty: 0, amount: 0 });
  }, [entries]);

  const handleSave = async () => {
    const item = {
      id: editingEntry?.id || Date.now().toString(),
      categoryId,
      ...formData
    };
    await db.put('custom', item);
    setIsModalOpen(false);
    loadEntries();
  };

  const handleDelete = async (id) => {
    await db.delete('custom', id);
    loadEntries();
  };

  const openAdd = () => {
    setEditingEntry(null);
    setFormData({ date: new Date().toISOString().split('T')[0], qty: category.defaultQty || 1, amount: category.defaultAmount || '', notes: '' });
    setIsModalOpen(true);
  };

  const CatIcon = ICONS_MAP[category.icon] || Package;

  return (
    <div>
      <StickyHeader title={category.name} date={filterDate} setDate={setFilterDate} />

      <GlassCard className="p-5 mb-6" style={{ background: `linear-gradient(135deg, ${category.color}33, transparent)` }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Total {category.unit || 'Units'}</p>
            <p className="text-3xl font-bold text-white">{stats.qty}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs font-medium uppercase tracking-wider mb-1">Total Spend</p>
            <p className="text-3xl font-bold text-white">{settings.currency}{stats.amount}</p>
          </div>
        </div>
      </GlassCard>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Records</h3>
        <button onClick={openAdd} className="text-sm font-medium text-white px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg" style={{ backgroundColor: category.color }}>
          <Plus size={16}/> Add Entry
        </button>
      </div>

      <div className="space-y-4">
        {entries.length === 0 && <p className="text-neutral-500 text-center py-4 text-sm">No entries yet.</p>}
        {entries.map(entry => (
          <SwipeableItem key={entry.id} onDelete={() => handleDelete(entry.id)} onEdit={() => { setEditingEntry(entry); setFormData(entry); setIsModalOpen(true); }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10" style={{ color: category.color }}>
                  <CatIcon size={20}/>
                </div>
                <div>
                  <p className="text-white font-semibold">{new Date(entry.date).toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}</p>
                  <p className="text-xs text-neutral-400">{entry.qty} {category.unit}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">{settings.currency}{entry.amount}</p>
              </div>
            </div>
          </SwipeableItem>
        ))}
      </div>

      <BottomSheet isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEntry ? `Edit ${category.name}` : `Add ${category.name}`}>
         <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Quantity</label>
              <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white mt-1 text-xl font-bold outline-none" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase font-semibold pl-1">Total Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">{settings.currency}</span>
                <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 pl-8 text-white mt-1 text-xl font-bold outline-none" />
              </div>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button onClick={handleSave} className="flex-1 text-white font-bold py-4 rounded-xl shadow-lg" style={{ backgroundColor: category.color }}>
              Save Entry
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ==========================================
// 8. SETTINGS & DATA MANAGEMENT MODULE
// ==========================================
function SettingsView({ settings, updateSettings, db }) {
  const handleExport = async () => {
    try {
      const data = {
        settings: await db.getAll('settings'),
        milk: await db.getAll('milk'),
        gas: await db.getAll('gas'),
        water: await db.getAll('water'),
        grocery: await db.getAll('grocery'),
        electricity_lotus: await db.getAll('electricity_lotus'),
        electricity_sadri: await db.getAll('electricity_sadri'),
        water_bill: await db.getAll('water_bill'),
        other_expenses: await db.getAll('other_expenses'),
        categories: await db.getAll('categories'),
        custom: await db.getAll('custom')
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trackit-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert('Data exported successfully!');
    } catch (e) {
      alert('Export failed.');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        await db.clearAll();
        if(data.settings) for(let i of data.settings) await db.put('settings', i);
        if(data.milk) for(let i of data.milk) await db.put('milk', i);
        if(data.gas) for(let i of data.gas) await db.put('gas', i);
        if(data.water) for(let i of data.water) await db.put('water', i);
        if(data.grocery) for(let i of data.grocery) await db.put('grocery', i);
        if(data.electricity_lotus) for(let i of data.electricity_lotus) await db.put('electricity_lotus', i);
        if(data.electricity_sadri) for(let i of data.electricity_sadri) await db.put('electricity_sadri', i);
        if(data.water_bill) for(let i of data.water_bill) await db.put('water_bill', i);
        if(data.other_expenses) for(let i of data.other_expenses) await db.put('other_expenses', i);
        if(data.categories) for(let i of data.categories) await db.put('categories', i);
        if(data.custom) for(let i of data.custom) await db.put('custom', i);
        alert('Data imported successfully! App will reload.');
        window.location.reload();
      } catch (err) {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const SettingBlock = ({ label, children }) => (
    <div className="flex justify-between items-center py-4 border-b border-white/5 last:border-0">
      <span className="text-white font-medium">{label}</span>
      <div className="w-1/2 text-right">{children}</div>
    </div>
  );

  return (
    <div className="pb-8">
      <div className="sticky top-0 pt-12 pb-4 px-2 z-30 bg-black/80 backdrop-blur-xl mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <section>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-4 mb-2">General</h3>
          <GlassCard className="px-5">
            <SettingBlock label="Currency Symbol">
              <input type="text" value={settings.currency} onChange={e => updateSettings({ currency: e.target.value })} className="w-full bg-black/40 text-white border border-white/10 rounded-lg p-2 text-right focus:border-blue-500 outline-none" />
            </SettingBlock>
            <SettingBlock label="Theme">
              <select value={settings.theme} onChange={e => updateSettings({ theme: e.target.value })} className="w-full bg-black/40 text-white border border-white/10 rounded-lg p-2 text-right outline-none appearance-none">
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode (Beta)</option>
              </select>
            </SettingBlock>
          </GlassCard>
        </section>

        {/* Water Settings */}
        <section>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-4 mb-2">Water Goals</h3>
          <GlassCard className="px-5">
            <SettingBlock label="Daily Target (L)">
              <input type="number" step="0.1" value={settings.waterTarget} onChange={e => updateSettings({ waterTarget: Number(e.target.value) })} className="w-full bg-black/40 text-white border border-white/10 rounded-lg p-2 text-right outline-none" />
            </SettingBlock>
          </GlassCard>
        </section>

        {/* Milk Settings */}
        <section>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-4 mb-2">Milk Defaults</h3>
          <GlassCard className="px-5">
            <SettingBlock label={`Default Price (${settings.currency}/L)`}>
              <input type="number" value={settings.milkPrice} onChange={e => updateSettings({ milkPrice: Number(e.target.value) })} className="w-full bg-black/40 text-white border border-white/10 rounded-lg p-2 text-right outline-none" />
            </SettingBlock>
            <SettingBlock label="Default Quantity (L)">
              <input type="number" step="0.5" value={settings.milkQty} onChange={e => updateSettings({ milkQty: Number(e.target.value) })} className="w-full bg-black/40 text-white border border-white/10 rounded-lg p-2 text-right outline-none" />
            </SettingBlock>
          </GlassCard>
        </section>

        {/* Gas Settings */}
        <section>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-4 mb-2">Gas Defaults</h3>
          <GlassCard className="px-5">
            <SettingBlock label="Cylinder Weight (KG)">
              <input type="number" step="0.1" value={settings.gasWeight} onChange={e => updateSettings({ gasWeight: Number(e.target.value) })} className="w-full bg-black/40 text-white border border-white/10 rounded-lg p-2 text-right outline-none" />
            </SettingBlock>
          </GlassCard>
        </section>

        {/* Data Management */}
        <section>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-4 mb-2">Data & Storage</h3>
          <GlassCard className="p-2">
            <button onClick={handleExport} className="w-full flex items-center justify-between p-4 text-white hover:bg-white/5 rounded-xl transition-colors">
              <span className="flex items-center gap-3"><Download size={20} className="text-blue-400"/> Backup Data (JSON)</span>
              <ChevronRight size={16} className="text-neutral-500"/>
            </button>
            <div className="relative w-full">
              <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="w-full flex items-center justify-between p-4 text-white hover:bg-white/5 rounded-xl transition-colors">
                <span className="flex items-center gap-3"><Upload size={20} className="text-orange-400"/> Restore Backup</span>
                <ChevronRight size={16} className="text-neutral-500"/>
              </div>
            </div>
            <button onClick={async () => {
              if(window.confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
                await db.clearAll(); window.location.reload();
              }
            }} className="w-full flex items-center justify-between p-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
              <span className="flex items-center gap-3"><Trash2 size={20}/> Delete All Data</span>
            </button>
          </GlassCard>
        </section>

        {/* Footer */}
        <div className="pt-8 pb-12 flex flex-col items-center justify-center text-center opacity-50">
          <Info size={24} className="text-neutral-400 mb-3" />
          <p className="text-sm text-neutral-300 font-bold tracking-widest uppercase mb-1">Trackit Pro</p>
          <p className="text-[10px] text-neutral-500 mb-4">Version 1.1.0 • Local Offline DB</p>
          <div className="flex gap-2 text-[10px] text-neutral-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span>React</span>•<span>Tailwind</span>•<span>IndexedDB</span>•<span>PWA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-6 font-medium">Made by Vikram Mistry</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 9. WATER MODULE
// ==========================================
function WaterView({ filterDate, setFilterDate, settings }) {
  const [allEntries, setAllEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const target = settings.waterTarget || 4;

  const loadEntries = useCallback(async () => {
    const all = await db.getAll('water');
    setAllEntries(all);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const dayEntries = allEntries.filter(e => e.date === selectedDate);
  const totalForSelectedDay = dayEntries.reduce((acc, curr) => acc + Number(curr.qty), 0);
  const percentage = Math.min((totalForSelectedDay / target) * 100, 100);

  const addWater = async (qty) => {
    const item = {
      id: Date.now().toString(),
      date: selectedDate,
      qty
    };
    await db.put('water', item);
    loadEntries();
  };

  // Calendar Logic
  const daysInMonth = new Date(filterDate.getFullYear(), filterDate.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({length: daysInMonth}, (_, i) => {
    const d = new Date(filterDate.getFullYear(), filterDate.getMonth(), i + 1);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  });

  return (
    <div>
      <StickyHeader title="Water Intake" date={filterDate} setDate={setFilterDate} />
      
      {/* Glass Animation */}
      <GlassCard className="p-8 mb-8 flex flex-col items-center relative overflow-hidden bg-neutral-900/40">
        <div className="relative w-32 h-48 border-[3px] border-white/20 rounded-b-[40px] rounded-t-lg overflow-hidden bg-black/20 shadow-inner">
           {/* Water Filling */}
           <motion.div 
             initial={{ height: 0 }}
             animate={{ height: `${percentage}%` }}
             className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400"
             transition={{ type: 'spring', damping: 25, stiffness: 60 }}
           >
             {/* Wave Animation SVG */}
             <svg className="absolute -top-4 left-0 w-[200%] h-6 fill-blue-400/80 animate-wave" viewBox="0 0 100 20" preserveAspectRatio="none">
               <path d="M0 10 Q 25 20 50 10 T 100 10 V 20 H 0 Z" />
             </svg>
             <svg className="absolute -top-3 left-[-100%] w-[200%] h-6 fill-blue-300/40 animate-wave-slow" viewBox="0 0 100 20" preserveAspectRatio="none">
               <path d="M0 10 Q 25 20 50 10 T 100 10 V 20 H 0 Z" />
             </svg>

             {/* Bubbles */}
             <motion.div 
               animate={{ y: [-10, -100], opacity: [0, 0.8, 0], x: [0, 10, -10, 0] }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="absolute bottom-4 left-1/4 w-1.5 h-1.5 bg-white/40 rounded-full blur-[1px]"
             />
             <motion.div 
               animate={{ y: [-20, -120], opacity: [0, 0.5, 0], x: [10, -5, 5, 0] }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1 }}
               className="absolute bottom-8 right-1/3 w-1 h-1 bg-white/30 rounded-full blur-[1px]"
             />
           </motion.div>
           
           {/* Glass Shine */}
           <div className="absolute top-0 left-2 w-2 h-full bg-white/5 skew-x-[-10deg] blur-sm" />
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-5xl font-black text-white tracking-tighter">{totalForSelectedDay}<span className="text-xl text-blue-400 ml-1">L</span></p>
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-1">
            {selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : new Date(selectedDate).toLocaleDateString('en-US', {day: 'numeric', month: 'short'})} Goal: {target}L • {Math.round(percentage)}%
          </p>
        </div>
      </GlassCard>

      <div className="grid grid-cols-4 gap-3 mb-8">
        {[0.25, 0.5, 0.75, 1].map(qty => (
          <motion.button
            key={qty}
            whileTap={{ scale: 0.9 }}
            onClick={() => addWater(qty)}
            className="bg-blue-500/10 border border-white/5 text-blue-400 font-bold py-4 rounded-3xl flex flex-col items-center gap-1 hover:bg-blue-500/20 transition-colors"
          >
            <Droplet size={18} />
            <span className="text-xs">{qty}L</span>
          </motion.button>
        ))}
      </div>

      {/* Water Calendar Grid */}
      <h3 className="text-lg font-bold text-white mb-4">Monthly View</h3>
      <div className="grid grid-cols-7 gap-2 mb-8">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-neutral-500 font-black">{d}</div>
        ))}
        {Array.from({length: new Date(filterDate.getFullYear(), filterDate.getMonth(), 1).getDay()}).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {calendarDays.map(dateStr => {
          const dTotal = allEntries.filter(e => e.date === dateStr).reduce((acc, curr) => acc + Number(curr.qty), 0);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const dayNum = parseInt(dateStr.split('-')[2], 10);

          return (
            <motion.button 
              key={dateStr}
              whileTap={{ scale: 0.9 }}
              onClick={() => { 
                if (selectedDate === dateStr) {
                  // Second click on same date - open history
                  setIsModalOpen(true);
                } else {
                  // First click on a different date - just update glass
                  setSelectedDate(dateStr);
                }
              }}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all
                ${isSelected ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/20' : 'border-transparent bg-white/5'}
                ${isToday && !isSelected ? 'border-white/20' : ''}
                ${dTotal > 0 && !isSelected ? 'border-blue-500/30' : ''}
              `}
            >
              <span className={`text-xs font-bold ${dTotal > 0 || isSelected ? 'text-white' : 'text-neutral-500'}`}>{dayNum}</span>
              {dTotal > 0 && <span className="text-[8px] text-blue-400 font-black leading-none mt-0.5">{dTotal}L</span>}
            </motion.button>
          );
        })}
      </div>

      <BottomSheet isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${new Date(selectedDate).toLocaleDateString('en-US', {day: 'numeric', month: 'short'})} Intake`} isCentered={true}>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {dayEntries.length === 0 && (
            <div className="text-center py-8">
               <p className="text-neutral-500 mb-4">No intake logged for this day.</p>
               <button onClick={() => setIsModalOpen(false)} className="bg-blue-500/20 text-blue-400 px-6 py-2 rounded-full text-xs font-bold">Add Now</button>
            </div>
          )}
          {[...dayEntries].reverse().map(e => (
            <div key={e.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Droplet size={18} />
                </div>
                <div>
                  <p className="text-white font-bold">{e.qty}L</p>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase">{new Date(Number(e.id)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
              <button onClick={async () => { await db.delete('water', e.id); loadEntries(); }} className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                <Trash2 size={18}/>
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

// ==========================================
// 10. EXPENSE MODULE (GROCERY, ELEC, etc)
// ==========================================
function ExpenseView({ type, title, icon: Icon, filterDate, setFilterDate, settings }) {
  const [entries, setEntries] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [formData, setFormData] = useState({});

  const loadEntries = useCallback(async () => {
    const all = await db.getAll(type);
    const filtered = all.filter(e => {
      const d = new Date(e.date || e.paymentDate);
      return d.getMonth() === filterDate.getMonth() && d.getFullYear() === filterDate.getFullYear();
    });
    setEntries(filtered.sort((a, b) => new Date(b.date || b.paymentDate) - new Date(a.date || a.paymentDate)));
  }, [type, filterDate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const totalAmount = entries.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const openAdd = () => {
    setEditingEntry(null);
    const today = new Date().toISOString().split('T')[0];
    if (type === 'grocery') setFormData({ purchasedFrom: '', date: today, amount: '', accountName: '', note: '' });
    else if (type.startsWith('electricity') || type === 'water_bill') setFormData({ amount: '', dueDate: today, paymentDate: today, note: '' });
    else setFormData({ itemName: '', amount: '', paymentDate: today, note: '' });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const item = { id: editingEntry?.id || Date.now().toString(), ...formData };
    await db.put(type, item);
    setIsModalOpen(false);
    loadEntries();
  };

  const handleDelete = async (id) => {
    await db.delete(type, id);
    loadEntries();
  };

  return (
    <div>
      <StickyHeader title={title} date={filterDate} setDate={setFilterDate} />
      
      <GlassCard className="p-6 mb-6 bg-gradient-to-br from-neutral-800 to-neutral-900/50 border-white/5">
        <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mb-1">Monthly Spending</p>
        <p className="text-4xl font-black text-white">{settings.currency}{totalAmount}</p>
      </GlassCard>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Record History</h3>
        <button onClick={openAdd} className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
          <Plus size={16}/> Add Record
        </button>
      </div>

      <div className="space-y-3">
        {entries.length === 0 && <p className="text-neutral-500 text-center py-8">No records found for this month.</p>}
        {entries.map(e => (
          <SwipeableItem key={e.id} onDelete={() => handleDelete(e.id)} onEdit={() => { setEditingEntry(e); setFormData(e); setIsModalOpen(true); }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400">
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold truncate">
                    {e.itemName || e.purchasedFrom || title}
                  </p>
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">
                    {new Date(e.date || e.paymentDate).toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}
                    {e.accountName && ` • ${e.accountName}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-black">{settings.currency}{e.amount}</p>
              </div>
            </div>
          </SwipeableItem>
        ))}
      </div>

      <BottomSheet isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingEntry ? 'Edit' : 'Add'} ${title}`} isCentered={true}>
        <div className="space-y-4">
          {type === 'grocery' && (
            <>
              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Purchased From</label>
                <input type="text" value={formData.purchasedFrom} onChange={e => setFormData({...formData, purchasedFrom: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Store Name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-blue-500" />
                </div>
                <div className="min-w-0">
                  <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Amount</label>
                  <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Account Name</label>
                <input type="text" value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Payment Method" />
              </div>
            </>
          )}

          {(type.startsWith('electricity') || type === 'water_bill') && (
            <>
              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Amount</label>
                <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Due Date</label>
                  <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-blue-500" />
                </div>
                <div className="min-w-0">
                  <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Payment Date</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-blue-500" />
                </div>
              </div>
            </>
          )}

          {type === 'other_expenses' && (
            <>
              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Item Name</label>
                <input type="text" value={formData.itemName} onChange={e => setFormData({...formData, itemName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Describe expense" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Amount</label>
                  <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="0.00" />
                </div>
                <div className="min-w-0">
                  <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Payment Date</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-blue-500" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] text-neutral-500 uppercase font-black mb-1 block ml-1">Note</label>
            <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 min-h-[100px]" placeholder="Add details..." />
          </div>

          <div className="pt-4 flex gap-3">
            {editingEntry && (
              <button onClick={() => handleDelete(editingEntry.id)} className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl">Delete</button>
            )}
            <button onClick={handleSave} className="flex-[2] bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl">
              {editingEntry ? 'Update' : 'Submit'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
