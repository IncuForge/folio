"use client";

import React, { useState, useEffect } from "react";
import { useAppContext } from "@/lib/AppContext";
import { Plus, Save, Trash2, X, Calendar as CalendarIcon, Clock, Users, HelpCircle, Link, Link2Off } from "lucide-react";

export default function OrderFormView() {
  const {
    orderForm,
    setOrderForm,
    items,
    packages,
    setActiveTab,
    handleSaveOrder,
    handleUpdateChargeLine,
    handleRemoveChargeLine,
    handleAddChargeLine,
    currencySymbol
  } = useAppContext();

  // Search input per session
  const [dishSearch, setDishSearch] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await handleSaveOrder(e);
    } catch (err) {
      console.error("Failed to save order", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Ensure there is always at least one session on new order
  useEffect(() => {
    if (!orderForm.sessions || orderForm.sessions.length === 0) {
      const nextDate = orderForm.event_date || new Date().toISOString().split('T')[0];
      setOrderForm((prev: any) => ({
        ...prev,
        sessions: [
          {
            id: `session-${Date.now()}`,
            name: "Session 1",
            session_date: nextDate,
            session_time: "12:00",
            guest_count: prev.guest_count || 50,
            sync_guest_count: true,
            package_id: null,
            package_price: 0,
            notes: "",
            items: []
          }
        ]
      }));
    }
  }, [orderForm.sessions?.length ?? 0]);

  // Session Handlers
  const handleAddSession = () => {
    const nextDate = orderForm.event_date || new Date().toISOString().split('T')[0];
    const newSess = {
      id: `session-${Date.now()}`,
      name: `Session ${orderForm.sessions ? orderForm.sessions.length + 1 : 1}`,
      session_date: nextDate,
      session_time: "12:00",
      guest_count: orderForm.guest_count || 50,
      sync_guest_count: true,
      package_id: null,
      package_price: 0,
      notes: "",
      items: []
    };
    setOrderForm((prev: any) => ({
      ...prev,
      sessions: [...(prev.sessions || []), newSess]
    }));
  };

  const handleRemoveSession = (sessId: string) => {
    if (orderForm.sessions && orderForm.sessions.length <= 1) {
      alert("An event must have at least one session!");
      return;
    }
    setOrderForm((prev: any) => ({
      ...prev,
      sessions: (prev.sessions || []).filter((s: any) => s.id !== sessId)
    }));
  };

  const handleUpdateSessionField = (sessId: string, field: string, val: any) => {
    setOrderForm((prev: any) => {
      const updated = (prev.sessions || []).map((s: any) => {
        if (s.id === sessId) {
          // If guest count changes, scale package item quantities as well
          if (field === "guest_count") {
            const count = parseInt(val, 10) || 0;
            return {
              ...s,
              guest_count: count,
              items: (s.items || []).map((it: any) => ({
                ...it,
                quantity: count
              }))
            };
          }
          return { ...s, [field]: val };
        }
        return s;
      });
      return { ...prev, sessions: updated };
    });
  };

  const handleToggleSessionGuestSync = (sessId: string) => {
    setOrderForm((prev: any) => {
      const updated = (prev.sessions || []).map((s: any) => {
        if (s.id === sessId) {
          const isCurrentlySynced = s.sync_guest_count !== false;
          const nextSync = !isCurrentlySynced;
          const nextCount = nextSync ? (prev.guest_count || 50) : s.guest_count;
          return {
            ...s,
            sync_guest_count: nextSync,
            guest_count: nextCount,
            items: nextSync
              ? (s.items || []).map((it: any) => ({ ...it, quantity: nextCount }))
              : s.items
          };
        }
        return s;
      });
      return { ...prev, sessions: updated };
    });
  };

  const handleSelectSessionPackage = (sessId: string, pkgId: string | null) => {
    setOrderForm((prev: any) => {
      const updated = (prev.sessions || []).map((s: any) => {
        if (s.id === sessId) {
          let currentItems = [...(s.items || [])];

          // 1. If there was a previously selected package, remove its items from the session list
          if (s.package_id) {
            const prevPkg = packages.find(p => p.id === s.package_id);
            if (prevPkg) {
              const prevPkgItemIds = prevPkg.items?.map(it => it.id) || [];
              currentItems = currentItems.filter(it => !prevPkgItemIds.includes(it.itemId));
            }
          }

          // 2. If no new package is selected, return with empty package fields and filtered items
          if (!pkgId || pkgId === "") {
            return {
              ...s,
              package_id: null,
              package_price: 0,
              items: currentItems
            };
          }

          // 3. If a new package is selected, find it and add its items
          const pkg = packages.find((p) => p.id === pkgId);
          if (!pkg) {
            return {
              ...s,
              package_id: null,
              package_price: 0,
              items: currentItems
            };
          }

          const defaultPrice = (pkg.price !== null && pkg.price !== undefined && pkg.price > 0)
            ? pkg.price
            : (pkg.items ?? []).reduce((sum, it) => sum + (it.price || 0), 0);
          
          // Add new package items to the session checklist
          pkg.items?.forEach((pkgIt) => {
            const has = currentItems.some((it) => it.itemId === pkgIt.id);
            if (!has) {
              currentItems.push({
                itemId: pkgIt.id,
                quantity: s.guest_count || 50,
                notes: ""
              });
            }
          });

          return {
            ...s,
            package_id: pkgId,
            package_price: defaultPrice,
            items: currentItems
          };
        }
        return s;
      });
      return { ...prev, sessions: updated };
    });
  };

  const handleToggleSessionItem = (sessId: string, itemId: string) => {
    setOrderForm((prev: any) => {
      const updated = (prev.sessions || []).map((s: any) => {
        if (s.id === sessId) {
          const itemsList = [...(s.items || [])];
          const idx = itemsList.findIndex((it) => it.itemId === itemId);
          if (idx >= 0) {
            itemsList.splice(idx, 1);
          } else {
            const item = items.find(i => i.id === itemId);
            if (item && !item.is_available) {
              alert(`⚠️ Note: "${item.name}" is currently marked as out of season/unavailable.`);
            }
            itemsList.push({
              itemId,
              quantity: s.guest_count || 50,
              notes: ""
            });
          }
          return { ...s, items: itemsList };
        }
        return s;
      });
      return { ...prev, sessions: updated };
    });
  };

  const handleUpdateSessionItemQty = (sessId: string, itemId: string, qty: number) => {
    setOrderForm((prev: any) => {
      const updated = (prev.sessions || []).map((s: any) => {
        if (s.id === sessId) {
          return {
            ...s,
            items: (s.items || []).map((it: any) => 
              it.itemId === itemId ? { ...it, quantity: qty } : it
            )
          };
        }
        return s;
      });
      return { ...prev, sessions: updated };
    });
  };

  const handleUpdateSessionItemNotes = (sessId: string, itemId: string, notes: string) => {
    setOrderForm((prev: any) => {
      const updated = (prev.sessions || []).map((s: any) => {
        if (s.id === sessId) {
          return {
            ...s,
            items: (s.items || []).map((it: any) => 
              it.itemId === itemId ? { ...it, notes } : it
            )
          };
        }
        return s;
      });
      return { ...prev, sessions: updated };
    });
  };

  // Calculations per Session helper
  const getSessionCosts = (session: any) => {
    const pkg = packages.find(p => p.id === session.package_id);
    const pkgItemIds = new Set(pkg?.items?.map(it => it.id) || []);

    let pkgCost = 0;
    if (session.package_id) {
      pkgCost = (Number(session.package_price) || 0) * (Number(session.guest_count) || 0);
    }

    let extraCost = 0;
    const sessionItems = session.items || [];
    for (const it of sessionItems) {
      if (!session.package_id || !pkgItemIds.has(it.itemId)) {
        const dish = items.find(d => d.id === it.itemId);
        extraCost += (dish?.price || 0) * (it.quantity || 0);
      }
    }

    return {
      pkgCost,
      extraCost,
      total: pkgCost + extraCost
    };
  };

  // Financial Summaries
  const suggestedMenuCost = (orderForm.sessions || []).reduce((sum, s) => {
    return sum + getSessionCosts(s).total;
  }, 0);

  const discountPercent = Number(orderForm.discount_percent) || 0;
  const discountAmount = suggestedMenuCost * (discountPercent / 100);
  const discountedMenuCost = suggestedMenuCost - discountAmount;

  const additionalChargesSum = (orderForm.additional_charges || []).reduce(
    (sum, c) => sum + (c.amount || 0),
    0
  );

  const suggestedTotal = discountedMenuCost + additionalChargesSum;

  const scheduledPaymentsTotal =
    (Number(orderForm.booking_amount) || 0) +
    (Number(orderForm.second_amount) || 0) +
    (Number(orderForm.final_amount) || 0);

  return (
    <div className="order-form-container">
      <header>
        <h1 className="order-form-title">
          {orderForm.id ? "Edit Order & Sessions" : "Place New Order"}
        </h1>
        <p className="order-form-subtitle">
          Manage client details, event sessions, menus, and financial milestones.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="order-form order-form-two-cols">
        {/* Left Column: General info, Financials, and Payments */}
        <div className="order-form-sidebar">
          {/* Metadata Card */}
          <div className="glass-card form-panel">
            <h3 className="panel-title">Event Metadata</h3>

            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input
                className="form-input"
                type="text"
                required
                value={orderForm.client_name}
                onChange={(e) => setOrderForm({ ...orderForm, client_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Client Phone</label>
              <input
                className="form-input"
                type="tel"
                value={orderForm.client_phone}
                onChange={(e) => setOrderForm({ ...orderForm, client_phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Name / Occasion *</label>
              <input
                className="form-input"
                type="text"
                required
                placeholder="e.g. Wedding Reception"
                value={orderForm.event_name}
                onChange={(e) => setOrderForm({ ...orderForm, event_name: e.target.value })}
              />
            </div>

            <div className="form-row-2-cols">
              <div className="form-group">
                <label className="form-label">Event Start Date *</label>
                <input
                  className="form-input"
                  type="date"
                  required
                  value={orderForm.event_date}
                  onChange={(e) => {
                    const start = e.target.value;
                    const end = orderForm.event_end_date;
                    setOrderForm((prev: any) => {
                      const updatedSessions = (prev.sessions || []).map((s: any) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        if (!s.session_date || s.session_date === prev.event_date || s.session_date === todayStr || s.session_date === "2026-06-30") {
                          return { ...s, session_date: start };
                        }
                        return s;
                      });
                      if (end && end < start) {
                        return { ...prev, event_date: start, event_end_date: start, sessions: updatedSessions };
                      }
                      return { ...prev, event_date: start, sessions: updatedSessions };
                    });
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Event End Date *</label>
                <input
                  className="form-input"
                  type="date"
                  required
                  value={orderForm.event_end_date || orderForm.event_date || ""}
                  min={orderForm.event_date}
                  onChange={(e) => {
                    const end = e.target.value;
                    if (end && end < orderForm.event_date) {
                      alert("End date cannot be before start date!");
                    } else {
                      setOrderForm({ ...orderForm, event_end_date: end });
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Venue Location</label>
              <input
                className="form-input"
                type="text"
                value={orderForm.venue || ""}
                onChange={(e) => setOrderForm({ ...orderForm, venue: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estimated Guest Count (Overall)</label>
              <input
                className="form-input"
                type="number"
                value={orderForm.guest_count}
                onChange={(e) => {
                  const count = parseInt(e.target.value, 10) || 0;
                  setOrderForm((prev: any) => {
                    const updatedSessions = (prev.sessions || []).map((s: any) => {
                      if (s.sync_guest_count !== false) {
                        return {
                          ...s,
                          guest_count: count,
                          items: (s.items || []).map((it: any) => ({
                            ...it,
                            quantity: count
                          }))
                        };
                      }
                      return s;
                    });
                    return {
                      ...prev,
                      guest_count: count,
                      sessions: updatedSessions
                    };
                  });
                }}
              />
            </div>
          </div>

          {/* Additional Charges */}
          <div className="glass-card form-panel">
            <h3 className="panel-title">Additional Charges</h3>
            <div className="additional-charges-list">
              {orderForm.additional_charges.map((charge, idx) => (
                <div key={idx} className="additional-charge-row">
                  <input
                    className="form-input charge-label-input"
                    type="text"
                    placeholder="e.g. Transport"
                    value={charge.label}
                    onChange={(e) => handleUpdateChargeLine(idx, e.target.value, charge.amount)}
                  />
                  <input
                    className="form-input charge-amount-input"
                    type="number"
                    value={charge.amount}
                    onChange={(e) => handleUpdateChargeLine(idx, charge.label, parseFloat(e.target.value) || 0)}
                  />
                  <button 
                    type="button" 
                    className="btn-delete-charge"
                    onClick={() => handleRemoveChargeLine(idx)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button 
              type="button" 
              className="btn btn-secondary btn-full-width" 
              onClick={handleAddChargeLine}
            >
              <Plus size={16} /> Add Charge Line
            </button>
          </div>

          {/* Financial Estimates Card */}
          <div className="glass-card form-panel">
            <h3 className="panel-title">Financial Estimate</h3>
            <div className="totals-breakdown-list">
              <div className="totals-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Base Menu Cost:</span>
                  <span className="totals-value"><strong>{currencySymbol}{suggestedMenuCost}</strong></span>
                </div>
                {/* Session breakdown list */}
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "flex", flexDirection: "column", gap: "0.25rem", borderLeft: "2px solid var(--border-ink)", paddingLeft: "0.5rem", marginTop: "0.25rem" }}>
                  {(orderForm.sessions || []).map((s, index) => {
                    const costs = getSessionCosts(s);
                    return (
                      <div key={s.id || index} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{s.name || `Session ${index + 1}`}:</span>
                        <span>{currencySymbol}{costs.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="totals-row" style={{ alignItems: "center", justifyContent: "space-between", margin: "0.25rem 0" }}>
                <span>Discount Percentage:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    className="form-input"
                    value={orderForm.discount_percent || 0}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                      setOrderForm((prev: any) => ({ ...prev, discount_percent: val }));
                    }}
                    style={{ width: "70px", padding: "0.15rem 0.35rem", fontSize: "0.8rem", textAlign: "right" }}
                  />
                  <span style={{ fontSize: "0.85rem" }}>%</span>
                </div>
              </div>
              {discountPercent > 0 && (
                <div className="totals-row" style={{ color: "var(--color-success, #2e7d32)", fontWeight: "500" }}>
                  <span>Discount ({discountPercent}%):</span>
                  <span className="totals-value">-{currencySymbol}{discountAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="totals-row">
                <span>Additional Charges:</span>
                <span className="totals-value">{currencySymbol}{additionalChargesSum}</span>
              </div>
              <div className="totals-row estimated-total-row">
                <span>Estimated Total:</span>
                <span>{currencySymbol}{suggestedTotal}</span>
              </div>
            </div>

            {Math.abs(suggestedTotal - scheduledPaymentsTotal) > 0.01 && (
              <div className="alert-box alert-warning">
                ⚠️ Note: The sum of scheduled milestone payments ({currencySymbol}{scheduledPaymentsTotal}) does not match the estimated total ({currencySymbol}{suggestedTotal}). Make sure to adjust the payments below.
              </div>
            )}
          </div>

          {/* Payments Milestone */}
          <div className="glass-card form-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
              <h3 className="panel-title" style={{ margin: 0 }}>Milestone Payments</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const targets: string[] = [];
                  if (orderForm.booking_paid) targets.push("booking_amount");
                  if (orderForm.second_paid) targets.push("second_amount");
                  if (orderForm.final_paid) targets.push("final_amount");

                  if (targets.length === 0) {
                    const half = Math.round(suggestedTotal / 2);
                    setOrderForm((prev: any) => ({
                      ...prev,
                      booking_paid: true,
                      final_paid: true,
                      booking_amount: half,
                      final_amount: suggestedTotal - half,
                      second_amount: 0
                    }));
                  } else {
                    const portion = Math.floor(suggestedTotal / targets.length);
                    setOrderForm((prev: any) => {
                      const next = { ...prev };
                      let accumulated = 0;
                      targets.forEach((field, idx) => {
                        if (idx === targets.length - 1) {
                          next[field] = suggestedTotal - accumulated;
                        } else {
                          next[field] = portion;
                          accumulated += portion;
                        }
                      });
                      if (!prev.booking_paid) next.booking_amount = 0;
                      if (!prev.second_paid) next.second_amount = 0;
                      if (!prev.final_paid) next.final_amount = 0;
                      return next;
                    });
                  }
                }}
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}
              >
                Auto-Balance
              </button>
            </div>
            
            {/* Booking Payment */}
            <div className="milestone-payment-group">
              <label className="milestone-label-wrapper">
                <input
                  type="checkbox"
                  className="rounded-checkbox"
                  checked={orderForm.booking_paid}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOrderForm((prev: any) => ({ ...prev, booking_paid: checked }));
                  }}
                />
                <span>1st Payment (Booking Deposit)</span>
              </label>
              <div className="milestone-inputs-row">
                <div className="milestone-amount-wrapper">
                  <span className="milestone-amount-label">Amount: {currencySymbol}</span>
                  <input
                    className="form-input milestone-amount-input"
                    type="number"
                    value={orderForm.booking_amount === 0 ? "" : orderForm.booking_amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrderForm((prev: any) => ({
                        ...prev,
                        booking_amount: val === "" ? 0 : (parseFloat(val) || 0)
                      }));
                    }}
                  />
                </div>
                <input
                  className="form-input milestone-notes-input"
                  type="text"
                  placeholder="Notes (e.g. Cash, GPay)"
                  value={orderForm.booking_payment_notes || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOrderForm((prev: any) => ({ ...prev, booking_payment_notes: val }));
                  }}
                />
              </div>
            </div>

            {/* Second Payment */}
            <div className="milestone-payment-group">
              <label className="milestone-label-wrapper">
                <input
                  type="checkbox"
                  className="rounded-checkbox"
                  checked={orderForm.second_paid}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOrderForm((prev: any) => ({ ...prev, second_paid: checked }));
                  }}
                />
                <span>2nd Payment (Midway/Optional)</span>
              </label>
              <div className="milestone-inputs-row">
                <div className="milestone-amount-wrapper">
                  <span className="milestone-amount-label">Amount: {currencySymbol}</span>
                  <input
                    className="form-input milestone-amount-input"
                    type="number"
                    value={orderForm.second_amount === 0 ? "" : orderForm.second_amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrderForm((prev: any) => ({
                        ...prev,
                        second_amount: val === "" ? 0 : (parseFloat(val) || 0)
                      }));
                    }}
                  />
                </div>
                <input
                  className="form-input milestone-notes-input"
                  type="text"
                  placeholder="Notes (e.g. UPI)"
                  value={orderForm.second_payment_notes || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOrderForm((prev: any) => ({ ...prev, second_payment_notes: val }));
                  }}
                />
              </div>
            </div>

            {/* Final Payment */}
            <div className="milestone-payment-group last">
              <label className="milestone-label-wrapper">
                <input
                  type="checkbox"
                  className="rounded-checkbox"
                  checked={orderForm.final_paid}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOrderForm((prev: any) => ({ ...prev, final_paid: checked }));
                  }}
                />
                <span>Final Payment (Settlement)</span>
              </label>
              <div className="milestone-inputs-row">
                <div className="milestone-amount-wrapper">
                  <span className="milestone-amount-label">Amount: {currencySymbol}</span>
                  <input
                    className="form-input milestone-amount-input"
                    type="number"
                    value={orderForm.final_amount === 0 ? "" : orderForm.final_amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrderForm((prev: any) => ({
                        ...prev,
                        final_amount: val === "" ? 0 : (parseFloat(val) || 0)
                      }));
                    }}
                  />
                </div>
                <input
                  className="form-input milestone-notes-input"
                  type="text"
                  placeholder="Notes (e.g. Cash)"
                  value={orderForm.final_payment_notes || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOrderForm((prev: any) => ({ ...prev, final_payment_notes: val }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status & General Notes */}
          <div className="glass-card form-panel">
            <h3 className="panel-title">Status & Notes</h3>

            <div className="form-group">
              <label className="form-label">General Event Notes</label>
              <textarea
                className="form-input text-area"
                rows={3}
                placeholder="Overall event instructions..."
                value={orderForm.notes || ""}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Life Status</label>
              <select 
                className="form-input" 
                value={orderForm.status}
                onChange={(e) => {
                  const nextStatus = e.target.value;
                  if (nextStatus === "cancelled" && orderForm.id) {
                    const eventDate = new Date(orderForm.event_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    eventDate.setHours(0, 0, 0, 0);
                    const diffTime = eventDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 3) {
                       const confirmCancel = confirm(`⚠️ Warning: This event is in less than 3 days. Sourced ingredients might go to waste. Do you still want to set status to Cancelled?`);
                       if (!confirmCancel) return;
                    }
                  }
                  setOrderForm({ ...orderForm, status: nextStatus });
                }}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="form-actions-wrapper" style={{ gap: "0.75rem" }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
              onClick={() => setActiveTab("orders")}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSaving}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              <Save size={16} /> {isSaving ? "Saving..." : "Save Order"}
            </button>
          </div>
        </div>

        {/* Right Column: Sessions stack */}
        <div className="order-form-main-content">
          <div className="glass-card form-panel">
            <div className="flex-align-center-gap" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h3 className="panel-title" style={{ margin: 0 }}>Event Sessions / Meals</h3>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                  Add multiple sessions, allocate packages, and construct custom menus per session.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddSession}
                style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                <Plus size={16} /> Add Session
              </button>
            </div>

            <div className="sessions-list-stack" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>
              {(orderForm.sessions || []).map((session, sIdx) => {
                const costs = getSessionCosts(session);
                const pkg = packages.find((p) => p.id === session.package_id);
                const pkgItemIds = new Set(pkg?.items?.map(it => it.id) || []);

                const sessionItems = session.items || [];
                const packageDishes = sessionItems.filter((it: any) => pkgItemIds.has(it.itemId));
                const extraDishes = sessionItems.filter((it: any) => !pkgItemIds.has(it.itemId));

                return (
                  <div key={session.id || sIdx} className="session-card-editor">
                    {/* Session Editor Header */}
                    <div className="session-card-editor-header">
                      <div className="session-card-title">
                        <CalendarIcon size={16} />
                        <input
                          type="text"
                          className="form-input"
                          value={session.name}
                          onChange={(e) => handleUpdateSessionField(session.id, "name", e.target.value)}
                          style={{ border: "none", background: "transparent", fontWeight: 600, fontSize: "1.05rem", padding: 0, width: "200px" }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-delete-charge"
                        onClick={() => handleRemoveSession(session.id)}
                        style={{ color: "var(--ink-muted)", border: "none", background: "transparent", cursor: "pointer" }}
                        title="Remove Session"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Session Inputs Row */}
                    <div className="form-row-3-cols">
                      <div className="form-group">
                        <label className="form-label">Session Date</label>
                        <input
                          type="date"
                          className="form-input"
                          required
                          value={session.session_date}
                          min={orderForm.event_date}
                          max={orderForm.event_end_date || undefined}
                          onChange={(e) => handleUpdateSessionField(session.id, "session_date", e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Session Time</label>
                        <input
                          type="time"
                          className="form-input"
                          value={session.session_time || ""}
                          onChange={(e) => handleUpdateSessionField(session.id, "session_time", e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Guest Count</label>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ flexGrow: 1 }}
                            value={session.guest_count}
                            disabled={session.sync_guest_count !== false}
                            onChange={(e) => handleUpdateSessionField(session.id, "guest_count", parseInt(e.target.value, 10) || 0)}
                          />
                          <button
                            type="button"
                            className={`btn ${session.sync_guest_count !== false ? "btn-primary" : "btn-secondary"}`}
                            style={{ padding: "0.25rem 0.50rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onClick={() => handleToggleSessionGuestSync(session.id)}
                            title={session.sync_guest_count !== false ? "Linked to overall guest count (Click to unlock)" : "Unlinked (Click to lock to overall guest count)"}
                          >
                            {session.sync_guest_count !== false ? <Link size={16} /> : <Link2Off size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Session Package Selector */}
                    <div className="form-row-2-cols" style={{ borderTop: "1px dashed var(--border-ink)", paddingTop: "1rem", marginTop: "0.25rem" }}>
                      <div className="form-group">
                        <label className="form-label">Select Package for this Session</label>
                        <select
                          className="form-input"
                          value={session.package_id || ""}
                          onChange={(e) => handleSelectSessionPackage(session.id, e.target.value || null)}
                        >
                          <option value="">-- No Package (Custom Dishes Only) --</option>
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({currencySymbol}{p.price || "Dishes Sum"}/plate)
                            </option>
                          ))}
                        </select>
                      </div>
                      {session.package_id && (
                        <div className="form-group">
                          <label className="form-label">Package Plate Price Override</label>
                          <input
                            type="number"
                            className="form-input"
                            value={session.package_price || 0}
                            onChange={(e) => handleUpdateSessionField(session.id, "package_price", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Search & Add Dishes */}
                    <div className="form-group" style={{ position: "relative", borderTop: "1px dashed var(--border-ink)", paddingTop: "1rem" }}>
                      <label className="form-label">Search & Add Dishes to {session.name}</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search food item by name..."
                        value={dishSearch[session.id] || ""}
                        onChange={(e) => setDishSearch({ ...dishSearch, [session.id]: e.target.value })}
                      />
                      {dishSearch[session.id] && (
                        <div className="search-results-dropdown" style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          maxHeight: "180px",
                          overflowY: "auto",
                          background: "var(--bg-app)",
                          border: "1px solid var(--border-ink)",
                          borderRadius: "var(--radius-sm)",
                          zIndex: 10,
                          boxShadow: "var(--shadow-md)"
                        }}>
                          {items
                            .filter(it => it.name.toLowerCase().includes((dishSearch[session.id] || "").toLowerCase()))
                            .map((it: any) => {
                              const isSelected = (session.items || []).some((x: any) => x.itemId === it.id);
                              return (
                                <div
                                  key={it.id}
                                  onClick={() => {
                                    handleToggleSessionItem(session.id, it.id);
                                    setDishSearch({ ...dishSearch, [session.id]: "" });
                                  }}
                                  style={{
                                    padding: "0.5rem 0.75rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    borderBottom: "1px solid var(--border-ink)",
                                    background: isSelected ? "var(--bg-card-hover)" : "transparent"
                                  }}
                                >
                                  <span style={{ fontSize: "0.8rem", color: isSelected ? "var(--ink-main)" : "var(--ink-muted)" }}>
                                    {it.name} <span style={{ color: "var(--ink-muted)", fontSize: "0.7rem" }}>({it.type})</span>
                                  </span>
                                  <span style={{ fontSize: "0.75rem", fontWeight: "bold" }}>
                                    {currencySymbol}{it.price || 0}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Session Dishes list (Package included items & Extra items) */}
                    <div className="session-dishes-list">
                      {/* Package Included items */}
                      {session.package_id && packageDishes.length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", color: "var(--ink-muted)", marginBottom: "0.5rem" }}>
                            Package Included Items ({pkg?.name})
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {packageDishes.map((formIt: any) => {
                              const dish = items.find(d => d.id === formIt.itemId);
                              if (!dish) return null;
                              return (
                                <div key={formIt.itemId} className="selected-dish-item-card pkg-included" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <strong style={{ fontSize: "0.8rem" }}>{dish.name}</strong>
                                    <button
                                      type="button"
                                      className="btn-remove-item"
                                      onClick={() => handleToggleSessionItem(session.id, formIt.itemId)}
                                      style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="card-row" style={{ gap: "0.5rem" }}>
                                    <span style={{ fontSize: "0.75rem" }}>Qty:</span>
                                    <input
                                      type="number"
                                      className="form-input qty-input"
                                      value={formIt.quantity}
                                      onChange={(e) => handleUpdateSessionItemQty(session.id, formIt.itemId, parseInt(e.target.value, 10) || 0)}
                                      style={{ padding: "0.15rem 0.35rem", fontSize: "0.75rem", width: "70px" }}
                                    />
                                    <input
                                      type="text"
                                      className="form-input notes-input"
                                      placeholder="Notes (e.g. less spicy)"
                                      value={formIt.notes || ""}
                                      onChange={(e) => handleUpdateSessionItemNotes(session.id, formIt.itemId, e.target.value)}
                                      style={{ padding: "0.15rem 0.35rem", fontSize: "0.75rem" }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Custom/Extra Items */}
                      <div>
                        <span style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", color: "var(--ink-muted)", marginBottom: "0.5rem" }}>
                          {session.package_id ? "Extra / Additional Items" : "Selected Dishes"}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {extraDishes.map((formIt: any) => {
                            const dish = items.find(d => d.id === formIt.itemId);
                            if (!dish) return null;
                            return (
                              <div key={formIt.itemId} className="selected-dish-item-card extra-dish" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <strong style={{ fontSize: "0.8rem" }}>{dish.name}</strong>
                                    <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>{currencySymbol}{dish.price || 0}/plate</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn-remove-item"
                                    onClick={() => handleToggleSessionItem(session.id, formIt.itemId)}
                                    style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="card-row" style={{ gap: "0.5rem" }}>
                                  <span style={{ fontSize: "0.75rem" }}>Qty:</span>
                                  <input
                                    type="number"
                                    className="form-input qty-input"
                                    value={formIt.quantity}
                                    onChange={(e) => handleUpdateSessionItemQty(session.id, formIt.itemId, parseInt(e.target.value, 10) || 0)}
                                    style={{ padding: "0.15rem 0.35rem", fontSize: "0.75rem", width: "70px" }}
                                  />
                                  <input
                                    type="text"
                                    className="form-input notes-input"
                                    placeholder="Notes (e.g. less spicy)"
                                    value={formIt.notes || ""}
                                    onChange={(e) => handleUpdateSessionItemNotes(session.id, formIt.itemId, e.target.value)}
                                    style={{ padding: "0.15rem 0.35rem", fontSize: "0.75rem" }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {extraDishes.length === 0 && (
                            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", padding: "0.25rem 0.5rem" }}>
                              No custom dishes added to this session.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Session Notes */}
                    <div className="form-group" style={{ borderTop: "1px dashed var(--border-ink)", paddingTop: "0.75rem" }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Session Notes (e.g. dietary complications for this meal)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Vegetarian only, peanut allergy warning"
                        value={session.notes || ""}
                        onChange={(e) => handleUpdateSessionField(session.id, "notes", e.target.value)}
                        style={{ fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                      />
                    </div>

                    {/* Session Cost Summary */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card-hover)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-ink)", marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>Session Total:</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{currencySymbol}{costs.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
