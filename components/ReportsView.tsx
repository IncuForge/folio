"use client";

import React, { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import { ChevronLeft, ChevronRight, TrendingUp, BarChart3 } from "lucide-react";
import { calculateTotalOrderCost, isTruthy } from "@/lib/date-utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";

export default function ReportsView() {
  const { orders, packages, currencySymbol } = useAppContext();
  const [reportType, setReportType] = useState<"weekly" | "monthly">("monthly");
  const [reportMonthOffset, setReportMonthOffset] = useState<number>(0);

  const getFilteredReportsData = () => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (reportType === "weekly") {
      const currentDay = today.getDay();
      const distance = currentDay - 1; // Distance from Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() - distance + reportMonthOffset * 7);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      startDate = monday;
      endDate = sunday;
    } else {
      const offsetMonth = today.getMonth() + reportMonthOffset;
      startDate = new Date(today.getFullYear(), offsetMonth, 1, 0, 0, 0, 0);
      endDate = new Date(today.getFullYear(), offsetMonth + 1, 0, 23, 59, 59, 999);
    }

    const filtered = orders.filter((o) => {
      const orderDate = new Date(o.event_date);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const activeOrders = filtered.filter((o) => o.status !== "cancelled");
    const totalBooked = activeOrders.reduce((sum, o) => {
      return sum + calculateTotalOrderCost(o, packages);
    }, 0);

    const totalCollected = filtered.reduce((sum, o) => {
      const booking = isTruthy(o.booking_paid) ? (Number(o.booking_amount) || 0) : 0;
      const second = isTruthy(o.second_paid) ? (Number(o.second_amount) || 0) : 0;
      const final = isTruthy(o.final_paid) ? (Number(o.final_amount) || 0) : 0;
      let chargesPaid = 0;
      if (isTruthy(o.final_paid) && Array.isArray(o.additional_charges)) {
        chargesPaid = o.additional_charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      }
      return sum + booking + second + final + chargesPaid;
    }, 0);

    const outstanding = Math.max(0, totalBooked - totalCollected);

    const dishCounts = new Map<string, number>();
    for (const order of activeOrders) {
      if (order.items) {
        for (const it of order.items) {
          const count = dishCounts.get(it.name) || 0;
          dishCounts.set(it.name, count + 1);
        }
      }
    }

    const popularDishes = Array.from(dishCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      startDate: startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      endDate: endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      ordersCount: filtered.length,
      completedCount: filtered.filter((o) => o.status === "completed").length,
      cancelledCount: filtered.filter((o) => o.status === "cancelled").length,
      totalBooked,
      totalCollected,
      outstanding,
      popularDishes,
    };
  };

  const reportData = React.useMemo(() => {
    return getFilteredReportsData();
  }, [orders, packages, reportType, reportMonthOffset]);

  // Data mapping for Recharts Financial Column Graph
  const financialChartData = React.useMemo(() => [
    { name: "Total Booked", amount: reportData.totalBooked, color: "var(--color-primary, #6366f1)" },
    { name: "Collected", amount: reportData.totalCollected, color: "var(--color-success, #10b981)" },
    { name: "Outstanding", amount: reportData.outstanding, color: "var(--color-warning, #f59e0b)" }
  ], [reportData.totalBooked, reportData.totalCollected, reportData.outstanding]);

  // Data mapping for Recharts popular dishes
  const popularDishesChartData = React.useMemo(() => reportData.popularDishes.map((dish) => ({
    name: dish.name,
    count: dish.count,
  })), [reportData.popularDishes]);

  return (
    <div className="reports-container">
      <header className="reports-header">
        <div>
          <h1 className="reports-title">
            Catering Reports &amp; Analytics
          </h1>
          <p className="reports-subtitle">
            Track cash flows, booking indices, and popular dishes.
          </p>
        </div>
        <div className="toggle-group">
          <button 
            className={`toggle-group-btn ${reportType === "weekly" ? "active" : ""}`} 
            onClick={() => { setReportType("weekly"); setReportMonthOffset(0); }}
          >
            Weekly View
          </button>
          <button 
            className={`toggle-group-btn ${reportType === "monthly" ? "active" : ""}`} 
            onClick={() => { setReportType("monthly"); setReportMonthOffset(0); }}
          >
            Monthly View
          </button>
        </div>
      </header>

      {/* Navigation Time-frame slider */}
      <div className="glass-card reports-period-nav">
        <button 
          className="btn btn-secondary btn-sm btn-icon-label" 
          onClick={() => setReportMonthOffset(prev => prev - 1)}
        >
          <ChevronLeft size={14} /> Prev {reportType === "weekly" ? "Week" : "Month"}
        </button>
        <strong className="period-label">
          Report Period: {reportData.startDate} &mdash; {reportData.endDate}
        </strong>
        <button 
          className="btn btn-secondary btn-sm btn-icon-label" 
          disabled={reportMonthOffset === 0} 
          onClick={() => setReportMonthOffset(prev => prev + 1)}
        >
          Next {reportType === "weekly" ? "Week" : "Month"} <ChevronRight size={14} />
        </button>
      </div>

      {/* Financial aggregators widgets */}
      <div className="dashboard-stats-grid">
        <div className="glass-card stat-box">
          <span className="stat-box-title">
            Total Sales (Booked)
          </span>
          <h2 className="stat-box-value text-primary-color">
            {currencySymbol}{reportData.totalBooked.toLocaleString("en-IN")}
          </h2>
          <div className="stat-box-desc">
            Billed total value (excluding cancellations)
          </div>
        </div>

        <div className="glass-card stat-box">
          <span className="stat-box-title">
            Revenue Collected
          </span>
          <h2 className="stat-box-value text-success-color">
            {currencySymbol}{reportData.totalCollected.toLocaleString("en-IN")}
          </h2>
          <div className="stat-box-desc">
            Total UPI &amp; Cash payments marked
          </div>
        </div>

        <div className="glass-card stat-box">
          <span className="stat-box-title">
            Pending Receivables
          </span>
          <h2 className="stat-box-value text-warning-color">
            {currencySymbol}{reportData.outstanding.toLocaleString("en-IN")}
          </h2>
          <div className="stat-box-desc">
            Outstanding milestone balances due
          </div>
        </div>
      </div>

      {/* Chart Visualizations Panel */}
      <div className="reports-charts-grid" style={{ gridTemplateColumns: "1fr" }}>
        {/* Cash Flow Distribution Chart */}
        <div className="glass-card chart-card">
          <h3 className="chart-card-title">
            <BarChart3 size={18} /> Cash Flow Chart ({currencySymbol})
          </h3>
          <div className="chart-container">
            {reportData.totalBooked === 0 ? (
              <div className="chart-empty-state">
                No billing data to show for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--ink-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--ink-muted)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                    background: "var(--bg-card)", 
                    borderColor: "var(--border-ink)", 
                    color: "var(--ink)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px"
                    }}
                    cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {financialChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Business flow indices details */}
      <div className="reports-details-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="glass-card details-card">
          <h3 className="details-card-title">
            Event Performance Index
          </h3>
          <div className="details-items-list text-sm">
            <div className="details-row">
              <span className="details-label">Total Events Handled:</span>
              <strong className="details-value">{reportData.ordersCount}</strong>
            </div>
            <div className="details-row">
              <span className="details-label">Completed Events:</span>
              <strong className="details-value text-success-color">{reportData.completedCount}</strong>
            </div>
            <div className="details-row">
              <span className="details-label">Cancelled Bookings:</span>
              <strong className="details-value text-danger-color">{reportData.cancelledCount}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
