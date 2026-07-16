"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Settings2, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRightLeft, 
  Sliders, 
  Terminal, 
  FileText, 
  Package, 
  CheckCircle2, 
  TrendingUp,
  MapPin,
  Calendar,
  AlertOctagon,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Store {
  id: number;
  name: string;
  location: string;
}

interface Connection {
  from_store_name: string;
  to_store_name: string;
  from_store_id: number;
  to_store_id: number;
  distance_km: number;
}

interface InventoryItem {
  store_id: number;
  store_name: string;
  product_id: number;
  product_name: string;
  category: string;
  stock_level: number;
  reorder_threshold: number;
  expiry_date: string;
  price_aed: number;
}

interface Rules {
  near_expiry_days_threshold: string;
  ramadan_reorder_multiplier: string;
  standard_reorder_multiplier: string;
  allow_inter_branch_transfers: string;
  max_transfer_distance_km: string;
}

export default function Home() {
  const [data, setData] = useState<{
    stores: Store[];
    connections: Connection[];
    inventory: InventoryItem[];
    rules: Rules;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected filter states
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  
  // Rules modifying state
  const [updatingRuleKey, setUpdatingRuleKey] = useState<string | null>(null);
  const [editRules, setEditRules] = useState<Rules | null>(null);
  
  // Stock Transfer states
  const [customTransfer, setCustomTransfer] = useState({
    from_store_id: 0,
    to_store_id: 0,
    product_id: 0,
    quantity: 1
  });
  const [transferMessage, setTransferMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Agent Audit states
  const [customAuditQuery, setCustomAuditQuery] = useState("");
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [auditReport, setAuditReport] = useState<string | null>(null);

  // Load active inventory data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8000/api/inventory");
      if (!res.ok) throw new Error("Backend server is not running or accessible.");
      const json = await res.json();
      setData(json);
      setEditRules(json.rules);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update a single business rule
  const handleUpdateRule = async (key: keyof Rules, value: string) => {
    try {
      setUpdatingRuleKey(key);
      const res = await fetch("http://localhost:8000/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Failed to update rule.");
      
      // Update local state
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rules: { ...prev.rules, [key]: value }
        };
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingRuleKey(null);
    }
  };

  // Run stock transfer
  const handleExecuteTransfer = async (fromId: number, toId: number, pId: number, qty: number) => {
    try {
      setTransferMessage(null);
      const res = await fetch("http://localhost:8000/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_store_id: fromId,
          to_store_id: toId,
          product_id: pId,
          quantity: qty
        }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Transfer execution failed.");
      
      setTransferMessage({ type: "success", text: json.message });
      fetchData(); // reload inventory values
    } catch (err: any) {
      setTransferMessage({ type: "error", text: err.message });
    }
  };

  // Run AI Agent Audit Crew
  const handleRunAudit = async () => {
    try {
      setAuditRunning(true);
      setAuditReport(null);
      setAuditLogs([
        "[Operations Manager] Initializing multi-store inventory squad...",
        "[Data Miner] Fetching database schemas...",
        "[Data Miner] Querying active business rules from 'business_rules' table...",
        "[Data Miner] Extracting per-branch stock levels and historical sales averages..."
      ]);
      
      // Simulate terminal log additions
      const timer1 = setTimeout(() => {
        setAuditLogs(prev => [...prev, "[Watchman] Evaluating expiry dates against simulated current system date (2026-07-16)..."]);
      }, 2000);
      const timer2 = setTimeout(() => {
        setAuditLogs(prev => [...prev, "[Watchman] Scanning products below reorder thresholds. Highlighting Alerts..."]);
      }, 4000);
      const timer3 = setTimeout(() => {
        setAuditLogs(prev => [...prev, "[Demand Planner] Analyzing historical sales patterns (baseline vs. Ramadan)..."]);
      }, 6000);
      const timer4 = setTimeout(() => {
        setAuditLogs(prev => [...prev, "[Demand Planner] Calculating optimized inter-branch transfers and external orders..."]);
      }, 8000);
      const timer5 = setTimeout(() => {
        setAuditLogs(prev => [...prev, "[Operations Manager] Assembling final executive report..."]);
      }, 10000);

      const res = await fetch("http://localhost:8000/api/run-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_query: customAuditQuery || null }),
      });
      
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Agent audit failed.");
      
      setAuditLogs(prev => [...prev, "[Success] Operations audit completed successfully. Report compiled!"]);
      setAuditReport(json.report);
    } catch (err: any) {
      setAuditLogs(prev => [...prev, `[Error] ${err.message}`]);
    } finally {
      setAuditRunning(false);
    }
  };

  // Helper: check if product is near expiry
  const isNearExpiry = (expiryStr: string, nearExpiryThresholdDays: number): boolean => {
    const systemDate = new Date("2026-07-16");
    const expiryDate = new Date(expiryStr);
    const timeDiff = expiryDate.getTime() - systemDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff >= 0 && daysDiff <= nearExpiryThresholdDays;
  };

  // Simple Markdown display parser
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("# ")) {
        return <h1 key={idx} className="text-2xl font-bold mt-6 mb-3 text-gold">{line.replace("# ", "")}</h1>;
      } else if (line.startsWith("## ")) {
        return <h2 key={idx} className="text-xl font-semibold mt-5 mb-2 text-gold">{line.replace("## ", "")}</h2>;
      } else if (line.startsWith("### ")) {
        return <h3 key={idx} className="text-lg font-medium mt-4 mb-2">{line.replace("### ", "")}</h3>;
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={idx} className="ml-5 list-disc my-1">{line.substring(2)}</li>;
      } else if (line.trim().startsWith("|") && line.includes("---")) {
        return null; // skip dividers
      } else if (line.trim().startsWith("|")) {
        const cols = line.split("|").map(c => c.trim()).filter(c => c);
        // Header check
        const isHeader = idx > 0 && lines[idx - 1] === "" || idx === 0;
        return (
          <div key={idx} className="flex gap-4 border-b border-[#232733] py-2 px-4 bg-[#13161e]">
            {cols.map((col, colIdx) => (
              <span key={colIdx} className={`flex-1 ${isHeader ? "font-bold text-gold" : "text-sm"}`}>{col}</span>
            ))}
          </div>
        );
      }
      return <p key={idx} className="my-2 text-muted">{line}</p>;
    });
  };

  // Compute Alerts and transfers locally for dashboard displays
  const getAlerts = () => {
    if (!data) return { lowStock: [], nearExpiry: [] };
    const nearExpiryDays = parseInt(data.rules.near_expiry_days_threshold || "3");
    
    const lowStock = data.inventory.filter(item => item.stock_level <= item.reorder_threshold);
    const nearExpiry = data.inventory.filter(item => isNearExpiry(item.expiry_date, nearExpiryDays));
    
    return { lowStock, nearExpiry };
  };

  // Generate inter-branch transfer suggestions based on excess stock in database
  const getTransferSuggestions = () => {
    if (!data) return { standard: [], overrides: [] };
    const maxDist = parseFloat(data.rules.max_transfer_distance_km || "35.0");
    const transfersEnabled = data.rules.allow_inter_branch_transfers === "1";
    
    if (!transfersEnabled) return { standard: [], overrides: [] };
    
    const { lowStock } = getAlerts();
    const suggestions: Array<{
      product_id: number;
      product_name: string;
      from_store_id: number;
      from_store_name: string;
      to_store_id: number;
      to_store_name: string;
      qty: number;
      distance_km: number;
      is_override: boolean;
    }> = [];
    
    lowStock.forEach(item => {
      // Find other branches that have excess stock of this product
      // Excess stock is defined as stock_level > reorder_threshold
      const sources = data.inventory.filter(source => 
        source.product_id === item.product_id && 
        source.store_id !== item.store_id && 
        source.stock_level > source.reorder_threshold
      );
      
      sources.forEach(source => {
        const excess = source.stock_level - source.reorder_threshold;
        const deficit = item.reorder_threshold - item.stock_level;
        const transferQty = Math.min(excess, deficit);
        
        if (transferQty > 0) {
          // Find distance
          const connection = data.connections.find(conn => 
            conn.from_store_id === source.store_id && conn.to_store_id === item.store_id
          );
          const distance = connection ? connection.distance_km : 999;
          const is_override = distance > maxDist;
          
          suggestions.push({
            product_id: item.product_id,
            product_name: item.product_name,
            from_store_id: source.store_id,
            from_store_name: source.store_name,
            to_store_id: item.store_id,
            to_store_name: item.store_name,
            qty: transferQty,
            distance_km: distance,
            is_override
          });
        }
      });
    });
    
    return {
      standard: suggestions.filter(s => !s.is_override),
      overrides: suggestions.filter(s => s.is_override)
    };
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-height-100vh h-screen gap-4">
        <RefreshCw className="animate-spin text-gold" size={40} style={{ color: "#c3b189" }} />
        <p className="font-display font-medium text-gold">Loading multi-store dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-height-100vh h-screen gap-6 p-6 text-center">
        <AlertOctagon className="text-red" size={60} style={{ color: "#dd5e56" }} />
        <div>
          <h2 className="text-2xl font-bold font-display mb-2">Backend Connection Failed</h2>
          <p className="text-muted max-w-md">Could not connect to the inventory REST API at localhost:8000. Please make sure uvicorn is running in the backend directory.</p>
        </div>
        <button onClick={fetchData} className="btn-primary">
          <RefreshCw size={16} /> Try Reconnecting
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { lowStock, nearExpiry } = getAlerts();
  const { standard: standardTransfers, overrides: overrideTransfers } = getTransferSuggestions();
  const currentBranchName = selectedStoreId 
    ? data.stores.find(s => s.id === selectedStoreId)?.name 
    : "All Branches";

  const filteredInventory = selectedStoreId
    ? data.inventory.filter(item => item.store_id === selectedStoreId)
    : data.inventory;

  return (
    <div className="dashboard-grid">
      {/* 1. Sidebar Rules configuration panel */}
      <aside className="border-r border-[#232733] bg-[#0c0d12] p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#c3b189]/10 p-2.5 rounded-xl border border-[#c3b189]/20">
            <Building2 className="text-gold" style={{ color: "#c3b189" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display leading-tight">Automatix</h1>
            <p className="text-muted text-xs">UAE Retail AI Squad</p>
          </div>
        </div>

        <div className="border-t border-[#1f232f] pt-4">
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-muted font-display">
            <Sliders size={14} style={{ color: "#c3b189" }} />
            <span>Operational Config</span>
          </div>

          <div className="flex flex-col gap-5">
            {/* Near Expiry Days */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-[#c4b38d]">Near-Expiry Threshold</span>
                <span className="font-bold text-white bg-[#191d29] px-2 py-0.5 rounded text-xs">
                  {data.rules.near_expiry_days_threshold} Days
                </span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={editRules?.near_expiry_days_threshold || "3"} 
                onChange={(e) => setEditRules(prev => prev ? { ...prev, near_expiry_days_threshold: e.target.value } : null)}
                onMouseUp={() => handleUpdateRule("near_expiry_days_threshold", editRules?.near_expiry_days_threshold || "3")}
                onTouchEnd={() => handleUpdateRule("near_expiry_days_threshold", editRules?.near_expiry_days_threshold || "3")}
                className="accent-gold w-full cursor-pointer h-1.5 rounded-lg bg-[#191d29]"
                style={{ accentColor: "#c3b189" }}
              />
              <span className="text-[10px] text-muted">Flag products expiring within this range.</span>
            </div>

            {/* Max Transfer Distance */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-[#c4b38d]">Max Transfer Radius</span>
                <span className="font-bold text-white bg-[#191d29] px-2 py-0.5 rounded text-xs">
                  {data.rules.max_transfer_distance_km} KM
                </span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="100" 
                step="5"
                value={editRules?.max_transfer_distance_km ? parseFloat(editRules.max_transfer_distance_km) : 35} 
                onChange={(e) => setEditRules(prev => prev ? { ...prev, max_transfer_distance_km: e.target.value } : null)}
                onMouseUp={() => handleUpdateRule("max_transfer_distance_km", editRules?.max_transfer_distance_km || "35.0")}
                onTouchEnd={() => handleUpdateRule("max_transfer_distance_km", editRules?.max_transfer_distance_km || "35.0")}
                className="accent-gold w-full cursor-pointer h-1.5 rounded-lg bg-[#191d29]"
                style={{ accentColor: "#c3b189" }}
              />
              <span className="text-[10px] text-muted">Max delivery distance for stock swaps.</span>
            </div>

            {/* Standard Multiplier */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-[#c4b38d]">Standard Reorder Mult.</span>
                <span className="font-bold text-white bg-[#191d29] px-2 py-0.5 rounded text-xs">
                  {data.rules.standard_reorder_multiplier}x
                </span>
              </div>
              <input 
                type="range" 
                min="1.0" 
                max="3.0" 
                step="0.1"
                value={editRules?.standard_reorder_multiplier ? parseFloat(editRules.standard_reorder_multiplier) : 1.2} 
                onChange={(e) => setEditRules(prev => prev ? { ...prev, standard_reorder_multiplier: e.target.value } : null)}
                onMouseUp={() => handleUpdateRule("standard_reorder_multiplier", editRules?.standard_reorder_multiplier || "1.2")}
                onTouchEnd={() => handleUpdateRule("standard_reorder_multiplier", editRules?.standard_reorder_multiplier || "1.2")}
                className="accent-gold w-full cursor-pointer h-1.5 rounded-lg bg-[#191d29]"
                style={{ accentColor: "#c3b189" }}
              />
            </div>

            {/* Ramadan Multiplier */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-[#c4b38d]">Ramadan Reorder Mult.</span>
                <span className="font-bold text-white bg-[#191d29] px-2 py-0.5 rounded text-xs">
                  {data.rules.ramadan_reorder_multiplier}x
                </span>
              </div>
              <input 
                type="range" 
                min="1.5" 
                max="5.0" 
                step="0.1"
                value={editRules?.ramadan_reorder_multiplier ? parseFloat(editRules.ramadan_reorder_multiplier) : 2.5} 
                onChange={(e) => setEditRules(prev => prev ? { ...prev, ramadan_reorder_multiplier: e.target.value } : null)}
                onMouseUp={() => handleUpdateRule("ramadan_reorder_multiplier", editRules?.ramadan_reorder_multiplier || "2.5")}
                onTouchEnd={() => handleUpdateRule("ramadan_reorder_multiplier", editRules?.ramadan_reorder_multiplier || "2.5")}
                className="accent-gold w-full cursor-pointer h-1.5 rounded-lg bg-[#191d29]"
                style={{ accentColor: "#c3b189" }}
              />
            </div>

            {/* Enable/Disable Transfers */}
            <div className="flex items-center justify-between border-t border-[#1f232f] pt-4 mt-2">
              <span className="text-sm font-medium text-[#c4b38d]">Inter-Branch Transfers</span>
              <button 
                onClick={() => {
                  const val = data.rules.allow_inter_branch_transfers === "1" ? "0" : "1";
                  handleUpdateRule("allow_inter_branch_transfers", val);
                  if (editRules) setEditRules({ ...editRules, allow_inter_branch_transfers: val });
                }}
                className={`badge cursor-pointer ${data.rules.allow_inter_branch_transfers === "1" ? "badge-green" : "badge-red"}`}
              >
                {data.rules.allow_inter_branch_transfers === "1" ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Board */}
      <main className="p-6 md:p-10 flex flex-col gap-8 overflow-y-auto bg-[#0b0c10]">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-white">Supermarket Ops Desk</h2>
            <p className="text-muted">Real-time alerts, stock level forecasts, and inter-branch swaps</p>
          </div>
          
          <div className="flex items-center gap-3 bg-[#13161e] p-1.5 rounded-xl border border-[#232733]">
            <button 
              onClick={() => setSelectedStoreId(null)}
              className={`px-4 py-2 rounded-lg font-display text-sm font-medium transition-all ${
                selectedStoreId === null 
                  ? "background-color: var(--accent-gold); color: #0b0c10; font-weight: 600;" 
                  : "text-muted hover:text-white"
              }`}
              style={selectedStoreId === null ? { backgroundColor: "#c3b189", color: "#0b0c10", fontWeight: 600 } : {}}
            >
              All UAE
            </button>
            {data.stores.map(store => (
              <button 
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
                className={`px-4 py-2 rounded-lg font-display text-sm font-medium transition-all ${
                  selectedStoreId === store.id 
                    ? "background-color: var(--accent-gold); color: #0b0c10; font-weight: 600;" 
                    : "text-muted hover:text-white"
                }`}
                style={selectedStoreId === store.id ? { backgroundColor: "#c3b189", color: "#0b0c10", fontWeight: 600 } : {}}
              >
                {store.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </header>

        {/* Stats Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Alerts */}
          <div className="glass-card p-6 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs uppercase tracking-wider font-display font-medium">Critical Stock Alerts</span>
              <span className="text-3xl font-extrabold text-white">{lowStock.length + nearExpiry.length}</span>
              <span className="text-xs text-muted">Across branches today</span>
            </div>
            <div className="bg-[#dd5e56]/10 p-4 rounded-full border border-[#dd5e56]/20">
              <AlertTriangle className="text-red animate-pulse" style={{ color: "#dd5e56" }} />
            </div>
          </div>

          {/* Feasible Transfers */}
          <div className="glass-card p-6 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs uppercase tracking-wider font-display font-medium">Feasible Transfers</span>
              <span className="text-3xl font-extrabold text-white">{standardTransfers.length}</span>
              <span className="text-xs text-muted">Ready to execute locally</span>
            </div>
            <div className="bg-[#1ba56b]/10 p-4 rounded-full border border-[#1ba56b]/20">
              <ArrowRightLeft className="text-green" style={{ color: "#1ba56b" }} />
            </div>
          </div>

          {/* Dynamic Override Options */}
          <div className="glass-card p-6 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs uppercase tracking-wider font-display font-medium">Override Options</span>
              <span className="text-3xl font-extrabold text-white">{overrideTransfers.length}</span>
              <span className="text-xs text-muted">Distance exceptions flagged</span>
            </div>
            <div className="bg-[#e69d30]/10 p-4 rounded-full border border-[#e69d30]/20">
              <TrendingUp className="text-amber" style={{ color: "#e69d30" }} />
            </div>
          </div>
        </section>

        {/* Central Inventory Table */}
        <section className="glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Package size={20} className="text-gold" style={{ color: "#c3b189" }} />
              <h3 className="text-lg font-bold font-display text-white">{currentBranchName} Inventory Audit</h3>
            </div>
            <button onClick={fetchData} className="btn-secondary text-xs py-1.5 px-3">
              <RefreshCw size={12} /> Sync SQLite
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  {selectedStoreId === null && <th>Branch</th>}
                  <th>Stock Level</th>
                  <th>Threshold</th>
                  <th>Expiry Date</th>
                  <th>Price (AED)</th>
                  <th>Audit Tags</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item, idx) => {
                  const isLow = item.stock_level <= item.reorder_threshold;
                  const isExp = isNearExpiry(item.expiry_date, parseInt(data.rules.near_expiry_days_threshold || "3"));
                  
                  return (
                    <tr key={idx}>
                      <td className="font-medium text-white">{item.product_name}</td>
                      <td><span className="text-muted text-xs">{item.category}</span></td>
                      {selectedStoreId === null && <td className="text-muted">{item.store_name}</td>}
                      <td>
                        <span className={`font-bold ${isLow ? "text-[#dd5e56]" : "text-white"}`}>
                          {item.stock_level}
                        </span>
                      </td>
                      <td className="text-muted">{item.reorder_threshold}</td>
                      <td>
                        <span className={`flex items-center gap-1.5 ${isExp ? "text-[#e69d30] font-medium" : "text-muted"}`}>
                          <Calendar size={13} />
                          {item.expiry_date}
                        </span>
                      </td>
                      <td className="font-semibold">{item.price_aed.toFixed(2)}</td>
                      <td>
                        <div className="flex gap-2">
                          {isLow && <span className="badge badge-red">Low Stock</span>}
                          {isExp && <span className="badge badge-amber">Near Expiry</span>}
                          {!isLow && !isExp && <span className="badge badge-green">Safe</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Action Center - Transfers & Overrides */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inter-Branch Transfer Suggestions */}
          <div className="glass-card p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRightLeft className="text-gold" style={{ color: "#c3b189" }} />
              <h3 className="text-lg font-bold font-display text-white">Suggested Inter-Branch Swaps</h3>
            </div>
            
            <p className="text-muted text-xs mb-4">
              Stock transfers suggested by matching Low Stock stores with branches holding excess. Final execution commits directly to SQLite.
            </p>

            {transferMessage && (
              <div className={`p-3 rounded-lg mb-4 text-xs font-medium border ${
                transferMessage.type === "success" 
                  ? "bg-green-bg text-green border-[#1ba56b]/20" 
                  : "bg-red-bg text-red border-[#dd5e56]/20"
              }`}
              style={transferMessage.type === "success" ? { backgroundColor: "rgba(27,165,107,0.1)", color: "#1ba56b" } : { backgroundColor: "rgba(221,94,86,0.1)", color: "#dd5e56" }}
              >
                {transferMessage.text}
              </div>
            )}

            <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[350px]">
              {standardTransfers.length === 0 && overrideTransfers.length === 0 && (
                <div className="text-center py-10 border border-dashed border-[#232733] rounded-xl text-muted text-xs">
                  No stock swaps currently required. All stores matching reorder thresholds.
                </div>
              )}

              {/* Standard suggestions */}
              {standardTransfers.map((swap, idx) => (
                <div key={idx} className="border border-[#232733] bg-[#191d29] p-4 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white">{swap.product_name}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                      <span className="text-[#1ba56b] font-medium">{swap.from_store_name.split(" ")[0]}</span>
                      <ChevronRight size={12} />
                      <span className="text-[#c3b189] font-medium">{swap.to_store_name.split(" ")[0]}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
                      <span className="flex items-center gap-1"><MapPin size={10} /> {swap.distance_km} KM</span>
                      <span className="font-semibold text-white">Qty: {swap.qty}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleExecuteTransfer(swap.from_store_id, swap.to_store_id, swap.product_id, swap.qty)}
                    className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                  >
                    Execute Swap
                  </button>
                </div>
              ))}

              {/* Dynamic distance override list */}
              {overrideTransfers.length > 0 && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-display mt-2">
                    Urgent Overrides (Exceeds distance limit of {data.rules.max_transfer_distance_km} KM)
                  </div>
                  {overrideTransfers.map((swap, idx) => (
                    <div key={idx} className="border border-dashed border-[#dd5e56]/30 bg-[#161314] p-4 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">{swap.product_name}</h4>
                          <span className="badge badge-amber text-[9px] px-1 py-0">Override</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                          <span className="text-[#e69d30] font-medium">{swap.from_store_name.split(" ")[0]}</span>
                          <ChevronRight size={12} />
                          <span className="text-[#dd5e56] font-medium">{swap.to_store_name.split(" ")[0]}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
                          <span className="flex items-center gap-1 text-[#dd5e56]"><MapPin size={10} /> {swap.distance_km} KM</span>
                          <span className="font-semibold text-white">Qty: {swap.qty}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleExecuteTransfer(swap.from_store_id, swap.to_store_id, swap.product_id, swap.qty)}
                        className="btn-secondary text-[#dd5e56] border-[#dd5e56]/30 hover:border-[#dd5e56] hover:bg-[#dd5e56]/10 text-xs py-1.5 px-3 whitespace-nowrap"
                      >
                        Override Swap
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* AI Operations Agent Audit terminal */}
          <div className="glass-card p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="text-gold" style={{ color: "#c3b189" }} />
              <h3 className="text-lg font-bold font-display text-white">Automatix Agent Audit</h3>
            </div>
            
            <p className="text-muted text-xs mb-4">
              Initiate the CrewAI multi-agent squad to execute DB schema scans, identify stocks, and compile the final Arabic Gulf trend replenishment forecasts.
            </p>

            <div className="flex flex-col gap-4 flex-1">
              <textarea 
                placeholder="Optional: Enter a specific operational focus (e.g. 'Prioritize Sharjah branch dates and water levels for Ramadan demand')" 
                value={customAuditQuery}
                onChange={(e) => setCustomAuditQuery(e.target.value)}
                className="form-input text-xs resize-none h-20"
              />

              <button 
                onClick={handleRunAudit}
                disabled={auditRunning}
                className="btn-primary w-full justify-center"
              >
                {auditRunning ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} /> Auditing Inventory...
                  </>
                ) : (
                  <>
                    <FileText size={16} /> Trigger AI Squad Audit
                  </>
                )}
              </button>

              <div className="terminal-screen text-xs mt-2">
                {auditLogs.length === 0 ? (
                  <span className="text-muted">[System Idle] Press trigger to launch CrewAI inventory agents...</span>
                ) : (
                  auditLogs.map((log, index) => {
                    const isSuccess = log.includes("[Success]");
                    const isError = log.includes("[Error]");
                    return (
                      <div key={index} className={`terminal-line ${
                        isSuccess ? "terminal-success" : isError ? "terminal-warning" : "terminal-info"
                      }`}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Rendered Agent Audit Report */}
        {auditReport && (
          <section className="glass-card p-8 border-[#c3b189]/40 bg-[#12141a]">
            <div className="flex items-center gap-2 mb-6 border-b border-[#232733] pb-4">
              <CheckCircle2 className="text-green" style={{ color: "#1ba56b" }} />
              <h3 className="text-xl font-bold font-display text-white">Generated Operations Dashboard</h3>
            </div>
            <div className="markdown-body text-sm">
              {renderMarkdown(auditReport)}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
