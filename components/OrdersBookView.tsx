"use client";

import React, { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import { 
  calculateTotalOrderCost, 
  calculatePendingOrderCost, 
  getOrderPaymentStatusClass, 
  getOrderPaymentStatusLabel 
} from "@/lib/date-utils";
import { Order } from "@/types/schema";
import { 
  Plus, 
  Edit2, 
  Copy, 
  FileText, 
  Flame, 
  MessageSquare, 
  Trash2,
  Calendar,
  Users,
  MapPin,
  ClipboardList,
  CheckCircle2,
  Receipt
} from "lucide-react";

export default function OrdersBookView() {
  const {
    orders,
    packages,
    items,
    orderSearchQuery,
    setOrderSearchQuery,
    handleNewOrder,
    handleEditOrder,
    handleCloneOrder,
    handleDeleteOrder,
    handleUpdateOrderStatus,
    setPrintMenuOrder,
    setKitchenSheetOrder,
    currentUser,
    currencySymbol
  } = useAppContext();

  const isManager = currentUser?.role === "manager";

  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filteredOrders = orders.filter((o) => {
    const query = orderSearchQuery.toLowerCase();
    const matchesText = (
      o.client_name.toLowerCase().includes(query) ||
      o.event_name.toLowerCase().includes(query) ||
      (o.client_phone && o.client_phone.includes(query))
    );

    let matchesDate = true;
    if (filterDate) {
      const start = o.event_date;
      const end = o.event_end_date || o.event_date;
      matchesDate = (filterDate >= start && filterDate <= end);
    }

    let matchesStatus = true;
    if (filterStatus) {
      matchesStatus = (o.status === filterStatus);
    }

    return matchesText && matchesDate && matchesStatus;
  });

  const getWhatsAppShareLink = (order: Order) => {
    let itemsStr = "";
    if (order.items) {
      itemsStr = order.items.map((it) => `• ${it.name} (${it.quantity} servings)`).join("\n");
    }

    const text = encodeURIComponent(
      `*CATERING BOOKING CONFIRMATION*\n\n` +
      `Hello ${order.client_name},\n` +
      `We are pleased to confirm your catering order details:\n\n` +
      `*Event Name:* ${order.event_name}\n` +
      `*Event Date:* ${order.event_date}\n` +
      `*Event Time:* ${order.event_time}\n` +
      `*Venue:* ${order.venue}\n` +
      `*Guest Count:* ${order.guest_count}\n\n` +
      `*Menu Selection:*\n${itemsStr}\n\n` +
      `Thank you for booking with us! We look forward to serving you.`
    );
    const phone = order.client_phone ? order.client_phone.replace(/\D/g, "") : "";
    return `https://wa.me/${phone}?text=${text}`;
  };

  return (
    <div className="orders-container">
      <header className="orders-header">
        <div>
          <h1 className="orders-title">
            Orders Book
          </h1>
          <p className="orders-subtitle">
            Search, modify, clone, and manage billing statuses.
          </p>
        </div>
        <button className="btn btn-primary btn-icon-label" onClick={handleNewOrder}>
          <Plus size={16} /> Create Order
        </button>
      </header>

      {/* Filters Bar */}
      <div className="glass-card filter-card" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="form-input"
          type="text"
          placeholder="Search client, event, phone..."
          value={orderSearchQuery}
          onChange={(e) => setOrderSearchQuery(e.target.value)}
          style={{ flexGrow: 1, minWidth: "200px" }}
        />
        
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap", color: "var(--ink-muted)" }}>Date:</span>
          <input
            type="date"
            className="form-input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ fontSize: "0.8rem", width: "140px", padding: "0.35rem 0.5rem" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap", color: "var(--ink-muted)" }}>Status:</span>
          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ fontSize: "0.8rem", width: "130px", padding: "0.35rem 0.5rem" }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {(orderSearchQuery || filterDate || filterStatus) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setOrderSearchQuery("");
              setFilterDate("");
              setFilterStatus("");
            }}
            style={{ height: "34px", display: "inline-flex", alignItems: "center", padding: "0 0.75rem" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Orders list */}
      <div className="glass-card orders-list-panel">
        {filteredOrders.map((order) => (
          <div 
            key={order.id} 
            id={"order-card-" + order.id}
            className="order-card-row"
          >
            <div className="order-card-header">
              <div>
                <h3 className="order-event-title">{order.event_name}</h3>
                <p className="order-client-line">
                  Client: <strong className="text-primary-color">{order.client_name}</strong> 
                  {order.client_phone && <span> ({order.client_phone})</span>}
                  <span className="text-muted-color"> | </span>
                  <span className="flex-align-center-gap">
                    <MapPin size={13} /> {order.venue || "TBD"}
                  </span>
                </p>
                <p className="order-logistics-line">
                  <span className="flex-align-center-gap">
                    <Calendar size={13} /> <strong>{order.event_date}</strong> at {order.event_time || "TBD"}
                  </span>
                  <span className="flex-align-center-gap">
                    <Users size={13} /> Guests: <strong>{order.guest_count}</strong>
                  </span>
                </p>
              </div>
              <div className="badges-wrapper">
                <span className={`status-badge status-${order.status}`}>{order.status}</span>
                <span className={`payment-timeline-badge ${getOrderPaymentStatusClass(order)}`}>
                  {getOrderPaymentStatusLabel(order)}
                </span>
              </div>
            </div>

            {/* Order Details summary items */}
            {Array.isArray(order.sessions) && order.sessions.length > 0 ? (
              <div className="order-sessions-summary" style={{ fontSize: "0.82rem", marginTop: "0.5rem", borderLeft: "2px solid var(--border-ink)", paddingLeft: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {order.sessions.map((sess: any, index: number) => (
                  <div key={sess.id || index} style={{ color: "var(--ink-muted)" }}>
                    <strong style={{ color: "var(--ink)" }}>{sess.name}:</strong> {sess.items && sess.items.length > 0 ? (
                      sess.items.map((si: any) => {
                        const dish = items?.find((d: any) => d.id === si.itemId);
                        return `${dish?.name || si.itemId} (${si.quantity})`;
                      }).join(", ")
                    ) : (
                      "No dishes scheduled"
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="order-menu-summary">
                <strong className="text-primary-color font-bold">Menu Included: </strong>
                {order.items && order.items.length > 0 ? (
                  <span className="text-secondary-color">
                    {order.items.map((it) => `${it.name} (${it.quantity})`).join(", ")}
                  </span>
                ) : (
                  <span className="text-muted-color">No menu items added yet.</span>
                )}
              </div>
            )}

            {/* Financial summary & Actions */}
            <div className="order-card-footer">
              <div className="financial-summary-text">
                Billed Total: <strong>{currencySymbol}{calculateTotalOrderCost(order, packages).toLocaleString("en-IN")}</strong>
                <span className="separator-line"> | </span>
                Pending Balance: <strong className="pending-balance-value">{currencySymbol}{calculatePendingOrderCost(order, packages).toLocaleString("en-IN")}</strong>
              </div>
              <div className="actions-wrapper">
                {order.status === "completed" ? (
                  <button 
                    className="btn btn-secondary btn-sm btn-icon-label" 
                    onClick={() => handleUpdateOrderStatus(order.id, "confirmed")}
                  >
                    <CheckCircle2 size={13} style={{ color: "var(--success-text)" }} /> Revert Status
                  </button>
                ) : (
                  <button 
                    className="btn btn-secondary btn-sm btn-icon-label" 
                    onClick={() => handleUpdateOrderStatus(order.id, "completed")}
                  >
                    <CheckCircle2 size={13} /> Fulfill
                  </button>
                )}
                <button 
                  className="btn btn-secondary btn-sm btn-icon-label" 
                  onClick={() => handleEditOrder(order)}
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button 
                  className="btn btn-secondary btn-sm btn-icon-label" 
                  onClick={() => handleCloneOrder(order.id)}
                >
                  <Copy size={13} /> Clone
                </button>
                <button 
                  className="btn btn-secondary btn-sm btn-icon-label" 
                  onClick={() => {
                    setPrintMenuOrder(order);
                  }}
                >
                  <Receipt size={13} /> PDF Receipt
                </button>
                <button 
                  className="btn btn-secondary btn-sm btn-icon-label" 
                  onClick={() => setKitchenSheetOrder(order)}
                >
                  <Flame size={13} /> Kitchen Sheet
                </button>
                <a 
                  href={getWhatsAppShareLink(order)} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-secondary btn-sm btn-icon-label btn-link"
                >
                  <MessageSquare size={13} /> Share
                </a>
                {!isManager && (
                  <button 
                    className="btn btn-danger btn-sm btn-icon-label" 
                    onClick={() => handleDeleteOrder(order.id)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {orders.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon-wrapper">
              <ClipboardList size={22} />
            </div>
            <h3 className="empty-state-title">
              No Orders Booked
            </h3>
            <p className="empty-state-desc">
              Get started by creating your first catering event booking to plan details, menus, and track payment milestones.
            </p>
            <button 
              onClick={handleNewOrder}
              className="btn btn-primary btn-icon-label"
            >
              <Plus size={16} /> Create Order
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon-wrapper">
              <ClipboardList size={22} className="opacity-60" />
            </div>
            <h3 className="empty-state-title">
              No Matching Orders
            </h3>
            <p className="empty-state-desc">
              We couldn't find any bookings matching "{orderSearchQuery}". Try adjusting your keywords or search spelling.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
