"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, RefreshCw, AlertOctagon } from "lucide-react";

export type ChatRole = "user" | "assistant" | "error";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Store {
  id: number;
  name: string;
  location: string;
}

export interface Connection {
  from_store_name: string;
  to_store_name: string;
  from_store_id: number;
  to_store_id: number;
}

export interface InventoryItem {
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

export interface Rules {
  near_expiry_days_threshold: string;
  ramadan_reorder_multiplier: string;
  standard_reorder_multiplier: string;
  allow_inter_branch_transfers: string;
  sender_whatsapp?: string;
  receiver_whatsapp?: string;
}

export interface TransferSuggestion {
  product_id: number;
  product_name: string;
  from_store_id: number;
  from_store_name: string;
  to_store_id: number;
  to_store_name: string;
  qty: number;
  price_aed: number;
  category: string;
}

type UserRole = "HQ" | "Dubai" | "Downtown" | "Sharjah";

interface AppData {
  stores: Store[];
  connections: Connection[];
  inventory: InventoryItem[];
  rules: Rules;
}

interface AppContextValue {
  data: AppData;
  userRole: UserRole;
  selectedStoreId: number | null;
  currentBranchName: string;
  filteredInventory: InventoryItem[];
  isNearExpiry: (expiryStr: string, nearExpiryThresholdDays: number) => boolean;

  // Dashboard-wide derived values
  lowStock: InventoryItem[];
  nearExpiry: InventoryItem[];
  roleFilteredSwaps: TransferSuggestion[];
  roleFilteredPurchaseOrders: any[];
  roleFilteredAlerts: any[];
  incomingTransfers: any[];
  outgoingTransfers: any[];
  completedTransfers: any[];

  // Rules / config
  editRules: Rules | null;
  setEditRules: React.Dispatch<React.SetStateAction<Rules | null>>;
  updatingRuleKey: string | null;
  handleUpdateRule: (key: keyof Rules, value: string) => Promise<void>;

  // Alerts
  alerts: any[];
  handleDismissAlert: (alertId: number) => Promise<void>;

  // Transfers
  transferMessage: { type: "success" | "error"; text: string } | null;
  handleExecuteTransfer: (fromId: number, toId: number, pId: number, qty: number) => Promise<void>;
  handleUpdateTransferStatus: (requestId: number, newStatus: string) => Promise<void>;

  // Purchase Orders / WhatsApp modal
  purchaseOrders: any[];
  handleReceivePO: (poId: number) => Promise<void>;
  showPoModal: boolean;
  setShowPoModal: React.Dispatch<React.SetStateAction<boolean>>;
  poDraftItem: {
    store_id: number;
    store_name: string;
    product_id: number;
    product_name: string;
    category: string;
    price_aed: number;
    stock_level: number;
    reorder_threshold: number;
    suggested_qty: number;
  } | null;
  poQty: number;
  setPoQty: React.Dispatch<React.SetStateAction<number>>;
  poLoading: boolean;
  customWaMessage: string;
  setCustomWaMessage: React.Dispatch<React.SetStateAction<string>>;
  handleCreatePO: () => Promise<void>;
  openPoModalForItem: (item: any, qty: number) => void;

  // Inventory CRUD (add product modal + shared success/error banners)
  showAddModal: boolean;
  setShowAddModal: React.Dispatch<React.SetStateAction<boolean>>;
  newProductForm: {
    product_name: string;
    category: string;
    price_aed: string;
    store_id: string;
    stock_level: string;
    reorder_threshold: string;
    expiry_date: string;
  };
  setNewProductForm: React.Dispatch<React.SetStateAction<any>>;
  handleAddProduct: (e: React.FormEvent) => Promise<void>;
  crudError: string | null;
  crudSuccess: string | null;
  setCrudError: React.Dispatch<React.SetStateAction<string | null>>;
  setCrudSuccess: React.Dispatch<React.SetStateAction<string | null>>;

  fetchData: () => Promise<void>;
  handleLogout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [updatingRuleKey, setUpdatingRuleKey] = useState<string | null>(null);
  const [editRules, setEditRules] = useState<Rules | null>(null);

