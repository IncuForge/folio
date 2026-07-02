"use client";

import React from "react";
import { useAppContext } from "@/lib/AppContext";
import { 
  isPastEvent, 
  getDaysDifference, 
  getOrderPaymentStatusClass, 
  getOrderPaymentStatusLabel, 
  calculatePendingOrderCost,
  calculateTotalOrderCost
} from "@/lib/date-utils";
import { Plus, AlertTriangle, Calendar, Users, IndianRupee, Clock, Coins } from "lucide-react";

export default function DashboardView() {
  const {
    orders,
    packages,
    dashboardScheduleTab,
    setDashboardScheduleTab,
    setSelectedOrder,
    handleNewOrder,
    currencySymbol,
  } = useAppContext();

  // Derived filter sets using date-utils (memoized to avoid expensive recalculations on re-render)
  const upcomingEvents = React.useMemo(() => {
    return orders.filter((o) => {
      return !isPastEvent(o.event_date) && o.status !== "cancelled" && o.status !== "completed";
    });
  }, [orders]);

  const pastEvents = React.useMemo(() => {
    return orders.filter((o) => {
      return (isPastEvent(o.event_date) || o.status === "completed") && o.status !== "cancelled";
    });
  }, [orders]);

  const overdueOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const isPaid = calculatePendingOrderCost(o, packages) <= 0;
      return isPastEvent(o.event_date) && !isPaid && o.status !== "cancelled";
    });
  }, [orders, packages]);

  const urgentOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const diffDays = getDaysDifference(o.event_date);
      const isPaid = calculatePendingOrderCost(o, packages) <= 0;
      return diffDays >= 0 && diffDays <= 3 && !isPaid && o.status !== "cancelled";
    });
  }, [orders, packages]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            Catering Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Track business volume, payments due, and schedules.
          </p>
        </div>
        <button className="btn btn-primary btn-icon-label" onClick={handleNewOrder}>
          <Plus size={16} /> Create Order
        </button>
      </header>

      {/* Overview Stats */}
      <div className="dashboard-stats-grid">
        <div className="glass-card stat-box">
          <div className="stat-box-header">
            <span className="stat-box-title">
              Upcoming Events
            </span>
            <Calendar size={18} className="stat-box-icon" />
          </div>
          <h2 className="stat-box-value">
            {upcomingEvents.length}
          </h2>
        </div>

        <div className="glass-card stat-box">
          <div className="stat-box-header">
            <span className="stat-box-title">
              Overdue Payments
            </span>
            {currencySymbol === "₹" ? (
              <IndianRupee size={18} className="stat-box-icon-alert" />
            ) : (
              <span className="stat-box-icon-alert-text" style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--danger-text)" }}>{currencySymbol}</span>
            )}
          </div>
          <h2 className="stat-box-value text-red-500">
            {overdueOrders.length}
          </h2>
        </div>

        <div className="glass-card stat-box">
          <div className="stat-box-header">
            <span className="stat-box-title">
              Urgent Collections
            </span>
            <AlertTriangle size={18} className="stat-box-icon-warning" />
          </div>
          <h2 className="stat-box-value text-orange-500">
            {urgentOrders.length}
          </h2>
        </div>
      </div>

      {/* Payments Warnings Checkbox Panels */}
      {(overdueOrders.length > 0 || urgentOrders.length > 0) && (
        <div className="glass-card warning-panel">
          <h3 className="warning-panel-title">
            <AlertTriangle size={20} /> Payment Warnings &amp; Checklist
          </h3>
          <div className="warning-items-list">
            {overdueOrders.map((order) => (
              <div 
                key={order.id} 
                id={"warning-row-" + order.id}
                className="warning-row overdue-row"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="warning-info">
                  <strong className="warning-client-name">{order.client_name}</strong>
                  <span className="warning-event-details">&bull; {order.event_name}</span>
                  <div className="warning-timeline">
                    Event Date: {order.event_date} (Passed) | Balance: {currencySymbol}{calculatePendingOrderCost(order, packages).toLocaleString("en-IN")}
                  </div>
                </div>
                <span className="payment-badge overdue-badge">
                  PAYMENT OVERDUE
                </span>
              </div>
            ))}

            {urgentOrders.map((order) => (
              <div 
                key={order.id} 
                id={"warning-row-" + order.id}
                className="warning-row urgent-row"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="warning-info">
                  <strong className="warning-client-name">{order.client_name}</strong>
                  <span className="warning-event-details">&bull; {order.event_name}</span>
                  <div className="warning-timeline">
                    Event Date: {order.event_date} (Upcoming) | Balance: {currencySymbol}{calculatePendingOrderCost(order, packages).toLocaleString("en-IN")}
                  </div>
                </div>
                <span className="payment-badge urgent-badge">
                  URGENT COLLECTION
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule list */}
      <div className="glass-card schedule-panel">
        <div className="schedule-tabs-container">
          <button
            type="button"
            onClick={() => setDashboardScheduleTab("upcoming")}
            className={`schedule-tab-btn ${dashboardScheduleTab === "upcoming" ? "active" : ""}`}
          >
            Upcoming Bookings ({upcomingEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setDashboardScheduleTab("past")}
            className={`schedule-tab-btn ${dashboardScheduleTab === "past" ? "active" : ""}`}
          >
            Past Bookings ({pastEvents.length})
          </button>
        </div>
        {(dashboardScheduleTab === "upcoming" ? upcomingEvents : pastEvents).length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon-wrapper">
              <Calendar size={20} />
            </div>
            <h4 className="empty-state-title">
              {dashboardScheduleTab === "upcoming" ? "No Upcoming Bookings" : "No Past Bookings"}
            </h4>
            <p className="empty-state-desc">
              {dashboardScheduleTab === "upcoming" 
                ? 'Create a new client order to schedule menu packages, guest counts, and record billing checkpoints.' 
                : "No past bookings have been recorded in the database history yet."}
            </p>
            {dashboardScheduleTab === "upcoming" && (
              <button 
                onClick={handleNewOrder}
                className="btn btn-primary btn-sm btn-icon-label"
              >
                <Plus size={14} /> Create Order
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr className="table-head-row">
                  <th className="th-cell">DATE &amp; TIME</th>
                  <th className="th-cell">CLIENT &amp; EVENT</th>
                  <th className="th-cell text-center">GUESTS</th>
                  <th className="th-cell text-right">TOTAL COST</th>
                  <th className="th-cell">PAYMENT</th>
                  <th className="th-cell">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(dashboardScheduleTab === "upcoming" ? upcomingEvents : pastEvents).slice(0, 5).map((order) => (
                  <tr 
                    key={order.id} 
                    id={"order-row-" + order.id}
                    className="table-body-row"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="td-cell">
                      <div className="date-time-col">
                        <div className="flex-align-center-gap text-primary-color">
                          <Calendar size={12} /> {order.event_date}
                        </div>
                        {order.event_time && (
                          <div className="flex-align-center-gap text-secondary-color">
                            <Clock size={12} /> {order.event_time}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="td-cell">
                      <strong className="client-display-name">{order.client_name}</strong>
                      <div className="event-display-name">{order.event_name}</div>
                    </td>
                    <td className="td-cell text-center">
                      <div className="flex-align-center-gap justify-center">
                        <Users size={12} /> {order.guest_count}
                      </div>
                    </td>
                    <td className="td-cell text-right">
                      <strong>{currencySymbol}{calculateTotalOrderCost(order, packages).toLocaleString("en-IN")}</strong>
                    </td>
                    <td className="td-cell">
                      <span className={`payment-timeline-badge ${getOrderPaymentStatusClass(order)}`}>
                        {getOrderPaymentStatusLabel(order)}
                      </span>
                    </td>
                    <td className="td-cell">
                      <span className={`status-badge status-${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
