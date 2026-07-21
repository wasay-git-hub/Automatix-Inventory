"use client";

import React from "react";
import { AlertTriangle, ArrowRightLeft, MessageSquare, RefreshCw, ChevronRight } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function Home() {
  const {
    userRole,
    currentBranchName,
    lowStock,
    roleFilteredSwaps,
    roleFilteredPurchaseOrders,
    transferMessage,
    outgoingTransfers,
    incomingTransfers,
    completedTransfers,
    handleUpdateTransferStatus,
  } = useApp();

  return (
    <>
      {/* Stats Grid */}
      <section className="stats-grid">
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

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Pending Supplier POs</span>
            <span className="stat-number">{roleFilteredPurchaseOrders.filter((po: any) => po.status === 'Pending').length}</span>
            <span className="stat-help">Awaiting WhatsApp shipment delivery</span>
          </div>
          <div className="stat-icon amber">
            <MessageSquare size={22} />
          </div>
        </div>
      </section>

      {/* Branch Transfer Portal & Logistics Tracker */}
      <section className="actions-grid" style={{ marginTop: '24px' }}>
        <div className="action-card">
          <div className="action-header">
            <RefreshCw size={18} style={{ color: "var(--accent-gold)" }} />
            <h3>Branch Transfer Portal ({userRole === 'HQ' ? 'HQ Audit' : `${currentBranchName} Store`})</h3>
          </div>
          <p className="action-desc">
            Track logistics shipments. Stock updates are committed to SQLite only when incoming shipments are marked "Completed" by the receiving branch.
          </p>

          {transferMessage && (
            <div className={`alert-message ${transferMessage.type === "success" ? "success" : "error"}`}>
              {transferMessage.text}
            </div>
          )}

          {/* Section: Outgoing Dispatches */}
          {(userRole === 'HQ' || outgoingTransfers.length > 0) && (
            <div style={{ marginTop: '16px' }}>
              <span className="swap-section-title">Outgoing Dispatches (To Ship)</span>
              {outgoingTransfers.length === 0 ? (
                <div style={{ padding: '16px', border: '1px dashed var(--card-border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>No outgoing dispatches pending.</div>
              ) : (
                <div className="swap-list">
                  {outgoingTransfers.map((req: any) => (
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
                          <span className="badge badge-gray" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(16,24,40,0.05)', color: 'var(--text-muted)' }}>Pending Dispatch</span>
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
                            style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--status-red)', borderColor: 'rgba(194, 69, 60, 0.3)' }}
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
                <div style={{ padding: '16px', border: '1px dashed var(--card-border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>No incoming shipments in transit.</div>
              ) : (
                <div className="swap-list">
                  {incomingTransfers.map((req: any) => (
                    <div key={req.id} className="swap-item">
                      <div className="swap-info">
                        <h4 className="swap-product">{req.product_name}</h4>
                        <div className="swap-path">
                          <span className="swap-source" style={{ color: 'var(--text-muted)' }}>{req.from_store_name.split(" ")[0]}</span>
                          <ChevronRight size={12} />
                          <span className="swap-dest" style={{ color: 'var(--status-green)' }}>{req.to_store_name.split(" ")[0]}</span>
                        </div>
                        <div className="swap-meta">
                          <span>Qty: <strong>{req.quantity}</strong></span>
                          <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(22,135,90,0.1)', color: 'var(--status-green)' }}>In Transit</span>
                        </div>
                      </div>

                      {userRole !== 'HQ' ? (
                        <button
                          onClick={() => handleUpdateTransferStatus(req.id, 'Completed')}
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'var(--status-green)', borderColor: 'var(--status-green)' }}
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
                {completedTransfers.map((req: any) => (
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
      </section>
    </>
  );
}
