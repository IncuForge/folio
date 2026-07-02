"use client";

import React from "react";
import { useAppContext } from "@/lib/AppContext";
import { 
  calculateTotalOrderCost, 
  calculatePendingOrderCost, 
  calculateBaseMenuCostOnly,
  getOrderPaymentStatusClass, 
  getOrderPaymentStatusLabel,
  isTruthy
} from "@/lib/date-utils";
import { 
  Edit2, 
  FileText, 
  Flame, 
  Trash2, 
  Printer, 
  X, 
  AlertTriangle,
  User,
  Phone,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  ChefHat,
  Receipt
} from "lucide-react";

export default function ModalOverlays() {
  const {
    selectedOrder,
    setSelectedOrder,
    cancellationLockModal,
    setCancellationLockModal,
    printMenuOrder,
    setPrintMenuOrder,
    kitchenSheetOrder,
    setKitchenSheetOrder,
    handleEditOrder,
    handleDeleteOrder,
    currentUser,
    fetchOrders,
    packages,
    items,
    pdfBrandName,
    currencySymbol,
    paymentMethods,
  } = useAppContext();



  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedOrder) setSelectedOrder(null);
        if (printMenuOrder) setPrintMenuOrder(null);
        if (kitchenSheetOrder) setKitchenSheetOrder(null);
        if (cancellationLockModal) setCancellationLockModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOrder, printMenuOrder, kitchenSheetOrder, cancellationLockModal]);

  React.useEffect(() => {
    if (printMenuOrder) {
      const timer = setTimeout(() => {
        window.print();
        setPrintMenuOrder(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [printMenuOrder, setPrintMenuOrder]);

  React.useEffect(() => {
    if (kitchenSheetOrder) {
      const timer = setTimeout(() => {
        window.print();
        setKitchenSheetOrder(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [kitchenSheetOrder, setKitchenSheetOrder]);

  const [editingMilestone, setEditingMilestone] = React.useState<"booking" | "second" | "final" | null>(null);
  const [payDate, setPayDate] = React.useState("");
  const [payMode, setPayMode] = React.useState("UPI");
  const [payComment, setPayComment] = React.useState("");

  const parsePaymentNotes = (notesString: string) => {
    try {
      if (notesString && notesString.trim().startsWith("{")) {
        const parsed = JSON.parse(notesString);
        return {
          date: parsed.date || "",
          mode: parsed.mode || "UPI",
          comment: parsed.comment || "",
          isStructured: true
        };
      }
    } catch (e) {
      // Ignore
    }
    return {
      date: "",
      mode: "UPI",
      comment: notesString || "",
      isStructured: false
    };
  };

  const renderPaymentNotes = (notesString: string) => {
    const details = parsePaymentNotes(notesString);
    if (details.isStructured) {
      return (
        <div className="text-muted-color text-xs mt-1">
          <div><span className="font-semibold text-[var(--ink)]">Cleared Date:</span> {details.date || "N/A"} &bull; <span className="font-semibold text-[var(--ink)]">Mode:</span> {details.mode}</div>
          {details.comment && <div><span className="font-semibold text-[var(--ink)]">Ref / Notes:</span> {details.comment}</div>}
        </div>
      );
    }
    return (
      notesString && (
        <div className="text-muted-color text-xs mt-1">
          <span className="font-semibold text-[var(--ink)]">Ref:</span> {notesString}
        </div>
      )
    );
  };

  const startEditPayment = (milestone: "booking" | "second" | "final", notesString: string) => {
    const details = parsePaymentNotes(notesString);
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    setPayDate(details.date || todayStr);
    setPayMode(details.mode || "UPI");
    setPayComment(details.comment || "");
    setEditingMilestone(milestone);
  };

  const handleSavePaymentDetails = async (milestone: "booking" | "second" | "final") => {
    if (!selectedOrder) return;
    try {
      const compiledNotes = JSON.stringify({
        date: payDate,
        mode: payMode,
        comment: payComment
      });

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [`${milestone}_paid`]: true,
          [`${milestone}_payment_notes`]: compiledNotes
        }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setSelectedOrder(updatedOrder);
        setEditingMilestone(null);
        fetchOrders();
      }
    } catch (e) {
      console.error("Error saving payment details", e);
    }
  };

  const handleResetPayment = async (milestone: "booking" | "second" | "final") => {
    if (!selectedOrder) return;
    if (!confirm("Are you sure you want to mark this milestone as Unpaid?")) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [`${milestone}_paid`]: false,
          [`${milestone}_payment_notes`]: ""
        }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setSelectedOrder(updatedOrder);
        fetchOrders();
      }
    } catch (e) {
      console.error("Error resetting payment status", e);
    }
  };

  const isManager = currentUser?.role === "manager";

  // Recipe helper ingredients scales
  const scaleIngredientsText = (ingredientsText: string, guestCount: number): string => {
    if (!ingredientsText) return "As required";
    const parts = ingredientsText.split(",");
    return parts
      .map((part) => {
        const trimmed = part.trim();
        const match = trimmed.match(/^([\d.]+)\s*([a-zA-Z]*)\s+(.+)$/);
        if (match) {
          const qty = parseFloat(match[1]);
          const unit = match[2];
          const name = match[3];
          const scaledQty = qty * guestCount;

          if (unit.toLowerCase() === "g" && scaledQty >= 1000) {
            return `${(scaledQty / 1000).toFixed(2).replace(/\.00$/, "")} kg ${name}`;
          }
          if (unit.toLowerCase() === "ml" && scaledQty >= 1000) {
            return `${(scaledQty / 1000).toFixed(2).replace(/\.00$/, "")} L ${name}`;
          }
          return `${scaledQty.toFixed(1).replace(/\.0$/, "")} ${unit} ${name}`;
        }
        return `${trimmed} (As required)`;
      })
      .join(", ");
  };

  const renderMenuTemplate = (order: any) => {
    if (!order) return null;

    const brand = pdfBrandName || "Cater Flow Premium Catering";
    
    const getBillPaymentText = (paid: boolean, amount: number, notesString: string) => {
      const formattedAmount = Number(amount || 0).toLocaleString("en-IN");
      if (!paid) return `${currencySymbol}${formattedAmount} Pending`;
      const details = parsePaymentNotes(notesString);
      if (details.isStructured) {
        const modeLabel = details.mode ? ` via ${details.mode}` : "";
        const dateLabel = details.date ? ` on ${details.date}` : "";
        return `${currencySymbol}${formattedAmount} Paid${modeLabel}${dateLabel}`;
      }
      return `${currencySymbol}${formattedAmount} Paid`;
    };

    // Bill calculation values
    const selectedPkg = packages?.find((p) => p.id === order.package_id);
    const pkgItemIds = new Set(selectedPkg?.items?.map((it) => it.id) || []);

    const booking_paid = isTruthy(order.booking_paid);
    const second_paid = isTruthy(order.second_paid);
    const final_paid = isTruthy(order.final_paid);

    const paidAmount = 
      (booking_paid ? (Number(order.booking_amount) || 0) : 0) +
      (second_paid ? (Number(order.second_amount) || 0) : 0) +
      (final_paid ? (Number(order.final_amount) || 0) : 0);

    return (
      <div className="print-presentation-wrapper">
        {/* Bill invoice page (appended to the end, styled as a separate printable page) */}
        <div className="print-bill-page">
          <table className="print-layout-table">
            <thead>
              <tr>
                <td>
                  <div className="print-page-header-spacer"></div>
                  <header className="bill-header">
                    <div className="bill-logo-section">
                      <h2 className="bill-brand-title">{brand}</h2>
                      <span className="bill-brand-tag">by Folio - built by <a href="https://incuforge.pages.dev/" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>IncuForge</a> @ 2026</span>
                    </div>
                    <div className="bill-invoice-title">
                      <h1>EVENT RECEIPT</h1>
                      <span className="invoice-date">Date: {new Date().toLocaleDateString("en-IN")}</span>
                    </div>
                  </header>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="bill-content-wrapper">

                    <div className="bill-client-details-grid">
                      <div className="bill-details-card">
                        <h3>Client Information</h3>
                        <p><strong>Name:</strong> {order.client_name}</p>
                        {order.client_phone && <p><strong>Phone:</strong> {order.client_phone}</p>}
                      </div>
                      <div className="bill-details-card">
                        <h3>Booking Details</h3>
                        <p><strong>Occasion:</strong> {order.event_name}</p>
                        <p><strong>Date / Time:</strong> {order.event_date} {order.event_time ? `@ ${order.event_time}` : ""}</p>
                        <p><strong>Venue:</strong> {order.venue || "To Be Decided"}</p>
                        <p><strong>Guest Count:</strong> {order.guest_count} guests</p>
                      </div>
                    </div>

                    <div className="bill-items-table-section">
                      <h3>Menu &amp; Service Cost Breakdown</h3>
                      <table className="bill-table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th className="text-center">Qty / Guests</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">Total</th>
                          </tr>
                        </thead>
                        {Array.isArray(order.sessions) && order.sessions.length > 0 ? (
                          order.sessions.map((session: any, sIdx: number) => {
                            const sessPkg = packages?.find((p) => p.id === session.package_id);
                            const sessPkgItemIds = new Set(sessPkg?.items?.map((it) => it.id) || []);
                            
                            const sessionItems = session.items || [];
                            const pkgDishes = sessionItems.filter((it: any) => sessPkgItemIds.has(it.itemId));
                            const extraDishes = sessionItems.filter((it: any) => !sessPkgItemIds.has(it.itemId));

                            return (
                              <tbody key={session.id || sIdx} className="bill-session-group">
                                {/* Session Header Row */}
                                <tr className="bill-session-header-row">
                                  <td colSpan={4} className="bill-session-header-cell">
                                    Session: {session.name} ({session.session_date} {session.session_time ? `@ ${session.session_time}` : ""}) — {session.guest_count} Guests
                                  </td>
                                </tr>

                                {/* Package Row (if set for this session) */}
                                {session.package_id && (
                                  <>
                                    <tr className="bill-table-package-row">
                                      <td className="bill-package-name-cell">
                                        <strong>Catering Package Set:</strong> {sessPkg?.name || "Standard Bundle"}
                                      </td>
                                      <td className="text-center">{session.guest_count}</td>
                                      <td className="text-right">{currencySymbol}{Number(session.package_price || 0).toLocaleString("en-IN")}</td>
                                      <td className="text-right">{currencySymbol}{((Number(session.package_price) || 0) * (session.guest_count || 0)).toLocaleString("en-IN")}</td>
                                    </tr>
                                    {pkgDishes.length > 0 && (
                                      <tr className="bill-table-package-items-summary-row">
                                        <td colSpan={4} className="bill-table-included-dishes-cell">
                                          <strong>Included Dishes:</strong> {pkgDishes.map((it: any) => {
                                            const dish = items?.find((d) => d.id === it.itemId);
                                            return dish?.name || it.itemId;
                                          }).join(", ")}
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                )}

                                {/* Extra Custom Dishes for this session */}
                                {extraDishes.map((it: any) => {
                                  const dish = items?.find((d) => d.id === it.itemId);
                                  const matchedItem = order.items?.find((oi: any) => oi.item_id === it.itemId);
                                  const price = Number(matchedItem?.price || dish?.price || 0);
                                  return (
                                    <tr key={it.itemId} className="bill-table-additional-row">
                                      <td className="bill-additional-name-cell">
                                        <strong>{dish?.name || it.itemId}</strong>
                                        {it.notes && <div className="bill-item-notes-text">Note: {it.notes}</div>}
                                      </td>
                                      <td className="text-center">{it.quantity}</td>
                                      <td className="text-right">{currencySymbol}{price.toLocaleString("en-IN")}</td>
                                      <td className="text-right">{currencySymbol}{(price * it.quantity).toLocaleString("en-IN")}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            );
                          })
                        ) : (
                          <tbody className="bill-session-group">
                            {/* Backward compatibility: no sessions */}
                            {order.package_id && (
                              <>
                                <tr className="bill-table-package-row">
                                  <td>
                                    <strong>Catering Package Set:</strong> {selectedPkg?.name || "Standard Bundle"}
                                  </td>
                                  <td className="text-center">{order.guest_count}</td>
                                  <td className="text-right">{currencySymbol}{Number(order.package_price || 0).toLocaleString("en-IN")}</td>
                                  <td className="text-right">{currencySymbol}{((Number(order.package_price) || 0) * (order.guest_count || 0)).toLocaleString("en-IN")}</td>
                                </tr>
                                {order.items && order.items.length > 0 && (
                                  <tr className="bill-table-package-items-summary-row">
                                    <td colSpan={4} className="bill-table-included-dishes-cell">
                                      <strong>Included Dishes:</strong> {order.items.map((it: any) => it.name).join(", ")}
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </tbody>
                        )}

                        {/* Additional charges */}
                        {Array.isArray(order.additional_charges) && order.additional_charges.length > 0 && (
                          <tbody className="bill-additional-charges-group">
                            {order.additional_charges.map((c: any, idx: number) => (
                              <tr key={idx} className="bill-additional-charge-row">
                                <td><strong>Service / Fee:</strong> {c.label}</td>
                                <td className="text-center">1</td>
                                <td className="text-right">{currencySymbol}{Number(c.amount || 0).toLocaleString("en-IN")}</td>
                                <td className="text-right">{currencySymbol}{Number(c.amount || 0).toLocaleString("en-IN")}</td>
                              </tr>
                            ))}
                          </tbody>
                        )}
                      </table>
                    </div>

                    <div className="bill-summary-layout">
                      <div className="bill-milestones-column">
                        <h3>Milestone Payments Log</h3>
                        <div className="bill-milestone-row">
                          <span>1st Payment (Booking Deposit):</span>
                          <span className={order.booking_paid ? "paid-text" : "pending-text"}>
                            {getBillPaymentText(order.booking_paid, order.booking_amount, order.booking_payment_notes)}
                          </span>
                        </div>
                        <div className="bill-milestone-row">
                          <span>2nd Payment (Midway Installment):</span>
                          <span className={order.second_paid ? "paid-text" : "pending-text"}>
                            {getBillPaymentText(order.second_paid, order.second_amount, order.second_payment_notes)}
                          </span>
                        </div>
                        <div className="bill-milestone-row">
                          <span>Final Payment (Event Settlement):</span>
                          <span className={order.final_paid ? "paid-text" : "pending-text"}>
                            {getBillPaymentText(order.final_paid, order.final_amount, order.final_payment_notes)}
                          </span>
                        </div>
                      </div>

                      <div className="bill-totals-column">
                        <div className="bill-total-row">
                          <span>Base Menu Subtotal:</span>
                          <span>{currencySymbol}{calculateBaseMenuCostOnly(order, packages).toLocaleString("en-IN")}</span>
                        </div>
                        {Number(order.discount_percent || 0) > 0 && (
                          <div className="bill-total-row" style={{ color: "#2e7d32" }}>
                            <span>Discount ({order.discount_percent}%):</span>
                            <span>-{currencySymbol}{(calculateBaseMenuCostOnly(order, packages) * (Number(order.discount_percent) / 100)).toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {Array.isArray(order.additional_charges) && order.additional_charges.length > 0 && (
                          <div className="bill-total-row">
                            <span>Additional Charges:</span>
                            <span>{currencySymbol}{order.additional_charges.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0).toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        <div className="bill-total-row bill-final-total" style={{ borderTop: "1px solid #1a1a1a", borderBottom: "2px double #1a1a1a", padding: "0.25rem 0", fontWeight: "bold" }}>
                          <span>Estimated Total:</span>
                          <span>{currencySymbol}{calculateTotalOrderCost(order, packages).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="bill-total-row">
                          <span>Total Paid to Date:</span>
                          <span>{currencySymbol}{paidAmount.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="bill-total-row bill-final-balance">
                          <span>Outstanding Balance:</span>
                          <strong>{currencySymbol}{calculatePendingOrderCost(order, packages).toLocaleString("en-IN")}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <div className="print-footer-space"></div>
                </td>
              </tr>
            </tfoot>
          </table>

          <footer className="bill-footer print-fixed-footer">
            <p>Software &amp; Receipt generated by Folio - built by <a href="https://incuforge.pages.dev/" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>IncuForge</a> @ 2026 &bull; Professional Event Management</p>
          </footer>
        </div>
      </div>
    );
  };

  const renderKitchenTemplate = (order: any) => {
    if (!order) return null;
    const hasSessions = Array.isArray(order.sessions) && order.sessions.length > 0;

    return (
      <div className="print-kitchen-sheet">
        <h2 className="kitchen-sheet-title">{order.event_name} - Kitchen Sheet</h2>
        <div className="kitchen-sheet-subtitle">
          Client: <strong>{order.client_name}</strong> &bull; Event Date: <strong>{order.event_date}</strong> &bull; Total Guests: <strong>{order.guest_count}</strong> &bull; by Folio - built by <a href="https://incuforge.pages.dev/" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>IncuForge</a> @ 2026
        </div>

        {order.notes && (
          <div className="kitchen-notes-box" style={{ 
            marginTop: "0.75rem", 
            marginBottom: "1.25rem", 
            padding: "0.75rem 1rem", 
            border: "1px solid var(--border-ink)",
            borderTop: "2px solid var(--border-strong)",
            borderBottom: "2px solid var(--border-strong)",
            background: "transparent",
            borderRadius: "0px",
            boxShadow: "none"
          }}>
            <strong style={{ fontSize: "0.8rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.25rem" }}>
              ⚠️ General Event Notes & Dietary Complications:
            </strong>
            <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: "1.4", whiteSpace: "pre-wrap", color: "#333" }}>
              {order.notes}
            </p>
          </div>
        )}

        <table className="kitchen-table">
          <thead>
            <tr className="kitchen-table-head-row">
              <th className="kitchen-th-cell">Dish Name</th>
              <th className="kitchen-th-cell">Category</th>
              <th className="kitchen-th-cell">Scaled Ingredients List</th>
              <th className="kitchen-th-cell">Prep Notes</th>
            </tr>
          </thead>
          <tbody>
            {hasSessions ? (
              order.sessions.map((session: any, sIdx: number) => {
                const sessionItems = session.items || [];
                return (
                  <React.Fragment key={session.id || sIdx}>
                    {/* Session Header Separator */}
                    <tr style={{ background: "#f2f2f2" }}>
                      <td colSpan={4} className="kitchen-td-cell font-bold" style={{ fontSize: "0.9rem", color: "#444" }}>
                        Session: {session.name} ({session.session_date} {session.session_time ? `@ ${session.session_time}` : ""}) — {session.guest_count} Guests
                      </td>
                    </tr>
                    {sessionItems.map((formIt: any, itIdx: number) => {
                      const dish: any = items?.find((d) => d.id === formIt.itemId) || {};
                      const ingredients = dish.ingredients || "";
                      return (
                        <tr key={formIt.itemId || itIdx} className="kitchen-table-body-row">
                          <td className="kitchen-td-cell font-bold" style={{ paddingLeft: "1.5rem" }}>{dish.name || formIt.itemId}</td>
                          <td className="kitchen-td-cell category-cell">{dish.type || "Dish"}</td>
                          <td className="kitchen-td-cell ingredients-cell">
                            {scaleIngredientsText(ingredients, formIt.quantity)}
                          </td>
                          <td className="kitchen-td-cell notes-cell">{formIt.notes || "None"}</td>
                        </tr>
                      );
                    })}
                    {sessionItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="kitchen-td-cell" style={{ paddingLeft: "1.5rem", color: "var(--ink-muted)", fontSize: "0.8rem" }}>
                          No dishes scheduled for this session.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              order.items?.map((it: any) => (
                <tr key={it.item_id} className="kitchen-table-body-row">
                  <td className="kitchen-td-cell font-bold">{it.name}</td>
                  <td className="kitchen-td-cell category-cell">{it.type}</td>
                  <td className="kitchen-td-cell ingredients-cell">
                    {scaleIngredientsText(it.ingredients, order.guest_count)}
                  </td>
                  <td className="kitchen-td-cell notes-cell">{it.item_notes || "None"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      {/* Selected Order Detailed Card Overlay */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content modal-large" style={{ viewTransitionName: "active-order-modal" } as any} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {selectedOrder.event_name}
                </h2>
                <span className={`status-badge status-${selectedOrder.status}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <button 
                type="button" 
                className="btn-close-modal"
                onClick={() => setSelectedOrder(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-grid">
              <div>
                <span className="form-label-section-header">
                  Client Details
                </span>
                <div className="info-list">
                  <strong className="info-item-primary flex-align-center-gap">
                    <User size={14} /> {selectedOrder.client_name}
                  </strong>
                  {selectedOrder.client_phone && (
                    <div className="info-item flex-align-center-gap">
                      <Phone size={14} /> {selectedOrder.client_phone}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="form-label-section-header">
                  Schedule &amp; Venue
                </span>
                <div className="info-list">
                  <div className="info-item flex-align-center-gap">
                    <Calendar size={14} /> Date: <strong className="text-primary-color">{selectedOrder.event_date}</strong>
                  </div>
                  {selectedOrder.event_time && (
                    <div className="info-item flex-align-center-gap">
                      <Clock size={14} /> Time: {selectedOrder.event_time}
                    </div>
                  )}
                  {selectedOrder.venue && (
                    <div className="info-item flex-align-center-gap">
                      <MapPin size={14} /> Venue: {selectedOrder.venue}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-body-section">
              <span className="form-label-section-header border-none">
                Menu Item Details ({selectedOrder.guest_count} guests)
              </span>
              <div className="items-summary-box">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <ul className="items-summary-list">
                    {selectedOrder.items.map((it) => (
                      <li key={it.item_id}>
                        <span className="text-primary-color">{it.name}</span> ({it.quantity} servings) 
                        {it.item_notes && <span className="text-muted-color italic-small"> &mdash; &ldquo;{it.item_notes}&rdquo;</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-color">No menu items added yet.</span>
                )}
              </div>
            </div>

            <div className="modal-body-section">
              <span className="form-label-section-header">
                Billing &amp; Payment Milestones
              </span>
              <div className="billing-milestones-box">
                {/* Milestone 1 */}
                <div className="milestone-row border-bottom pb-3 mb-3">
                  <div className="milestone-header-line flex-justify-between flex-align-center mb-1">
                    <span className="milestone-title font-semibold">1st Payment (Deposit):</span>
                    {selectedOrder.booking_paid ? (
                      <span className="success-color flex-align-center-gap text-sm font-medium">
                        <CheckCircle2 size={15} /> Paid ({currencySymbol}{selectedOrder.booking_amount})
                      </span>
                    ) : (
                      <span className="danger-color flex-align-center-gap text-sm font-medium">
                        <XCircle size={15} /> Unpaid ({currencySymbol}{selectedOrder.booking_amount})
                      </span>
                    )}
                  </div>
                  
                  {editingMilestone === "booking" ? (
                    <div className="milestone-edit-form border p-3 rounded bg-slate-50 mt-2">
                      <div className="form-group mb-2">
                        <label className="form-label text-xs">Payment Date</label>
                        <input 
                          type="date" 
                          className="form-input text-sm py-1" 
                          value={payDate} 
                          onChange={(e) => setPayDate(e.target.value)} 
                        />
                      </div>
                      <div className="form-group mb-2">
                        <label className="form-label text-xs">Payment Mode</label>
                        <select 
                          className="form-input text-sm py-1" 
                          value={payMode} 
                          onChange={(e) => setPayMode(e.target.value)}
                        >
                          {paymentMethods.map((pm) => (
                            <option key={pm} value={pm}>{pm}</option>
                          ))}
                          {!paymentMethods.includes(payMode) && payMode && (
                            <option value={payMode}>{payMode}</option>
                          )}
                          {!paymentMethods.includes("Other") && (
                            <option value="Other">Other</option>
                          )}
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label text-xs">Reference (Tx ID, Cheque ID, Notes)</label>
                        <input 
                          type="text" 
                          placeholder="Enter reference info"
                          className="form-input text-sm py-1" 
                          value={payComment} 
                          onChange={(e) => setPayComment(e.target.value)} 
                        />
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <button 
                          type="button" 
                          className="btn btn-primary btn-xs"
                          onClick={() => handleSavePaymentDetails("booking")}
                        >
                          Save Details
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-xs"
                          onClick={() => setEditingMilestone(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : selectedOrder.booking_paid ? (
                    <div className="mt-1 flex-justify-between flex-align-start bg-slate-50 p-2.5 rounded">
                      <div>
                        {renderPaymentNotes(selectedOrder.booking_payment_notes || "")}
                      </div>
                      {!isManager && (
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-xs py-0.5 px-2"
                            onClick={() => startEditPayment("booking", selectedOrder.booking_payment_notes || "")}
                          >
                            Edit
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-danger btn-xs py-0.5 px-2"
                            onClick={() => handleResetPayment("booking")}
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    !isManager && (
                      <div className="mt-2 text-right">
                        <button 
                          type="button" 
                          className="btn btn-primary btn-xs py-1 px-3"
                          onClick={() => startEditPayment("booking", selectedOrder.booking_payment_notes || "")}
                        >
                          Record Payment Details
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Milestone 2 */}
                <div className="milestone-row border-bottom pb-3 mb-3">
                  <div className="milestone-header-line flex-justify-between flex-align-center mb-1">
                    <span className="milestone-title font-semibold">2nd Payment (Midway):</span>
                    {selectedOrder.second_paid ? (
                      <span className="success-color flex-align-center-gap text-sm font-medium">
                        <CheckCircle2 size={15} /> Paid ({currencySymbol}{selectedOrder.second_amount})
                      </span>
                    ) : (
                      <span className="danger-color flex-align-center-gap text-sm font-medium">
                        <XCircle size={15} /> Unpaid ({currencySymbol}{selectedOrder.second_amount})
                      </span>
                    )}
                  </div>
                  
                  {editingMilestone === "second" ? (
                    <div className="milestone-edit-form border p-3 rounded bg-slate-50 mt-2">
                      <div className="form-group mb-2">
                        <label className="form-label text-xs">Payment Date</label>
                        <input 
                          type="date" 
                          className="form-input text-sm py-1" 
                          value={payDate} 
                          onChange={(e) => setPayDate(e.target.value)} 
                        />
                      </div>
                      <div className="form-group mb-2">
                        <label className="form-label text-xs">Payment Mode</label>
                        <select 
                          className="form-input text-sm py-1" 
                          value={payMode} 
                          onChange={(e) => setPayMode(e.target.value)}
                        >
                          {paymentMethods.map((pm) => (
                            <option key={pm} value={pm}>{pm}</option>
                          ))}
                          {!paymentMethods.includes(payMode) && payMode && (
                            <option value={payMode}>{payMode}</option>
                          )}
                          {!paymentMethods.includes("Other") && (
                            <option value="Other">Other</option>
                          )}
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label text-xs">Reference (Tx ID, Cheque ID, Notes)</label>
                        <input 
                          type="text" 
                          placeholder="Enter reference info"
                          className="form-input text-sm py-1" 
                          value={payComment} 
                          onChange={(e) => setPayComment(e.target.value)} 
                        />
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <button 
                          type="button" 
                          className="btn btn-primary btn-xs"
                          onClick={() => handleSavePaymentDetails("second")}
                        >
                          Save Details
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-xs"
                          onClick={() => setEditingMilestone(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : selectedOrder.second_paid ? (
                    <div className="mt-1 flex-justify-between flex-align-start bg-slate-50 p-2.5 rounded">
                      <div>
                        {renderPaymentNotes(selectedOrder.second_payment_notes || "")}
                      </div>
                      {!isManager && (
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-xs py-0.5 px-2"
                            onClick={() => startEditPayment("second", selectedOrder.second_payment_notes || "")}
                          >
                            Edit
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-danger btn-xs py-0.5 px-2"
                            onClick={() => handleResetPayment("second")}
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    !isManager && (
                      <div className="mt-2 text-right">
                        <button 
                          type="button" 
                          className="btn btn-primary btn-xs py-1 px-3"
                          onClick={() => startEditPayment("second", selectedOrder.second_payment_notes || "")}
                        >
                          Record Payment Details
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Milestone 3 */}
                <div className="milestone-row pb-1">
                  <div className="milestone-header-line flex-justify-between flex-align-center mb-1">
                    <span className="milestone-title font-semibold">Final Settlement:</span>
                    {selectedOrder.final_paid ? (
                      <span className="success-color flex-align-center-gap text-sm font-medium">
                        <CheckCircle2 size={15} /> Paid ({currencySymbol}{selectedOrder.final_amount})
                      </span>
                    ) : (
                      <span className="danger-color flex-align-center-gap text-sm font-medium">
                        <XCircle size={15} /> Unpaid ({currencySymbol}{selectedOrder.final_amount})
                      </span>
                    )}
                  </div>
                  
                  {editingMilestone === "final" ? (
                    <div className="milestone-edit-form border p-3 rounded bg-slate-50 mt-2">
                      <div className="form-group mb-2">
                        <label className="form-label text-xs">Payment Date</label>
                        <input 
                          type="date" 
                          className="form-input text-sm py-1" 
                          value={payDate} 
                          onChange={(e) => setPayDate(e.target.value)} 
                        />
                      </div>
                      <div className="form-group mb-2">
                        <label className="form-label text-xs">Payment Mode</label>
                        <select 
                          className="form-input text-sm py-1" 
                          value={payMode} 
                          onChange={(e) => setPayMode(e.target.value)}
                        >
                          {paymentMethods.map((pm) => (
                            <option key={pm} value={pm}>{pm}</option>
                          ))}
                          {!paymentMethods.includes(payMode) && payMode && (
                            <option value={payMode}>{payMode}</option>
                          )}
                          {!paymentMethods.includes("Other") && (
                            <option value="Other">Other</option>
                          )}
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label text-xs">Reference (Tx ID, Cheque ID, Notes)</label>
                        <input 
                          type="text" 
                          placeholder="Enter reference info"
                          className="form-input text-sm py-1" 
                          value={payComment} 
                          onChange={(e) => setPayComment(e.target.value)} 
                        />
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <button 
                          type="button" 
                          className="btn btn-primary btn-xs"
                          onClick={() => handleSavePaymentDetails("final")}
                        >
                          Save Details
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-xs"
                          onClick={() => setEditingMilestone(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : selectedOrder.final_paid ? (
                    <div className="mt-1 flex-justify-between flex-align-start bg-slate-50 p-2.5 rounded">
                      <div>
                        {renderPaymentNotes(selectedOrder.final_payment_notes || "")}
                      </div>
                      {!isManager && (
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-xs py-0.5 px-2"
                            onClick={() => startEditPayment("final", selectedOrder.final_payment_notes || "")}
                          >
                            Edit
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-danger btn-xs py-0.5 px-2"
                            onClick={() => handleResetPayment("final")}
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    !isManager && (
                      <div className="mt-2 text-right">
                        <button 
                          type="button" 
                          className="btn btn-primary btn-xs py-1 px-3"
                          onClick={() => startEditPayment("final", selectedOrder.final_payment_notes || "")}
                        >
                          Record Payment Details
                        </button>
                      </div>
                    )
                  )}
                </div>

                {selectedOrder.additional_charges && selectedOrder.additional_charges.length > 0 && (
                  <div className="additional-charges-section">
                    <span className="section-mini-header">Additional Charges</span>
                    {selectedOrder.additional_charges.map((c, idx) => (
                      <div key={idx} className="charge-item-row">
                        <span>{c.label}:</span>
                        <span>{currencySymbol}{c.amount}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="billing-summary-details" style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-ink)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
                    <span>Base Menu Subtotal:</span>
                    <span>{currencySymbol}{calculateBaseMenuCostOnly(selectedOrder, packages).toLocaleString("en-IN")}</span>
                  </div>
                  {Number(selectedOrder.discount_percent || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--color-success, #2e7d32)" }}>
                      <span>Discount ({selectedOrder.discount_percent}%):</span>
                      <span>-{currencySymbol}{(calculateBaseMenuCostOnly(selectedOrder, packages) * (Number(selectedOrder.discount_percent) / 100)).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {selectedOrder.additional_charges && selectedOrder.additional_charges.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
                      <span>Additional Charges:</span>
                      <span>{currencySymbol}{selectedOrder.additional_charges.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="billing-summary-row border-top" style={{ paddingTop: "0.4rem", fontWeight: "bold", fontSize: "0.95rem" }}>
                    <span>Billed Total:</span>
                    <span>{currencySymbol}{calculateTotalOrderCost(selectedOrder, packages).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="billing-summary-row pending-balance-row">
                    <span>Pending Balance:</span>
                    <span>{currencySymbol}{calculatePendingOrderCost(selectedOrder, packages).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="modal-body-section">
                <span className="form-label-section-header border-none mb-1">General Event Notes</span>
                <p className="notes-content-box">
                  {selectedOrder.notes}
                </p>
              </div>
            )}

            <div className="modal-footer-actions">
              <button 
                type="button" 
                className="btn btn-secondary btn-sm btn-icon-label" 
                onClick={() => {
                  setSelectedOrder(null);
                  handleEditOrder(selectedOrder);
                }}
              >
                <Edit2 size={13} /> Edit Order
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm btn-icon-label" 
                onClick={() => {
                  setSelectedOrder(null);
                  setPrintMenuOrder(selectedOrder);
                }}
              >
                <Receipt size={13} /> Export Receipt
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm btn-icon-label" 
                onClick={() => {
                  setSelectedOrder(null);
                  setKitchenSheetOrder(selectedOrder);
                }}
              >
                <Flame size={13} /> Kitchen Sheet
              </button>
              {!isManager && (
                <button 
                  type="button" 
                  className="btn btn-danger btn-sm btn-icon-label" 
                  onClick={() => {
                    const id = selectedOrder.id;
                    setSelectedOrder(null);
                    handleDeleteOrder(id);
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation safety window modal check */}
      {cancellationLockModal && (
        <div className="modal-overlay" onClick={() => setCancellationLockModal(null)}>
          <div className="modal-content modal-danger" onClick={(e) => e.stopPropagation()} style={{ borderColor: "var(--color-danger)" }}>
            <h3 className="modal-danger-title flex-align-center-gap">
              <AlertTriangle size={20} /> Event Preparation Guard
            </h3>
            <p className="modal-danger-desc">
              {cancellationLockModal.message}
            </p>
            <div className="modal-footer-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCancellationLockModal(null)}>
                Go Back
              </button>
              <button 
                type="button" 
                className="btn btn-danger btn-sm" 
                onClick={() => handleDeleteOrder(cancellationLockModal.orderId, true)}
              >
                Yes, Force Cancel/Delete
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Print-Only Receipt Area */}
      {printMenuOrder && (
        <div className="folio-print-area">
          {renderMenuTemplate(printMenuOrder)}
        </div>
      )}

      {/* Print-Only Kitchen Sheet Area */}
      {kitchenSheetOrder && (
        <div className="folio-print-area-kitchen">
          {renderKitchenTemplate(kitchenSheetOrder)}
        </div>
      )}
    </>
  );
}