  const [transferMessage, setTransferMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const [transfers, setTransfers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const [showPoModal, setShowPoModal] = useState(false);
  const [poDraftItem, setPoDraftItem] = useState<AppContextValue["poDraftItem"]>(null);
  const [poQty, setPoQty] = useState<number>(10);
  const [poLoading, setPoLoading] = useState(false);
  const [customWaMessage, setCustomWaMessage] = useState<string>("");

  const openPoModalForItem = (item: any, qty: number) => {
    const storeName = item.store_name || item.to_store_name || "Branch";
    const seqNum = String(purchaseOrders.length + 1).padStart(3, "0");
    const poRef = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${seqNum}`;
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
  const [userRole, setUserRole] = useState<UserRole>("HQ");
  const [loginBranch, setLoginBranch] = useState<string>("HQ");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

      setUserRole(json.role as UserRole);
      setSelectedStoreId(json.store_id);
      setIsLoggedIn(true);
      setLoginPassword("");
      router.push("/suggestions");
    } catch (err: any) {
      setLoginError(err.message || "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole("HQ");
    setSelectedStoreId(null);
    setLoginPassword("");
    setLoginError(null);
  };

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

      const finalMessage = customWaMessage || (
        `*AUTOMATIX OFFICIAL PURCHASE ORDER*\n` +
        `PO Ref: #${json.po_number || 'PO-2026'}\n` +
        `Destination: ${poDraftItem.store_name}\n` +
        `Product: ${poDraftItem.product_name}\n` +
        `Category: ${poDraftItem.category}\n` +
        `Order Qty: ${poQty} units\n\n` +
        `Please confirm order dispatch and estimated delivery time.`
      );

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

  useEffect(() => {
    setTransferMessage(null);
    setCrudSuccess(null);
    setCrudError(null);
  }, [userRole, selectedStoreId]);

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

  const handleUpdateRule = async (key: keyof Rules, value: string) => {
    try {
      setUpdatingRuleKey(key);
      const res = await fetch("http://localhost:8000/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Failed to update rule.");

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
      fetchData();
    } catch (err: any) {
      setTransferMessage({ type: "error", text: err.message });
    }
  };

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
      fetchData();
    } catch (err: any) {
      setTransferMessage({ type: "error", text: err.message || "Status update failed." });
    }
  };

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
      fetchData();
    } catch (err: any) {
      setCrudError(err.message || "An error occurred.");
    }
  };

  const isNearExpiry = (expiryStr: string, nearExpiryThresholdDays: number): boolean => {
    const systemDate = new Date("2026-07-16");
    const expiryDate = new Date(expiryStr);
    const timeDiff = expiryDate.getTime() - systemDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff >= 0 && daysDiff <= nearExpiryThresholdDays;
  };

  // ---- Login / loading / error gates (same behavior as the original single-page app) ----
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-backdrop"></div>
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--accent-gold-rgb), 0.12)', border: '1px solid rgba(var(--accent-gold-rgb), 0.25)' }}>
              <Building2 style={{ color: "var(--accent-gold)" }} size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-heading)', margin: 0 }}>Automatix</h1>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inventory Management System</span>
            </div>
          </div>

          <div className="login-divider"></div>

          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 4px 0' }}>Branch Login</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 24px 0' }}>Enter your branch credentials to access the operations dashboard.</p>

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

          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: '20px' }}>
            Access restricted to authorized branch personnel only.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <RefreshCw size={40} style={{ color: "var(--accent-gold)", animation: 'spin 1.5s linear infinite' }} />
        <p style={{ color: "var(--accent-gold)", fontFamily: 'var(--font-display)', fontWeight: 500 }}>Loading multi-store dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '24px', padding: '24px', textAlign: 'center' }}>
        <AlertOctagon size={60} style={{ color: "var(--status-red)" }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Backend Connection Failed</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem' }}>Could not connect to the inventory REST API at localhost:8000. Please make sure uvicorn is running in the backend directory.</p>
        </div>
        <button onClick={fetchData} className="btn-primary">
          <RefreshCw size={16} /> Try Reconnecting
        </button>
      </div>
    );
  }

  if (!data) return null;

  // ---- Derived values (computed once per render, shared across every page) ----
  const nearExpiryDays = parseInt(data.rules.near_expiry_days_threshold || "3");
  const lowStock = data.inventory.filter(item => item.stock_level < item.reorder_threshold);
  const nearExpiry = data.inventory.filter(item => isNearExpiry(item.expiry_date, nearExpiryDays));

  const transfersEnabled = data.rules.allow_inter_branch_transfers === "1";
  const allSuggestions: TransferSuggestion[] = [];
  if (transfersEnabled) {
    lowStock.forEach(item => {
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
          allSuggestions.push({
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
  }

  const activeTransferKeys = new Set(
    transfers
      .filter(t => t.status === 'Pending' || t.status === 'Sent')
      .map(t => `${t.from_store_id}-${t.to_store_id}-${t.product_id}`)
  );

  const availableSuggestions = allSuggestions.filter(s =>
    !activeTransferKeys.has(`${s.from_store_id}-${s.to_store_id}-${s.product_id}`)
  );

  const roleFilteredSwaps = userRole === 'HQ'
    ? availableSuggestions
    : availableSuggestions.filter(s => s.to_store_id === selectedStoreId);

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
    ? (data.stores.find(s => s.id === selectedStoreId)?.name || "Branch")
    : "All Branches";

  const filteredInventory = selectedStoreId
    ? data.inventory.filter(item => item.store_id === selectedStoreId)
    : data.inventory;

  const value: AppContextValue = {
    data,
    userRole,
    selectedStoreId,
    currentBranchName,
    filteredInventory,
    isNearExpiry,
    lowStock,
    nearExpiry,
    roleFilteredSwaps,
    roleFilteredPurchaseOrders,
    roleFilteredAlerts,
    incomingTransfers,
    outgoingTransfers,
    completedTransfers,
    editRules,
    setEditRules,
    updatingRuleKey,
    handleUpdateRule,
    alerts,
    handleDismissAlert,
    transferMessage,
    handleExecuteTransfer,
    handleUpdateTransferStatus,
    purchaseOrders,
    handleReceivePO,
    showPoModal,
    setShowPoModal,
    poDraftItem,
    poQty,
    setPoQty,
    poLoading,
    customWaMessage,
    setCustomWaMessage,
    handleCreatePO,
    openPoModalForItem,
    showAddModal,
    setShowAddModal,
    newProductForm,
    setNewProductForm,
    handleAddProduct,
    crudError,
    crudSuccess,
    setCrudError,
    setCrudSuccess,
    fetchData,
    handleLogout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
