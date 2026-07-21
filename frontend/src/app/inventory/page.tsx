"use client";

import React, { useState } from "react";
import { Package, Settings2, Plus, RefreshCw, Calendar, Check, X, Edit2, Trash2 } from "lucide-react";
import { useApp, InventoryItem } from "@/context/AppContext";

export default function InventoryPage() {
  const {
    data,
    userRole,
    selectedStoreId,
    currentBranchName,
    filteredInventory,
    isNearExpiry,
    fetchData,
    setShowAddModal,
    crudError,
    crudSuccess,
    setCrudError,
    setCrudSuccess,
  } = useApp();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null); // "storeId-productId"
  const [editForm, setEditForm] = useState<{
    stock_level: number;
    reorder_threshold: number;
    expiry_date: string;
  } | null>(null);

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

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditForm(null);
  };

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
      fetchData();
    } catch (err: any) {
      setCrudError(err.message || "An error occurred.");
    }
  };

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
      fetchData();
    } catch (err: any) {
      setCrudError(err.message || "An error occurred.");
    }
  };

  return (
    <section className="table-card">
      <div className="table-header">
        <div className="table-title">
          <Package size={20} style={{ color: "var(--accent-gold)" }} />
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
                  <td className="font-medium" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{item.product_name}</td>
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
                      <span style={isLow ? { color: 'var(--status-red)', fontWeight: 700 } : { color: 'var(--text-heading)', fontWeight: 500 }}>
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
                      <span style={isExp ? { color: 'var(--status-amber)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' } : { color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
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
  );
}
