"use client";

import React from "react";
import { useAppContext } from "@/lib/AppContext";
import { Order } from "@/types/schema";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarView() {
  const {
    orders,
    currentMonth,
    setCurrentMonth,
    setSelectedOrder
  } = useAppContext();

  const handleEventClick = (order: Order) => {
    setSelectedOrder(order);
  };

  const generateMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const totalDays = lastDay.getDate();
    const startOffset = firstDay.getDay();

    const days = [];

    // Padding for previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Padding for next month
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthDays = React.useMemo(() => {
    return generateMonthDays(currentMonth);
  }, [currentMonth]);

  const todayString = React.useMemo(() => {
    const today = new Date();
    const ty = today.getFullYear();
    const tm = String(today.getMonth() + 1).padStart(2, '0');
    const td = String(today.getDate()).padStart(2, '0');
    return `${ty}-${tm}-${td}`;
  }, []);

  return (
    <div className="calendar-container">
      <header className="calendar-header">
        <div>
          <h1 className="calendar-title">
            Booking Calendar
          </h1>
          <p className="calendar-subtitle">
            Track bookings dynamically to schedule kitchen preps.
          </p>
        </div>
        <div className="month-nav-controls">
          <button 
            type="button" 
            className="btn btn-secondary btn-sm btn-icon-only" 
            onClick={handlePrevMonth}
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="month-display-label">
            {currentMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </h3>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm btn-icon-only" 
            onClick={handleNextMonth}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="glass-card calendar-card-panel">
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="calendar-header-cell">
              {day}
            </div>
          ))}

          {monthDays.map((dayObj, index) => {
            const yyyy = dayObj.date.getFullYear();
            const mm = String(dayObj.date.getMonth() + 1).padStart(2, '0');
            const dd = String(dayObj.date.getDate()).padStart(2, '0');
            const dateString = `${yyyy}-${mm}-${dd}`;
            
            const dayEvents = orders.filter((o) => {
              const start = o.event_date;
              const end = o.event_end_date || o.event_date;
              return dateString >= start && dateString <= end;
            });
            
            const isToday = todayString === dateString;

            return (
              <div 
                key={index} 
                className={`calendar-cell ${
                  dayObj.isCurrentMonth ? "" : "outside-month"
                } ${isToday ? "is-today" : ""}`}
              >
                <div className="calendar-date-number">
                  {dayObj.date.getDate()}
                </div>
                <div className="calendar-events-container">
                  {dayEvents.map((evt) => (
                    <div 
                      key={evt.id} 
                      id={"calendar-event-" + evt.id}
                      className={`calendar-event-marker status-${evt.status}`}
                      onClick={() => handleEventClick(evt)}
                      title={`${evt.client_name} - ${evt.event_name} (${evt.guest_count} guests)`}
                    >
                      {evt.client_name} ({evt.guest_count})
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
