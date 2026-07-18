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
  const [transferMessage, setTransferMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Agent Audit states
  const [customAuditQuery, setCustomAuditQuery] = useState("");
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [auditReport, setAuditReport] = useState<string | null>(null);

  // NLP Command Center states
  const [activeConsoleTab, setActiveConsoleTab] = useState<"audit" | "command">("audit");
  const [commandText, setCommandText] = useState("");
  const [commandRunning, setCommandRunning] = useState(false);
  const [commandLogs, setCommandLogs] = useState<string[]>([]);
  const [commandResult, setCommandResult] = useState<string | null>(null);

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

  // Run AI Agent Command Center (Database Writes)
  const handleRunCommand = async () => {
    if (!commandText.trim()) return;
    try {
      setCommandRunning(true);
      setCommandResult(null);
      setCommandLogs([
        "[DB Specialist] Analyzing natural language instruction...",
        "[DB Specialist] Inspecting database schema columns...",
        "[DB Specialist] Formulating SQL write transactions..."
      ]);
      
      // Simulate terminal log timing
      const timer1 = setTimeout(() => {
        setCommandLogs(prev => [...prev, "[DB Specialist] Writing database modification queries (INSERT/UPDATE/DELETE)..."]);
      }, 2000);
      const timer2 = setTimeout(() => {
        setCommandLogs(prev => [...prev, "[DB Specialist] Executing queries and checking database locks..."]);
      }, 5000);
      const timer3 = setTimeout(() => {
        setCommandLogs(prev => [...prev, "[DB Specialist] Committing changes to SQLite database..."]);
      }, 8000);

      const res = await fetch("http://localhost:8000/api/run-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandText }),
      });
      
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Agent command execution failed.");
      
      setCommandLogs(prev => [...prev, "[Success] Database updated successfully and changes committed!"]);
      setCommandResult(json.result);
      setCommandText("");
      
      // Reload inventory values automatically on screen!
      fetchData();
    } catch (err: any) {
      setCommandLogs(prev => [...prev, `[Error] ${err.message}`]);
    } finally {
      setCommandRunning(false);
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
  const renderMarkdown = (text: any) => {
    if (!text) return null;
    const textStr = typeof text === "string"
      ? text
      : (text.raw && typeof text.raw === "string" ? text.raw : String(text));
    const lines = textStr.split("\n");
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
      <div className="flex flex-col items-center justify-center min-height-100vh h-screen gap-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={40} style={{ color: "#c3b189", animation: 'spin 1.5s linear infinite' }} />
        <p className="font-display font-medium" style={{ color: "#c3b189", fontFamily: 'var(--font-display)' }}>Loading multi-store dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-height-100vh h-screen gap-6 p-6 text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '24px', padding: '24px', textAlign: 'center' }}>
        <AlertOctagon size={60} style={{ color: "#dd5e56" }} />
        <div>
          <h2 className="text-2xl font-bold font-display mb-2" style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Backend Connection Failed</h2>
          <p className="text-muted max-w-md" style={{ color: '#8c96a8', maxWidth: '400px', fontSize: '0.9rem' }}>Could not connect to the inventory REST API at localhost:8000. Please make sure uvicorn is running in the backend directory.</p>
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
      
      {/* 1. Sidebar Rules configurator */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Building2 style={{ color: "#c3b189" }} size={22} />
          </div>
          <div className="brand-info">
            <h1 className="brand-name">Automatix</h1>
            <span className="brand-subtitle">Retail AI Squad</span>
          </div>
        </div>

        <div className="config-section">
          <div className="config-title">
            <Sliders size={14} style={{ color: "#c3b189" }} />
            <span>Operational Config</span>
          </div>

          <div className="config-list">
            
            {/* Near Expiry Days Slider */}
            <div className="config-group">
              <div className="config-header">
                <span className="config-label">Near-Expiry Threshold</span>
                <span className="config-value">{data.rules.near_expiry_days_threshold} Days</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={editRules?.near_expiry_days_threshold || "3"} 
                onChange={(e) => setEditRules(prev => prev ? { ...prev, near_expiry_days_threshold: e.target.value } : null)}
                onMouseUp={() => handleUpdateRule("near_expiry_days_threshold", editRules?.near_expiry_days_threshold || "3")}
                onTouchEnd={() => handleUpdateRule("near_expiry_days_threshold", editRules?.near_expiry_days_threshold || "3")}
                className="config-slider"
              />
              <span className="config-help">Flag products expiring within this range.</span>
            </div>

            {/* Max Distance Slider */}
            <div className="config-group">
              <div className="config-header">
                <span className="config-label">Max Transfer Radius</span>
                <span className="config-value">{data.rules.max_transfer_distance_km} KM</span>
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
                className="config-slider"
              />
              <span className="config-help">Max delivery distance for stock swaps.</span>
            </div>

            {/* Standard Multiplier Slider */}
            <div className="config-group">
              <div className="config-header">
                <span className="config-label">Standard Reorder Mult.</span>
                <span className="config-value">{data.rules.standard_reorder_multiplier}x</span>
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
                className="config-slider"
              />
              <span className="config-help">Restock multiplication factor.</span>
            </div>

            {/* Ramadan Multiplier Slider */}
            <div className="config-group">
              <div className="config-header">
                <span className="config-label">Ramadan Reorder Mult.</span>
                <span className="config-value">{data.rules.ramadan_reorder_multiplier}x</span>
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
                className="config-slider"
              />
              <span className="config-help">Multiplication factor for Ramadan season.</span>
            </div>

            {/* Enable/Disable Swaps */}
            <div className="config-toggle">
              <span className="config-label">Inter-Branch Transfers</span>
              <button 
                onClick={() => {
                  const val = data.rules.allow_inter_branch_transfers === "1" ? "0" : "1";
                  handleUpdateRule("allow_inter_branch_transfers", val);
                  if (editRules) setEditRules({ ...editRules, allow_inter_branch_transfers: val });
                }}
                className={`badge ${data.rules.allow_inter_branch_transfers === "1" ? "badge-green" : "badge-red"}`}
                style={{ cursor: 'pointer' }}
              >
                {data.rules.allow_inter_branch_transfers === "1" ? "Enabled" : "Disabled"}
              </button>
            </div>

          </div>
        </div>
      </aside>

      {/* 2. Main Content panel */}
      <main className="main-content">
        
        {/* Main Header */}
        <header className="main-header">
          <div className="header-title">
            <h2>Supermarket Ops Desk</h2>
            <p>Real-time alerts, stock level forecasts, and inter-branch swaps</p>
          </div>
          
          <div className="filter-bar">
            <button 
              onClick={() => setSelectedStoreId(null)}
              className={`filter-btn ${selectedStoreId === null ? "active" : ""}`}
            >
              All Branches
            </button>
            {data.stores.map(store => (
              <button 
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
                className={`filter-btn ${selectedStoreId === store.id ? "active" : ""}`}
              >
                {store.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </header>

        {/* Stats Grid */}
        <section className="stats-grid">
          {/* Stat Card: Alerts */}
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Critical Stock Alerts</span>
              <span className="stat-number">{lowStock.length + nearExpiry.length}</span>
              <span className="stat-help">Across branches today</span>
            </div>
            <div className="stat-icon red">
              <AlertTriangle size={22} />
            </div>
          </div>

          {/* Stat Card: Standard Swaps */}
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Feasible Transfers</span>
              <span className="stat-number">{standardTransfers.length}</span>
              <span className="stat-help">Ready to execute locally</span>
            </div>
            <div className="stat-icon green">
              <ArrowRightLeft size={22} />
            </div>
          </div>

          {/* Stat Card: Overrides */}
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Override Options</span>
              <span className="stat-number">{overrideTransfers.length}</span>
              <span className="stat-help">Distance exceptions flagged</span>
            </div>
            <div className="stat-icon amber">
              <TrendingUp size={22} />
            </div>
          </div>
        </section>

        {/* Inventory Table Section */}
        <section className="table-card">
          <div className="table-header">
            <div className="table-title">
              <Package size={20} style={{ color: "#c3b189" }} />
              <h3>{currentBranchName} Inventory Audit</h3>
            </div>
            <button onClick={fetchData} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={12} /> Sync SQLite
            </button>
          </div>

          <div className="overflow-x-auto" style={{ overflowX: 'auto' }}>
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
                      <td className="font-medium" style={{ color: '#ffffff', fontWeight: 500 }}>{item.product_name}</td>
                      <td><span className="text-muted" style={{ fontSize: '0.78rem' }}>{item.category}</span></td>
                      {selectedStoreId === null && <td className="text-muted" style={{ fontSize: '0.85rem' }}>{item.store_name}</td>}
                      <td>
                        <span style={isLow ? { color: '#dd5e56', fontWeight: 700 } : { color: '#ffffff', fontWeight: 500 }}>
                          {item.stock_level}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>{item.reorder_threshold}</td>
                      <td>
                        <span style={isExp ? { color: '#e69d30', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' } : { color: '#8c96a8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <Calendar size={13} />
                          {item.expiry_date}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.price_aed.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
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

        {/* Action Swaps and Agent Audit Section */}
        <section className="actions-grid">
          
          {/* Stock Swaps Panel */}
          <div className="action-card">
            <div className="action-header">
              <ArrowRightLeft size={18} style={{ color: "#c3b189" }} />
              <h3>Suggested Inter-Branch Swaps</h3>
            </div>
            <p className="action-desc">
              Stock transfers suggested by matching Low Stock stores with branches holding excess. Final execution commits directly to SQLite.
            </p>

            {transferMessage && (
              <div className={`alert-message ${transferMessage.type === "success" ? "success" : "error"}`}>
                {transferMessage.text}
              </div>
            )}

            <div className="swap-list">
              {standardTransfers.length === 0 && overrideTransfers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed #232733', borderRadius: '12px', color: '#8c96a8', fontSize: '0.8rem' }}>
                  No stock swaps currently required. All stores matching reorder thresholds.
                </div>
              )}

              {/* Standard feasible transfers */}
              {standardTransfers.map((swap, idx) => (
                <div key={idx} className="swap-item">
                  <div className="swap-info">
                    <h4 className="swap-product">{swap.product_name}</h4>
                    <div className="swap-path">
                      <span className="swap-source">{swap.from_store_name.split(" ")[0]}</span>
                      <ChevronRight size={12} />
                      <span className="swap-dest">{swap.to_store_name.split(" ")[0]}</span>
                    </div>
                    <div className="swap-meta">
                      <span className="swap-distance"><MapPin size={10} /> {swap.distance_km} KM</span>
                      <span>Qty: <strong className="swap-qty">{swap.qty}</strong></span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleExecuteTransfer(swap.from_store_id, swap.to_store_id, swap.product_id, swap.qty)}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    Swap Stock
                  </button>
                </div>
              ))}

              {/* Overrides Transfers */}
              {overrideTransfers.length > 0 && (
                <>
                  <div className="swap-section-title">
                    Urgent Overrides (Exceeds distance limit of {data.rules.max_transfer_distance_km} KM)
                  </div>
                  {overrideTransfers.map((swap, idx) => (
                    <div key={idx} className="swap-item override">
                      <div className="swap-info">
                        <div className="swap-title-row">
                          <h4 className="swap-product">{swap.product_name}</h4>
                          <span className="badge badge-amber" style={{ fontSize: '9px', padding: '2px 6px' }}>Override</span>
                        </div>
                        <div className="swap-path">
                          <span className="swap-source" style={{ color: '#e69d30' }}>{swap.from_store_name.split(" ")[0]}</span>
                          <ChevronRight size={12} />
                          <span className="swap-dest override">{swap.to_store_name.split(" ")[0]}</span>
                        </div>
                        <div className="swap-meta">
                          <span className="swap-distance override"><MapPin size={10} /> {swap.distance_km} KM</span>
                          <span>Qty: <strong className="swap-qty">{swap.qty}</strong></span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleExecuteTransfer(swap.from_store_id, swap.to_store_id, swap.product_id, swap.qty)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#dd5e56', borderColor: 'rgba(221, 94, 86, 0.3)' }}
                      >
                        Override Swap
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* CrewAI Agent Audit & Command Panel */}
          <div className="action-card">
            <div className="action-header" style={{ marginBottom: '16px' }}>
              <Terminal size={18} style={{ color: "#c3b189" }} />
              <h3>Automatix Agent Console</h3>
            </div>
            
            <div className="console-tabs">
              <button 
                onClick={() => setActiveConsoleTab("audit")}
                className={`console-tab-btn ${activeConsoleTab === "audit" ? "active" : ""}`}
              >
                Audit Squad
              </button>
              <button 
                onClick={() => setActiveConsoleTab("command")}
                className={`console-tab-btn ${activeConsoleTab === "command" ? "active" : ""}`}
              >
                Command Center (Writes)
              </button>
            </div>

            {activeConsoleTab === "audit" ? (
              <>
                <p className="action-desc">
                  Initiate the CrewAI multi-agent squad to execute DB schema scans, identify stocks, and compile the final Arabic Gulf trend replenishment forecasts.
                </p>

                <div className="audit-form">
                  <textarea 
                    placeholder="Optional: Enter a specific operational focus (e.g. 'Prioritize Sharjah branch dates and water levels for Ramadan demand')" 
                    value={customAuditQuery}
                    onChange={(e) => setCustomAuditQuery(e.target.value)}
                    className="audit-textarea"
                  />

                  <button 
                    onClick={handleRunAudit}
                    disabled={auditRunning}
                    className="btn-primary"
                    style={{ justifyContent: 'center', width: '100%' }}
                  >
                    {auditRunning ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> Auditing Inventory...
                      </>
                    ) : (
                      <>
                        <FileText size={16} /> Trigger AI Squad Audit
                      </>
                    )}
                  </button>

                  <div className="terminal-screen">
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
              </>
            ) : (
              <>
                <p className="action-desc">
                  Issue natural language database instructions (e.g. adding products, removing items, adjusting configs). Commands commit updates directly to SQLite.
                </p>

                <div className="audit-form">
                  <textarea 
                    placeholder="Type database command (e.g. 'Add a new product Al Ain Juice 1L, category Beverages, price 6 AED. Set stock level to 50 in Sharjah Al Nahda and threshold to 15.')" 
                    value={commandText}
                    onChange={(e) => setCommandText(e.target.value)}
                    className="audit-textarea"
                  />

                  <button 
                    onClick={handleRunCommand}
                    disabled={commandRunning}
                    className="btn-primary"
                    style={{ justifyContent: 'center', width: '100%' }}
                  >
                    {commandRunning ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> Executing Command...
                      </>
                    ) : (
                      <>
                        <Terminal size={16} /> Execute Agent Command
                      </>
                    )}
                  </button>

                  <div className="terminal-screen">
                    {commandLogs.length === 0 ? (
                      <span className="text-muted">[System Idle] Enter command and press execute to launch DB Administrator agent...</span>
                    ) : (
                      commandLogs.map((log, index) => {
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
              </>
            )}
          </div>

        </section>

        {/* 3. Rendered Agent Reports */}
        {activeConsoleTab === "audit" && auditReport && (
          <section className="report-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #232733', paddingBottom: '16px' }}>
              <CheckCircle2 style={{ color: '#1ba56b' }} size={20} />
              <h3 className="text-xl font-bold font-display text-white" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', color: '#ffffff' }}>Generated Operations Dashboard</h3>
            </div>
            <div className="markdown-body">
              {renderMarkdown(auditReport)}
            </div>
          </section>
        )}

        {activeConsoleTab === "command" && commandResult && (
          <section className="report-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #232733', paddingBottom: '16px' }}>
              <CheckCircle2 style={{ color: '#1ba56b' }} size={20} />
              <h3 className="text-xl font-bold font-display text-white" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', color: '#ffffff' }}>Command Execution Summary</h3>
            </div>
            <div className="markdown-body">
              {renderMarkdown(commandResult)}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
