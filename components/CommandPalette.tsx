"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, Plus, Settings, ClipboardList, Utensils, Users, X, LayoutDashboard, CalendarRange, TrendingUp } from "lucide-react";

type SearchResult = { type: "contact" | "item" | "order"; id: string; title: string; subtitle?: string };

export default function CommandPalette({ navigate }: { navigate: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      if (event.key === "Escape") setOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") { event.preventDefault(); navigate("order-form"); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [navigate]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("folio-open-command-palette", show);
    return () => window.removeEventListener("folio-open-command-palette", show);
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 0); }, [open]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return; }
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      setResults(response.ok ? await response.json() : []);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const go = (tab: string) => { navigate(tab); setOpen(false); setQuery(""); };
  if (!open) return null;

  return (
    <div className="command-palette-backdrop" role="dialog" aria-modal="true" aria-label="Search Folio" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="command-palette">
        <div className="command-palette-input"><Search size={18}/><input ref={input} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search clients, events, dishes, venues or phone numbers…" aria-label="Search Folio"/><button onClick={()=>setOpen(false)} aria-label="Close search"><X size={17}/></button></div>
        {query.length < 2 ? <div className="command-list">
          <p className="command-section-label">Quick action</p>
          <button onClick={()=>go("order-form")}><Plus size={17}/><span><strong>Create a new order</strong><small>Start an event booking</small></span><kbd>Ctrl N</kbd></button>
          <p className="command-section-label">Go to</p>
          <button onClick={()=>go("dashboard")}><LayoutDashboard size={17}/><span><strong>Dashboard</strong><small>Business overview</small></span></button>
          <button onClick={()=>go("orders")}><ClipboardList size={17}/><span><strong>Orders Book</strong><small>Bookings and billing</small></span></button>
          <button onClick={()=>go("contacts")}><Users size={17}/><span><strong>Customers & Contacts</strong><small>Client records</small></span></button>
          <button onClick={()=>go("calendar")}><CalendarRange size={17}/><span><strong>Calendar</strong><small>Event schedule</small></span></button>
          <button onClick={()=>go("library")}><Utensils size={17}/><span><strong>Food Library</strong><small>Dishes and package kits</small></span></button>
          <button onClick={()=>go("reports")}><TrendingUp size={17}/><span><strong>Reports</strong><small>Revenue and performance</small></span></button>
          <button onClick={()=>go("settings")}><Settings size={17}/><span><strong>Settings</strong><small>Backups, users, sync, and updates</small></span></button>
        </div> : <div className="command-list" aria-live="polite">
          {results.map((result)=><button key={`${result.type}:${result.id}`} onClick={()=>go(result.type==="item"?"library":result.type==="order"?"orders":"contacts")}>
            {result.type==="contact"?<Users size={17}/>:result.type==="item"?<Utensils size={17}/>:<ClipboardList size={17}/>}<span><strong>{result.title}</strong><small>{result.subtitle}</small></span><em>{result.type}</em>
          </button>)}
          {!results.length && <p className="command-empty">No matching Folio records.</p>}
        </div>}
      </div>
    </div>
  );
}