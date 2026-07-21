"use client";

import React from "react";
import { ArrowRightLeft, MessageSquare, ChevronRight, CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function SwapsPage() {
  const {
    userRole,
    selectedStoreId,
    lowStock,
    roleFilteredSwaps,
    roleFilteredPurchaseOrders,
    transferMessage,
    handleExecuteTransfer,
    handleReceivePO,
    openPoModalForItem,
  } = useApp();

  return (
    <section className="actions-grid">
      {/* Dual Restock Engine (Inter-Branch Swap vs Supplier PO) */}
      <div className="action-card">
        <div className="action-header">
          <ArrowRightLeft size={18} style={{ color: "var(--accent-gold)" }} />
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
            <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed var(--card-border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
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
                      <span style={{ fontSize: '0.78rem', color: 'var(--status-red)' }}>
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
            <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed var(--card-border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No active supplier purchase orders.
            </div>
          ) : (
            roleFilteredPurchaseOrders.map((po: any) => (
              <div key={po.id} className="swap-item" style={{ opacity: po.status === 'Received' ? 0.65 : 1 }}>
                <div className="swap-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 className="swap-product">{po.product_name}</h4>
                    <span className="badge badge-amber" style={{ fontSize: '9px', padding: '2px 6px' }}>{po.po_number}</span>
                  </div>
                  <div className="swap-path" style={{ marginTop: '2px' }}>
                    <span className="swap-dest">{po.store_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>| Supplier: {po.receiver_phone}</span>
                  </div>
                  <div className="swap-meta">
                    <span>Order Qty: <strong>{po.quantity} units</strong></span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {po.status}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {po.status === 'Pending' ? (
                    <button
                      onClick={() => handleReceivePO(po.id)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.78rem',
                        background: 'var(--status-green)',
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
  );
}
