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
  ChevronRight,
  Edit2,
  Trash2,
  Plus,
  X,
  Check,
  Bell,
  MessageSquare,
  Phone,
  Send,
  FileSpreadsheet
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
  sender_whatsapp?: string;
  receiver_whatsapp?: string;
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

  // Manual Inventory CRUD states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null); // "storeId-productId"
  const [editForm, setEditForm] = useState<{
    stock_level: number;
    reorder_threshold: number;
    expiry_date: string;
  } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    product_name: "",
    category: "",
    price_aed: "",
    store_id: "",
    stock_level: "",
    reorder_threshold: "",
    expiry_date: "2026-07-20"
  });

  const [crudError, setCrudError] = useState<string | null>(null);
  const [crudSuccess, setCrudSuccess] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);

  // Purchase Order Modal states
  const [showPoModal, setShowPoModal] = useState(false);
  const [poDraftItem, setPoDraftItem] = useState<{
    store_id: number;
    store_name: string;
    product_id: number;
    product_name: string;
    category: string;
    price_aed: number;
    stock_level: number;
    reorder_threshold: number;
    suggested_qty: number;
  } | null>(null);
  const [poQty, setPoQty] = useState<number>(10);
  const [poLoading, setPoLoading] = useState(false);
  const [customWaMessage, setCustomWaMessage] = useState<string>("");

  // Helper to open PO Modal with default clean WhatsApp message draft
  const openPoModalForItem = (item: any, qty: number) => {
    const storeName = item.store_name || item.to_store_name || "Branch";
    const poRef = `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
    setPoDraftItem({
      store_id: item.store_id || item.to_store_id,
      store_name: storeName,
      product_id: item.product_id,
      product_name: item.product_name,
      category: item.category || "General",
      price_aed: 0,
      stock_level: item.stock_level || 0,
      reorder_threshold: item.reorder_threshold || qty,
      suggested_qty: qty
    });
    setPoQty(qty);
    setCustomWaMessage(
      `*AUTOMATIX OFFICIAL PURCHASE ORDER*\n` +
      `PO Ref: #${poRef}\n` +
      `Destination: ${storeName}\n` +
      `Product: ${item.product_name}\n` +
      `Category: ${item.category || "General"}\n` +
      `Order Qty: ${qty} units\n\n` +
      `Please confirm order dispatch and estimated delivery time.`
    );
    setShowPoModal(true);
  };

  // Auth / Login states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<"HQ" | "Dubai" | "Downtown" | "Sharjah">("HQ");
  const [loginBranch, setLoginBranch] = useState<string>("HQ");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: loginBranch, password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Invalid credentials.");
      
      setUserRole(json.role as "HQ" | "Dubai" | "Downtown" | "Sharjah");
      setSelectedStoreId(json.store_id);
      setIsLoggedIn(true);
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(err.message || "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole("HQ");
    setSelectedStoreId(null);
    setLoginPassword("");
    setLoginError(null);
  };

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
      fetchTransfers();
      fetchPurchaseOrders();
    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  // Load active watchdog alerts from SQLite
  const fetchAlerts = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts.");
      const json = await res.json();
      setAlerts(json.alerts || []);
    } catch (err: any) {
      console.error("Alerts fetch error:", err.message);
    }
  };

  // Load active transfer requests from SQLite
  const fetchTransfers = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/transfers");
      if (!res.ok) throw new Error("Failed to fetch transfer requests.");
      const json = await res.json();
      setTransfers(json.transfers || []);
    } catch (err: any) {
      console.error("Transfers fetch error:", err.message);
    }
  };

  // Load active purchase orders from SQLite
  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/purchase-orders");
      if (!res.ok) throw new Error("Failed to fetch purchase orders.");
      const json = await res.json();
      setPurchaseOrders(json.orders || []);
    } catch (err: any) {
      console.error("PO fetch error:", err.message);
    }
  };

  // Create & Dispatch Purchase Order via WhatsApp
  const handleCreatePO = async () => {
    if (!poDraftItem || !data) return;
    try {
      setPoLoading(true);
      const senderPhone = editRules?.sender_whatsapp || data.rules.sender_whatsapp || "+971501234567";
      const receiverPhone = editRules?.receiver_whatsapp || data.rules.receiver_whatsapp || "+971509876543";

      const res = await fetch("http://localhost:8000/api/purchase-orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: poDraftItem.store_id,
          product_id: poDraftItem.product_id,
          quantity: poQty,
          unit_price_aed: 0.0,
          total_cost_aed: 0.0,
          sender_phone: senderPhone,
          receiver_phone: receiverPhone
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to log Purchase Order.");

      // Formatted WhatsApp Restock Message using custom edited message from textarea
      const finalMessage = customWaMessage || (
        `*AUTOMATIX OFFICIAL PURCHASE ORDER*\n` +
        `PO Ref: #${json.po_number || 'PO-2026'}\n` +
        `Destination: ${poDraftItem.store_name}\n` +
        `Product: ${poDraftItem.product_name}\n` +
        `Category: ${poDraftItem.category}\n` +
        `Order Qty: ${poQty} units\n\n` +
        `Please confirm order dispatch and estimated delivery time.`
      );

      // Open WhatsApp web / API in new tab
      const cleanPhone = receiverPhone.replace(/[^0-9+]/g, '');
      const waUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(finalMessage)}`;
      window.open(waUrl, "_blank");

      setShowPoModal(false);
      setPoDraftItem(null);
      setCrudSuccess(`Draft PO ${json.po_number} logged successfully and sent to WhatsApp!`);
      fetchPurchaseOrders();
    } catch (err: any) {
      alert("PO Error: " + err.message);
    } finally {
      setPoLoading(false);
    }
  };

  // Mark Purchase Order as Received (Commit stock to SQLite)
  const handleReceivePO = async (poId: number) => {
    try {
      const res = await fetch("http://localhost:8000/api/purchase-orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: poId, status: "Received" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to update PO status.");

      setCrudSuccess("Stock shipment received! SQLite inventory updated.");
      fetchData();
      fetchPurchaseOrders();
      fetchAlerts();
    } catch (err: any) {
      setCrudError("PO Receive Error: " + err.message);
    }
  };

  // Dismiss an active alert
  const handleDismissAlert = async (alertId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/alerts/dismiss/${alertId}`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to dismiss alert.");
      
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err: any) {
      console.error("Dismiss alert error:", err.message);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAlerts();
    fetchTransfers();
    fetchPurchaseOrders();

    const interval = setInterval(() => {
      fetchAlerts();
      fetchTransfers();
      fetchPurchaseOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Reset notification messages when switching active branch view
  useEffect(() => {
    setTransferMessage(null);
    setCrudSuccess(null);
    setCrudError(null);
  }, [userRole, selectedStoreId]);

  // Auto-dismiss notice messages after 4 seconds
  useEffect(() => {
    if (transferMessage || crudSuccess || crudError) {
      const timer = setTimeout(() => {
        setTransferMessage(null);
        setCrudSuccess(null);
        setCrudError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [transferMessage?.text, crudSuccess, crudError]);

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

  // Run stock transfer (Creates a Pending request in SQLite)
  const handleExecuteTransfer = async (fromId: number, toId: number, pId: number, qty: number) => {
    try {
      setTransferMessage(null);
      const res = await fetch("http://localhost:8000/api/transfers/create", {
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
      if (!res.ok) throw new Error(json.detail || "Transfer request creation failed.");
      
      setTransferMessage({ type: "success", text: "Inter-branch transfer request logged successfully (Status: Pending)." });
      fetchData(); // Sync logs and counts
    } catch (err: any) {
      setTransferMessage({ type: "error", text: err.message });
    }
  };

  // Update status of a transfer request (Ship / Complete / Cancel)
  const handleUpdateTransferStatus = async (requestId: number, newStatus: string) => {
    try {
      setTransferMessage(null);
      const res = await fetch("http://localhost:8000/api/transfers/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          status: newStatus
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to update transfer status.");

      setTransferMessage({ type: "success", text: `Transfer status successfully updated to: ${newStatus}` });
      fetchData(); // Reload inventory lists and request streams
    } catch (err: any) {
      setTransferMessage({ type: "error", text: err.message || "Status update failed." });
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

  // Start inline editing of a row
  const handleStartEdit = (item: InventoryItem) => {
    setEditingKey(`${item.store_id}-${item.product_id}`);
    setEditForm({
      stock_level: item.stock_level,
      reorder_threshold: item.reorder_threshold,
      expiry_date: item.expiry_date
    });
    setCrudError(null);
    setCrudSuccess(null);
  };

  // Cancel inline editing
  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditForm(null);
  };

  // Save inline editing changes
  const handleSaveEdit = async (storeId: number, productId: number) => {
    if (!editForm) return;
    try {
      setCrudError(null);
      setCrudSuccess(null);
      const res = await fetch("http://localhost:8000/api/inventory/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          product_id: productId,
          stock_level: editForm.stock_level,
          reorder_threshold: editForm.reorder_threshold,
          expiry_date: editForm.expiry_date
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to update inventory.");

      setCrudSuccess("Inventory row updated successfully!");
      setEditingKey(null);
      setEditForm(null);
      fetchData(); // Sync display values
    } catch (err: any) {
      setCrudError(err.message || "An error occurred.");
    }
  };

  // Delete an item from branch inventory
  const handleDeleteInventory = async (storeId: number, productId: number) => {
    if (!window.confirm("Are you sure you want to remove this product from this branch inventory?")) return;
    try {
      setCrudError(null);
      setCrudSuccess(null);
      const res = await fetch("http://localhost:8000/api/inventory/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          product_id: productId
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to delete inventory item.");

      setCrudSuccess("Product removed from branch inventory.");
      fetchData(); // Sync display values
    } catch (err: any) {
      setCrudError(err.message || "An error occurred.");
    }
  };

  // Add a product to store inventory manually
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newProductForm.product_name ||
      !newProductForm.category ||
      !newProductForm.price_aed ||
      !newProductForm.store_id ||
      !newProductForm.stock_level ||
      !newProductForm.reorder_threshold ||
      !newProductForm.expiry_date
    ) {
      setCrudError("Please fill out all fields.");
      return;
    }

    try {
      setCrudError(null);
      setCrudSuccess(null);
      const res = await fetch("http://localhost:8000/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: newProductForm.product_name,
          category: newProductForm.category,
          price_aed: parseFloat(newProductForm.price_aed),
          store_id: parseInt(newProductForm.store_id),
          stock_level: parseInt(newProductForm.stock_level),
          reorder_threshold: parseInt(newProductForm.reorder_threshold),
          expiry_date: newProductForm.expiry_date
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to add product to inventory.");

      setCrudSuccess("Product successfully added to inventory!");
      setShowAddModal(false);
      setNewProductForm({
        product_name: "",
        category: "",
        price_aed: "",
        store_id: "",
        stock_level: "",
        reorder_threshold: "",
        expiry_date: "2026-07-20"
      });
      fetchData(); // Sync display values
    } catch (err: any) {
      setCrudError(err.message || "An error occurred.");
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
    
    const lowStock = data.inventory.filter(item => item.stock_level < item.reorder_threshold);
    const nearExpiry = data.inventory.filter(item => isNearExpiry(item.expiry_date, nearExpiryDays));
    
    return { lowStock, nearExpiry };
  };

  // Generate inter-branch transfer suggestions based on excess stock in database
  const getTransferSuggestions = () => {
    if (!data) return [];
    const transfersEnabled = data.rules.allow_inter_branch_transfers === "1";
    
    if (!transfersEnabled) return [];
    
    const { lowStock } = getAlerts();
    const suggestions: Array<{
      product_id: number;
      product_name: string;
      from_store_id: number;
      from_store_name: string;
      to_store_id: number;
      to_store_name: string;
      qty: number;
      price_aed: number;
      category: string;
    }> = [];
    
    lowStock.forEach(item => {
      // Find other branches that have excess stock of this product
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
          suggestions.push({
            product_id: item.product_id,
            product_name: item.product_name,
            from_store_id: source.store_id,
            from_store_name: source.store_name,
            to_store_id: item.store_id,
            to_store_name: item.store_name,
            qty: transferQty,
            price_aed: item.price_aed,
            category: item.category
          });
        }
      });
    });
    
    return suggestions;
  };

  // Login Screen Gate
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-backdrop"></div>
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(195, 177, 137, 0.1)', border: '1px solid rgba(195, 177, 137, 0.2)' }}>
              <Building2 style={{ color: "#c3b189" }} size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: '#ffffff', margin: 0 }}>Automatix</h1>
              <span style={{ fontSize: '0.72rem', color: '#8c96a8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inventory Management System</span>
            </div>
          </div>
          
          <div className="login-divider"></div>
          
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: '0 0 4px 0' }}>Branch Login</h2>
          <p style={{ fontSize: '0.82rem', color: '#8c96a8', margin: '0 0 24px 0' }}>Enter your branch credentials to access the operations dashboard.</p>
          
          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label className="login-label">Branch</label>
              <select 
                value={loginBranch} 
                onChange={(e) => setLoginBranch(e.target.value)}
                className="login-input"
              >
                <option value="HQ">HQ Operations Manager</option>
                <option value="Dubai">Dubai Marina Branch</option>
                <option value="Downtown">Downtown Dubai Branch</option>
                <option value="Sharjah">Sharjah Al Nahda Branch</option>
              </select>
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter branch password"
                className="login-input"
                required
              />
            </div>
            
            {loginError && (
              <div className="login-error">
                <AlertOctagon size={14} />
                {loginError}
              </div>
            )}
            
            <button type="submit" className="login-submit-btn" disabled={loginLoading}>
              {loginLoading ? (
                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Authenticating...</>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
          
          <p style={{ fontSize: '0.72rem', color: '#555b6e', textAlign: 'center', marginTop: '20px' }}>
            Access restricted to authorized branch personnel only.
          </p>
        </div>
      </div>
    );
  }

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
  const allSuggestions = getTransferSuggestions();

  // Exclude transfers that have already been initiated (in Pending or Sent status)
  const activeTransferKeys = new Set(
    transfers
      .filter(t => t.status === 'Pending' || t.status === 'Sent')
      .map(t => `${t.from_store_id}-${t.to_store_id}-${t.product_id}`)
  );

  const availableSuggestions = allSuggestions.filter(s => 
    !activeTransferKeys.has(`${s.from_store_id}-${s.to_store_id}-${s.product_id}`)
  );

  // Role-based filtering: branches only see suggestions where THEY are in deficit (destination)
  const roleFilteredSwaps = userRole === 'HQ'
    ? availableSuggestions
    : availableSuggestions.filter(s => s.to_store_id === selectedStoreId);

  // Role-based filtering for Purchase Orders
  const roleFilteredPurchaseOrders = purchaseOrders.filter(po => 
    userRole === 'HQ' || po.store_id === selectedStoreId
  );

  const incomingTransfers = transfers.filter(t => 
    (userRole === 'HQ' || t.to_store_id === selectedStoreId) && t.status === 'Sent'
  );

  const outgoingTransfers = transfers.filter(t => 
    (userRole === 'HQ' || t.from_store_id === selectedStoreId) && t.status === 'Pending'
  );

  const completedTransfers = transfers.filter(t => 
    (userRole === 'HQ' || t.from_store_id === selectedStoreId || t.to_store_id === selectedStoreId) && 
    (t.status === 'Completed' || t.status === 'Cancelled')
  );

  const roleFilteredAlerts = alerts.filter(a => 
    userRole === 'HQ' || a.store_id === selectedStoreId
  );

  const currentBranchName = selectedStoreId 
    ? data.stores.find(s => s.id === selectedStoreId)?.name 
    : "All Branches";

  const filteredInventory = selectedStoreId
    ? data.inventory.filter(item => item.store_id === selectedStoreId)
    : data.inventory;

  return (
    <div className="dashboard-grid full-width-layout">
      
      {/* Main Content panel */}
      <main className="main-content" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Main Header Navbar */}
        <header className="main-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="brand-icon" style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(195, 177, 137, 0.1)', border: '1px solid rgba(195, 177, 137, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 style={{ color: "#c3b189" }} size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Automatix</h2>
              <span style={{ fontSize: '0.72rem', color: '#8c96a8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supermarket Ops Desk</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Notification Bell Button & Dropdown */}
            <div className="notification-bell-container" style={{ position: 'relative' }}>
              <button 
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setConfigDrawerOpen(false);
                }}
                className="notification-bell-btn"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  background: '#191d29',
                  border: '1px solid #232733',
                  color: notificationsOpen ? '#c3b189' : '#8c96a8',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Watchdog Notifications"
              >
                <Bell size={18} />
                {roleFilteredAlerts.length > 0 && (
                  <span className="bell-badge animate-pulse" style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#dd5e56',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '2px 6px',
                    minWidth: '18px',
                    textAlign: 'center',
                    boxShadow: '0 0 10px rgba(221, 94, 86, 0.6)'
                  }}>
                    {roleFilteredAlerts.length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notificationsOpen && (
                <div className="notifications-dropdown-menu" style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  background: '#12141a',
                  border: '1px solid rgba(195, 177, 137, 0.25)',
                  borderRadius: '12px',
                  width: '380px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #232733',
                    background: 'rgba(255,255,255,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertOctagon size={16} style={{ color: '#dd5e56' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                        Watchdog Alerts ({roleFilteredAlerts.length})
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: '320px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {roleFilteredAlerts.length === 0 ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: '#8c96a8', fontSize: '0.8rem' }}>
                        No active stock alerts.
                      </div>
                    ) : (
                      roleFilteredAlerts.map(alert => (
                        <div key={alert.id} className="alerts-banner-item" style={{ margin: 0 }}>
                          <div className="alerts-banner-text" style={{ fontSize: '0.78rem' }}>
                            <span className={`alert-indicator ${alert.alert_type}`}></span>
                            <p style={{ margin: 0 }}>{alert.message}</p>
                          </div>
                          <button 
                            onClick={() => handleDismissAlert(alert.id)}
                            className="dismiss-alert-btn"
                            style={{ fontSize: '0.7rem' }}
                          >
                            Dismiss
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Operational Config Button & Popover Drawer */}
            <div className="config-drawer-container" style={{ position: 'relative' }}>
              <button 
                onClick={() => {
                  setConfigDrawerOpen(!configDrawerOpen);
                  setNotificationsOpen(false);
                }}
                className="notification-bell-btn"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  background: '#191d29',
                  border: '1px solid #232733',
                  color: configDrawerOpen ? '#c3b189' : '#8c96a8',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Operational Configuration"
              >
                <Sliders size={18} />
              </button>

              {/* Config Popover Drawer Panel */}
              {configDrawerOpen && (
                <div className="config-popover-menu" style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  background: '#12141a',
                  border: '1px solid rgba(195, 177, 137, 0.25)',
                  borderRadius: '12px',
                  width: '380px',
                  padding: '20px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #232733', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} style={{ color: '#c3b189' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>Operational Config</span>
                    </div>
                    <button 
                      onClick={() => setConfigDrawerOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: '#8c96a8', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* WhatsApp Phone Number Configuration */}
                  <div className="config-group">
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#c3b189', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sender WhatsApp (Manager Phone)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <input 
                        type="text"
                        className="login-input"
                        value={editRules?.sender_whatsapp || "+971501234567"}
                        onChange={(e) => setEditRules(prev => prev ? { ...prev, sender_whatsapp: e.target.value } : null)}
                        placeholder="+971501234567"
                        style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                      />
                      <button 
                        onClick={() => handleUpdateRule("sender_whatsapp" as any, editRules?.sender_whatsapp || "+971501234567")}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="config-group">
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#c3b189', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Receiver WhatsApp (Supplier Phone)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <input 
                        type="text"
                        className="login-input"
                        value={editRules?.receiver_whatsapp || "+971509876543"}
                        onChange={(e) => setEditRules(prev => prev ? { ...prev, receiver_whatsapp: e.target.value } : null)}
                        placeholder="+971509876543"
                        style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                      />
                      <button 
                        onClick={() => handleUpdateRule("receiver_whatsapp" as any, editRules?.receiver_whatsapp || "+971509876543")}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>

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
              )}
            </div>

            {/* Authenticated Role Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#191d29', border: '1px solid #232733', borderRadius: '8px', padding: '8px 16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#c3b189', color: '#0b0d13', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.82rem' }}>
                {userRole === 'HQ' ? 'HQ' : userRole[0]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', color: '#8c96a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logged In</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>
                  {userRole === 'HQ' ? 'HQ Operations Manager' : `${currentBranchName} Manager`}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                style={{ background: 'transparent', border: '1px solid rgba(221, 94, 86, 0.3)', color: '#dd5e56', fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', marginLeft: '8px', transition: 'all 0.2s ease' }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {/* Stat Card: Alerts */}
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Critical Stock Alerts</span>
              <span className="stat-number">{lowStock.length}</span>
              <span className="stat-help">Low stock items requiring restock</span>
            </div>
            <div className="stat-icon red">
              <AlertTriangle size={22} />
            </div>
          </div>

          {/* Stat Card: Swaps */}
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Inter-Branch Swap Options</span>
              <span className="stat-number">{roleFilteredSwaps.length}</span>
              <span className="stat-help">Excess stock transfers available</span>
            </div>
            <div className="stat-icon green">
              <ArrowRightLeft size={22} />
            </div>
          </div>

          {/* Stat Card: Supplier POs */}
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Pending Supplier POs</span>
              <span className="stat-number">{roleFilteredPurchaseOrders.filter(po => po.status === 'Pending').length}</span>
              <span className="stat-help">Awaiting WhatsApp shipment delivery</span>
            </div>
            <div className="stat-icon amber">
              <MessageSquare size={22} />
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
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setEditingKey(null);
                }}
                className={`btn-secondary ${isEditMode ? "active-manage" : ""}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Settings2 size={12} /> {isEditMode ? "Exit Edit Mode" : "Manage Inventory"}
              </button>
              {isEditMode && (
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> Add Product
                </button>
              )}
              <button onClick={fetchData} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                <RefreshCw size={12} /> Sync SQLite
              </button>
            </div>
          </div>

          {crudError && (
            <div className="alert-message error" style={{ margin: '12px 24px' }}>
              {crudError}
            </div>
          )}
          {crudSuccess && (
            <div className="alert-message success" style={{ margin: '12px 24px' }}>
              {crudSuccess}
            </div>
          )}

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
                  {isEditMode && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item, idx) => {
                  const key = `${item.store_id}-${item.product_id}`;
                  const isEditing = editingKey === key;
                  const isLow = item.stock_level < item.reorder_threshold;
                  const isExp = isNearExpiry(item.expiry_date, parseInt(data.rules.near_expiry_days_threshold || "3"));
                  
                  return (
                    <tr key={idx}>
                      <td className="font-medium" style={{ color: '#ffffff', fontWeight: 500 }}>{item.product_name}</td>
                      <td><span className="text-muted" style={{ fontSize: '0.78rem' }}>{item.category}</span></td>
                      {selectedStoreId === null && <td className="text-muted" style={{ fontSize: '0.85rem' }}>{item.store_name}</td>}
                      
                      {/* Stock level cell */}
                      <td>
                        {isEditing ? (
                          <input 
                            type="number"
                            className="crud-input"
                            value={editForm?.stock_level ?? 0}
                            onChange={e => setEditForm(prev => prev ? { ...prev, stock_level: parseInt(e.target.value) || 0 } : null)}
                            style={{ width: '80px', padding: '4px 8px' }}
                          />
                        ) : (
                          <span style={isLow ? { color: '#dd5e56', fontWeight: 700 } : { color: '#ffffff', fontWeight: 500 }}>
                            {item.stock_level}
                          </span>
                        )}
                      </td>
                      
                      {/* Threshold cell */}
                      <td>
                        {isEditing ? (
                          <input 
                            type="number"
                            className="crud-input"
                            value={editForm?.reorder_threshold ?? 0}
                            onChange={e => setEditForm(prev => prev ? { ...prev, reorder_threshold: parseInt(e.target.value) || 0 } : null)}
                            style={{ width: '80px', padding: '4px 8px' }}
                          />
                        ) : (
                          <span className="text-muted">{item.reorder_threshold}</span>
                        )}
                      </td>
                      
                      {/* Expiry Date cell */}
                      <td>
                        {isEditing ? (
                          <input 
                            type="date"
                            className="crud-input"
                            value={editForm?.expiry_date || ""}
                            onChange={e => setEditForm(prev => prev ? { ...prev, expiry_date: e.target.value } : null)}
                            style={{ width: '130px', padding: '4px 8px', fontSize: '0.8rem' }}
                          />
                        ) : (
                          <span style={isExp ? { color: '#e69d30', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' } : { color: '#8c96a8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <Calendar size={13} />
                            {item.expiry_date}
                          </span>
                        )}
                      </td>
                      
                      <td style={{ fontWeight: 600 }}>{item.price_aed.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {isLow && <span className="badge badge-red">Low Stock</span>}
                          {isExp && <span className="badge badge-amber">Near Expiry</span>}
                          {!isLow && !isExp && <span className="badge badge-green">Safe</span>}
                        </div>
                      </td>

                      {/* Actions cell */}
                      {isEditMode && (
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => handleSaveEdit(item.store_id, item.product_id)} 
                                className="action-icon-btn save-btn"
                                title="Save changes"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={handleCancelEdit} 
                                className="action-icon-btn cancel-btn"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => handleStartEdit(item)} 
                                className="action-icon-btn edit-btn"
                                title="Edit item"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteInventory(item.store_id, item.product_id)} 
                                className="action-icon-btn delete-btn"
                                title="Delete from branch"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Dual Restock Options & Logistics Section */}
        <section className="actions-grid">
          
          {/* Dual Restock Engine (Inter-Branch Swap vs Supplier PO) */}
          <div className="action-card">
            <div className="action-header">
              <ArrowRightLeft size={18} style={{ color: "#c3b189" }} />
              <h3>Restock Recommendations & Dual Options</h3>
            </div>
            <p className="action-desc">
              When stock runs low, choose between an <strong>Inter-Branch Swap</strong> (if excess stock exists) or <strong>Supplier Purchase Order</strong> via WhatsApp.
            </p>

            {transferMessage && (
              <div className={`alert-message ${transferMessage.type === "success" ? "success" : "error"}`}>
                {transferMessage.text}
              </div>
            )}

            <div className="swap-list">
              {roleFilteredSwaps.length === 0 && lowStock.filter(item => userRole === 'HQ' || item.store_id === selectedStoreId).length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed #232733', borderRadius: '12px', color: '#8c96a8', fontSize: '0.8rem' }}>
                  No restocks required. All stores are currently at safe inventory levels.
                </div>
              )}

              {/* Option A: Inter-branch Swaps */}
              {roleFilteredSwaps.map((swap, idx) => (
                <div key={`swap-${idx}`} className="swap-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 className="swap-product">{swap.product_name}</h4>
                      <div className="swap-path" style={{ marginTop: '2px' }}>
                        <span className="swap-source">{swap.from_store_name.split(" ")[0]}</span>
                        <ChevronRight size={12} />
                        <span className="swap-dest">{swap.to_store_name.split(" ")[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleExecuteTransfer(swap.from_store_id, swap.to_store_id, swap.product_id, swap.qty)}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      <ArrowRightLeft size={13} /> Option 1: Inter-Branch Swap ({swap.qty} units)
                    </button>
                    <button 
                      onClick={() => openPoModalForItem(swap, swap.qty)}
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.3)' }}
                    >
                      <MessageSquare size={13} /> Option 2: Draft Supplier PO
                    </button>
                  </div>
                </div>
              ))}

              {/* Low stock items without active inter-branch swap: Option 2 Supplier PO always available */}
              {lowStock
                .filter(item => (userRole === 'HQ' || item.store_id === selectedStoreId) && !roleFilteredSwaps.some(s => s.product_id === item.product_id && s.to_store_id === item.store_id))
                .map((item, idx) => {
                  const suggestedPoQty = Math.max(10, item.reorder_threshold - item.stock_level);
                  return (
                    <div key={`po-only-${idx}`} className="swap-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 className="swap-product">{item.product_name}</h4>
                          <span style={{ fontSize: '0.78rem', color: '#dd5e56' }}>
                            {item.store_name} | Stock: {item.stock_level} (Threshold: {item.reorder_threshold})
                          </span>
                        </div>
                        <span className="badge badge-amber" style={{ fontSize: '0.75rem' }}>No Excess Branch Stock</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => openPoModalForItem(item, suggestedPoQty)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.82rem',
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <MessageSquare size={14} /> Draft Purchase Order from Supplier
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Supplier Purchase Orders Tracking Panel */}
          <div className="action-card">
            <div className="action-header">
              <MessageSquare size={18} style={{ color: "#25D366" }} />
              <h3>Supplier Purchase Orders Log</h3>
            </div>
            <p className="action-desc">
              Track orders placed via WhatsApp. Stock commits to SQLite <strong>ONLY</strong> after clicking "Mark Received".
            </p>

            <div className="swap-list">
              {roleFilteredPurchaseOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed #232733', borderRadius: '12px', color: '#8c96a8', fontSize: '0.8rem' }}>
                  No active supplier purchase orders.
                </div>
              ) : (
                roleFilteredPurchaseOrders.map((po) => (
                  <div key={po.id} className="swap-item" style={{ opacity: po.status === 'Received' ? 0.65 : 1 }}>
                    <div className="swap-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="swap-product">{po.product_name}</h4>
                        <span className="badge badge-amber" style={{ fontSize: '9px', padding: '2px 6px' }}>{po.po_number}</span>
                      </div>
                      <div className="swap-path" style={{ marginTop: '2px' }}>
                        <span className="swap-dest">{po.store_name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#8c96a8', marginLeft: '6px' }}>| Supplier: {po.receiver_phone}</span>
                      </div>
                      <div className="swap-meta">
                        <span>Order Qty: <strong>{po.quantity} units</strong></span>
                        <span style={{ fontSize: '0.75rem', color: '#8c96a8' }}>Status: {po.status}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {po.status === 'Pending' ? (
                        <button 
                          onClick={() => handleReceivePO(po.id)}
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.78rem',
                            background: '#1ba56b',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <CheckCircle2 size={14} /> Mark Received
                        </button>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                          Received & Added to DB
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Branch Transfer Portal & Logistics Tracker */}
        <section className="actions-grid" style={{ marginTop: '24px' }}>
          
          <div className="action-card">
            <div className="action-header">
              <RefreshCw size={18} style={{ color: "#c3b189" }} />
              <h3>Branch Transfer Portal ({userRole === 'HQ' ? 'HQ Audit' : `${currentBranchName} Store`})</h3>
            </div>
            <p className="action-desc">
              Track logistics shipments. Stock updates are committed to SQLite only when incoming shipments are marked "Completed" by the receiving branch.
            </p>

            {/* Section: Outgoing Dispatches */}
            {(userRole === 'HQ' || outgoingTransfers.length > 0) && (
              <div style={{ marginTop: '16px' }}>
                <span className="swap-section-title">Outgoing Dispatches (To Ship)</span>
                {outgoingTransfers.length === 0 ? (
                  <div style={{ padding: '16px', border: '1px dashed #232733', borderRadius: '8px', color: '#8c96a8', fontSize: '0.78rem', textAlign: 'center' }}>No outgoing dispatches pending.</div>
                ) : (
                  <div className="swap-list">
                    {outgoingTransfers.map((req) => (
                      <div key={req.id} className="swap-item">
                        <div className="swap-info">
                          <h4 className="swap-product">{req.product_name}</h4>
                          <div className="swap-path">
                            <span className="swap-source">{req.from_store_name.split(" ")[0]}</span>
                            <ChevronRight size={12} />
                            <span className="swap-dest">{req.to_store_name.split(" ")[0]}</span>
                          </div>
                          <div className="swap-meta">
                            <span>Qty: <strong>{req.quantity}</strong></span>
                            <span className="badge badge-gray" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', color: '#8c96a8' }}>Pending Dispatch</span>
                          </div>
                        </div>
                        
                        {userRole !== 'HQ' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleUpdateTransferStatus(req.id, 'Sent')}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            >
                              Dispatch (Ship)
                            </button>
                            <button 
                              onClick={() => handleUpdateTransferStatus(req.id, 'Cancelled')}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.78rem', color: '#dd5e56', borderColor: 'rgba(221, 94, 86, 0.3)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section: Incoming Shipments */}
            {(userRole === 'HQ' || incomingTransfers.length > 0) && (
              <div style={{ marginTop: '20px' }}>
                <span className="swap-section-title">Incoming Shipments (In Transit)</span>
                {incomingTransfers.length === 0 ? (
                  <div style={{ padding: '16px', border: '1px dashed #232733', borderRadius: '8px', color: '#8c96a8', fontSize: '0.78rem', textAlign: 'center' }}>No incoming shipments in transit.</div>
                ) : (
                  <div className="swap-list">
                    {incomingTransfers.map((req) => (
                      <div key={req.id} className="swap-item">
                        <div className="swap-info">
                          <h4 className="swap-product">{req.product_name}</h4>
                          <div className="swap-path">
                            <span className="swap-source" style={{ color: '#8c96a8' }}>{req.from_store_name.split(" ")[0]}</span>
                            <ChevronRight size={12} />
                            <span className="swap-dest" style={{ color: '#1ba56b' }}>{req.to_store_name.split(" ")[0]}</span>
                          </div>
                          <div className="swap-meta">
                            <span>Qty: <strong>{req.quantity}</strong></span>
                            <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(27,165,107,0.1)', color: '#1ba56b' }}>In Transit</span>
                          </div>
                        </div>
                        
                        {userRole !== 'HQ' ? (
                          <button 
                            onClick={() => handleUpdateTransferStatus(req.id, 'Completed')}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#1ba56b', borderColor: '#1ba56b' }}
                          >
                            Mark Received
                          </button>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Waiting for destination receive</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section: Completed & Cancelled Log */}
            {completedTransfers.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <span className="swap-section-title">Transfer History Logs</span>
                <div className="swap-list" style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {completedTransfers.map((req) => (
                    <div key={req.id} className="swap-item" style={{ opacity: 0.6 }}>
                      <div className="swap-info">
                        <h4 className="swap-product" style={{ fontSize: '0.82rem' }}>{req.product_name}</h4>
                        <div className="swap-path" style={{ fontSize: '0.72rem' }}>
                          <span>{req.from_store_name.split(" ")[0]}</span>
                          <ChevronRight size={10} />
                          <span>{req.to_store_name.split(" ")[0]}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Qty: {req.quantity}</span>
                        <span className={`badge ${req.status === 'Completed' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                          {req.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add Product to Branch Inventory</h3>
              <button onClick={() => setShowAddModal(false)} className="close-modal-btn">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="modal-form">
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Al Ain Apple Juice 1L" 
                  value={newProductForm.product_name}
                  onChange={e => setNewProductForm(prev => ({ ...prev, product_name: e.target.value }))}
                  required
                  className="crud-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Beverages" 
                    value={newProductForm.category}
                    onChange={e => setNewProductForm(prev => ({ ...prev, category: e.target.value }))}
                    required
                    className="crud-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (AED)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 5.50" 
                    value={newProductForm.price_aed}
                    onChange={e => setNewProductForm(prev => ({ ...prev, price_aed: e.target.value }))}
                    required
                    className="crud-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Destination Store</label>
                  <select 
                    value={newProductForm.store_id}
                    onChange={e => setNewProductForm(prev => ({ ...prev, store_id: e.target.value }))}
                    required
                    className="crud-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  >
                    <option value="">Select Branch...</option>
                    {data.stores.map(store => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Level</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50" 
                    value={newProductForm.stock_level}
                    onChange={e => setNewProductForm(prev => ({ ...prev, stock_level: e.target.value }))}
                    required
                    className="crud-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Reorder Threshold</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 10" 
                    value={newProductForm.reorder_threshold}
                    onChange={e => setNewProductForm(prev => ({ ...prev, reorder_threshold: e.target.value }))}
                    required
                    className="crud-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input 
                    type="date" 
                    value={newProductForm.expiry_date}
                    onChange={e => setNewProductForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                    required
                    className="crud-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Draft Purchase Order Modal */}
      {showPoModal && poDraftItem && (
        <div className="login-screen">
          <div className="login-backdrop" onClick={() => setShowPoModal(false)}></div>
          <div className="login-card" style={{ width: '540px', maxWidth: '95vw', padding: '32px', zIndex: 1100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(37, 211, 102, 0.15)', border: '1px solid rgba(37, 211, 102, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={20} style={{ color: '#25D366' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 700 }}>Draft Purchase Order</h3>
                  <span style={{ fontSize: '0.72rem', color: '#8c96a8' }}>Supplier Order via WhatsApp</span>
                </div>
              </div>
              <button onClick={() => setShowPoModal(false)} style={{ background: 'transparent', border: 'none', color: '#8c96a8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#13161e', border: '1px solid #232733', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#8c96a8' }}>Destination Branch:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{poDraftItem.store_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#8c96a8' }}>Product Name:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c3b189' }}>{poDraftItem.product_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#8c96a8' }}>Category:</span>
                <span style={{ fontSize: '0.85rem', color: '#ffffff' }}>{poDraftItem.category}</span>
              </div>
            </div>

            <div className="login-field" style={{ marginBottom: '20px' }}>
              <label className="login-label">Order Quantity (Units)</label>
              <input 
                type="number"
                min="1"
                className="login-input"
                value={poQty}
                onChange={(e) => {
                  const newQty = Math.max(1, parseInt(e.target.value) || 1);
                  setPoQty(newQty);
                  setCustomWaMessage(prev => prev.replace(/Order Qty: \d+ units/, `Order Qty: ${newQty} units`));
                }}
                style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c3b189' }}
              />
            </div>

            {/* Live WhatsApp Message Preview (Editable) */}
            <div className="login-field" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="login-label" style={{ margin: 0 }}>WhatsApp Message Draft (Editable)</label>
                <span style={{ fontSize: '0.72rem', color: '#25D366', fontWeight: 600 }}>Manager Editable</span>
              </div>
              <textarea 
                value={customWaMessage}
                onChange={(e) => setCustomWaMessage(e.target.value)}
                style={{ 
                  background: '#0b141a', 
                  border: '1px solid #1f2c34', 
                  borderRadius: '10px', 
                  padding: '14px', 
                  color: '#e9edef', 
                  fontSize: '0.82rem', 
                  fontFamily: 'monospace', 
                  lineHeight: 1.5,
                  minHeight: '160px',
                  width: '100%',
                  resize: 'vertical'
                }}
              />
            </div>

            <button 
              onClick={handleCreatePO} 
              disabled={poLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 6px 20px rgba(37, 211, 102, 0.3)'
              }}
            >
              {poLoading ? (
                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
              ) : (
                <><Send size={18} /> Confirm & Send via WhatsApp</>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
