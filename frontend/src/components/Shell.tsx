"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Bell,
  Sliders,
  X,
  Bot,
  User,
  Sparkles,
  Send,
  RefreshCw,
  AlertOctagon,
  MessageCircle,
  MessageSquare,
} from "lucide-react";
import { useApp, ChatMessage } from "@/context/AppContext";
import { renderMarkdown } from "@/lib/renderMarkdown";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/inventory", label: "Inventory" },
  { href: "/stock-management", label: "Stock Management" },
];

function ChatThread({ messages, running, emptyHint }: { messages: ChatMessage[]; running: boolean; emptyHint: string }) {
  return (
    <div className="chat-thread">
      {messages.length === 0 && !running && (
        <div className="chat-empty">
          <Sparkles size={22} />
          <p>{emptyHint}</p>
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className={`chat-row ${m.role}`}>
          <div className="chat-avatar">{m.role === "user" ? <User size={14} /> : <Bot size={14} />}</div>
          <div className={`chat-bubble ${m.role === "error" ? "chat-error" : ""}`}>
            {m.role === "assistant" ? <div className="markdown-body">{renderMarkdown(m.content)}</div> : <p>{m.content}</p>}
          </div>
        </div>
      ))}
      {running && (
        <div className="chat-row assistant">
          <div className="chat-avatar"><Bot size={14} /></div>
          <div className="chat-bubble chat-typing"><span></span><span></span><span></span></div>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const {
    data,
    userRole,
    currentBranchName,
    editRules,
    setEditRules,
    handleUpdateRule,
    roleFilteredAlerts,
    handleDismissAlert,
    fetchData,
    handleLogout,
    showAddModal,
    setShowAddModal,
    newProductForm,
    setNewProductForm,
    handleAddProduct,
    showPoModal,
    setShowPoModal,
    poDraftItem,
    poQty,
    setPoQty,
    poLoading,
    customWaMessage,
    setCustomWaMessage,
    handleCreatePO,
  } = useApp();

  const pathname = usePathname();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);

  const [floatingChatOpen, setFloatingChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatRunning, setChatRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    document.querySelectorAll<HTMLDivElement>(".chat-thread").forEach(el => {
      el.scrollTop = el.scrollHeight;
    });
  }, [chatMessages, chatRunning, floatingChatOpen]);

  const handleSendChatMessage = async () => {
    if (chatRunning || !chatInput.trim()) return;
    const sentText = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: sentText }]);
    setChatInput("");
    setChatRunning(true);
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sentText }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Agent request failed.");

      setChatMessages(prev => [...prev, { role: "assistant", content: json.reply }]);
      fetchData();
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: "error", content: err.message || "Agent request failed." }]);
    } finally {
      setChatRunning(false);
    }
  };

  return (
    <div className="dashboard-grid full-width-layout">
      <main className="main-content" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Main Header Navbar */}
        <header className="main-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="brand-icon" style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(var(--accent-gold-rgb), 0.12)', border: '1px solid rgba(var(--accent-gold-rgb), 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 style={{ color: "var(--accent-gold)" }} size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Automatix</h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supermarket Ops Desk</span>
              </div>
            </div>

            <nav className="filter-bar">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`filter-btn ${pathname === link.href ? "active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
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
                  background: 'var(--input-bg)',
                  border: '1px solid var(--card-border)',
                  color: notificationsOpen ? 'var(--accent-gold)' : 'var(--text-muted)',
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
                    background: 'var(--status-red)',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '2px 6px',
                    minWidth: '18px',
                    textAlign: 'center',
                    boxShadow: '0 0 10px rgba(194, 69, 60, 0.5)'
                  }}>
                    {roleFilteredAlerts.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="notifications-dropdown-menu" style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  background: 'var(--card-bg)',
                  border: '1px solid rgba(var(--accent-gold-rgb), 0.3)',
                  borderRadius: '12px',
                  width: '380px',
                  boxShadow: '0 20px 50px rgba(16,24,40,0.16)',
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
                    borderBottom: '1px solid var(--card-border)',
                    background: 'rgba(16,24,40,0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertOctagon size={16} style={{ color: 'var(--status-red)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                        Watchdog Alerts ({roleFilteredAlerts.length})
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: '320px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {roleFilteredAlerts.length === 0 ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No active stock alerts.
                      </div>
                    ) : (
                      roleFilteredAlerts.map((alert: any) => (
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
                  background: 'var(--input-bg)',
                  border: '1px solid var(--card-border)',
                  color: configDrawerOpen ? 'var(--accent-gold)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Operational Configuration"
              >
                <Sliders size={18} />
              </button>

              {configDrawerOpen && (
                <div className="config-popover-menu" style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  background: 'var(--card-bg)',
                  border: '1px solid rgba(var(--accent-gold-rgb), 0.3)',
                  borderRadius: '12px',
                  width: '380px',
                  padding: '20px',
                  boxShadow: '0 20px 50px rgba(16,24,40,0.18)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} style={{ color: 'var(--accent-gold)' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>Operational Config</span>
                    </div>
                    <button
                      onClick={() => setConfigDrawerOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="config-group">
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px 16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-gold)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.82rem' }}>
                {userRole === 'HQ' ? 'HQ' : userRole[0]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logged In</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {userRole === 'HQ' ? 'HQ Operations Manager' : `${currentBranchName} Manager`}
                </span>
              </div>
              <button
                onClick={handleLogout}
                style={{ background: 'transparent', border: '1px solid rgba(194, 69, 60, 0.3)', color: 'var(--status-red)', fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', marginLeft: '8px', transition: 'all 0.2s ease' }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {children}

      </main>

      {/* Floating Agent Chat Widget */}
      {floatingChatOpen && (
        <div className="floating-chat-window">
          <div className="floating-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={17} style={{ color: "var(--accent-gold)" }} />
              <h3>Automatix Agent</h3>
            </div>
            <button onClick={() => setFloatingChatOpen(false)} className="close-modal-btn" title="Close chat">
              <X size={18} />
            </button>
          </div>
          <div className="floating-chat-body">
            <p className="action-desc">
              Ask anything — a quick question, a full inventory audit, or a direct instruction like "set stock to 50 in Sharjah". One agent handles all of it, including writing changes straight to the database.
            </p>

            <ChatThread
              messages={chatMessages}
              running={chatRunning}
              emptyHint={'Ask a question, request an audit, or give an instruction — e.g. "What\'s low on stock?" or "Set stock level to 50 in Sharjah Al Nahda."'}
            />

            <form
              className="chat-input-bar"
              onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
            >
              <textarea
                placeholder="Message the Automatix agent..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                className="chat-input"
                rows={1}
              />
              <button type="submit" disabled={chatRunning || !chatInput.trim()} className="chat-send-btn" title="Send">
                {chatRunning ? <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setFloatingChatOpen(prev => !prev)}
        className="floating-chat-fab"
        title={floatingChatOpen ? "Close agent chat" : "Chat with the Automatix agent"}
      >
        {floatingChatOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

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
                  onChange={e => setNewProductForm((prev: any) => ({ ...prev, product_name: e.target.value }))}
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
                    onChange={e => setNewProductForm((prev: any) => ({ ...prev, category: e.target.value }))}
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
                    onChange={e => setNewProductForm((prev: any) => ({ ...prev, price_aed: e.target.value }))}
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
                    onChange={e => setNewProductForm((prev: any) => ({ ...prev, store_id: e.target.value }))}
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
                    onChange={e => setNewProductForm((prev: any) => ({ ...prev, stock_level: e.target.value }))}
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
                    onChange={e => setNewProductForm((prev: any) => ({ ...prev, reorder_threshold: e.target.value }))}
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
                    onChange={e => setNewProductForm((prev: any) => ({ ...prev, expiry_date: e.target.value }))}
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
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-heading)', fontWeight: 700 }}>Draft Purchase Order</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Supplier Order via WhatsApp</span>
                </div>
              </div>
              <button onClick={() => setShowPoModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'var(--card-bg-alt)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Destination Branch:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>{poDraftItem.store_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Product Name:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-gold)' }}>{poDraftItem.product_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category:</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>{poDraftItem.category}</span>
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
                  setCustomWaMessage(prev => prev.replace(/(?:Order Qty|Qty):\s*\d+/i, `Order Qty: ${newQty}`));
                }}
                style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }}
              />
            </div>

            <div className="login-field" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="login-label" style={{ margin: 0 }}>WhatsApp Message Draft (Editable)</label>
                <span style={{ fontSize: '0.72rem', color: '#25D366', fontWeight: 600 }}>Bi-Directional Auto Sync</span>
              </div>
              <textarea
                value={customWaMessage}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomWaMessage(val);
                  const match = val.match(/(?:Order Qty|Qty):\s*(\d+)/i);
                  if (match && match[1]) {
                    const parsed = parseInt(match[1], 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      setPoQty(parsed);
                    }
                  }
                }}
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
