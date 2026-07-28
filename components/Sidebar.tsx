"use client";
 
import React from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  CalendarRange, 
  Utensils, 
  TrendingUp, 
  Settings as SettingsIcon,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Users
} from "lucide-react";

const LogoIcon = ({ size = 18 }: { size?: number }) => (
  <svg 
    viewBox="0 0 32 32" 
    width={size} 
    height={size} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <path 
      d="M9 7h14c2 0 3 1.5 3 3v4c0 1.5-1 3-3 3H9c-2 0-3 1.5-3 3v4c0 1.5 1 3 3 3h14" 
      stroke="currentColor" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);
 
interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser?: { email: string; role: string } | null;
  onLogout?: () => void;
}
 
export default function Sidebar({
  activeTab,
  setActiveTab,
  isDarkMode,
  toggleTheme,
  isCollapsed,
  setIsCollapsed,
  sessionUser,
  onLogout,
}: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "Orders Book", icon: ClipboardList },
    { id: "contacts", label: "Customers", icon: Users },
    { id: "calendar", label: "Calendar", icon: CalendarRange },
    { id: "library", label: "Food Library", icon: Utensils },
    { id: "reports", label: "Reports", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];
 
  const mainNavItems = navItems.filter((item) => item.id !== "settings");
  const mobilePrimaryIds = new Set(["dashboard", "orders", "calendar", "library"]);
  const mobilePrimaryItems = navItems.filter((item) => mobilePrimaryIds.has(item.id));
  const settingsItem = navItems.find((item) => item.id === "settings");
 
  return (
    <>
      {/* Mobile Top Bar (Header) - Visible only on screens < 1024px */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <div className="brand-icon-sm">
            <LogoIcon size={15} />
          </div>
          <span className="brand-text-sm">
            Folio
          </span>
        </div>
 
        <div className="mobile-actions">
          <button 
            type="button" 
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          
          <button 
            type="button" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`theme-toggle-btn ${isMobileMenuOpen ? "active" : ""}`}
            title="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
 
      {/* Hamburger Drawer for mobile */}
      <div className={`mobile-hamburger-drawer ${isMobileMenuOpen ? "open" : ""}`}>
        {sessionUser && (
          <div className="sidebar-session-box" style={{ margin: "0 0 1rem 0", display: "flex", flexDirection: "column" }}>
            <span className="session-header">User Session</span>
            <span className="session-email" title={sessionUser.email}>{sessionUser.email}</span>
            <span className="session-role">{sessionUser.role}</span>
          </div>
        )}
 
        <div className="drawer-menu-items" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
          {navItems.filter((item) => ["contacts", "reports"].includes(item.id)).map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`sidebar-item-btn ${activeTab === item.id ? "active" : ""}`}>
                <Icon size={20} className="sidebar-item-icon" />
                <span className="sidebar-item-label">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => {
              setActiveTab("settings");
              setIsMobileMenuOpen(false);
            }}
            className={`sidebar-item-btn ${activeTab === "settings" ? "active" : ""}`}
            style={{ width: "100%", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", background: "none", border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
          >
            <SettingsIcon size={20} className="sidebar-item-icon" />
            <span className="sidebar-item-label" style={{ display: "inline-block", opacity: 1, visibility: "visible", maxWidth: "none", fontFamily: "var(--font-sans)", fontWeight: 600 }}>Settings Configuration</span>
          </button>
 
          {onLogout && (
            <button 
              type="button" 
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLogout();
              }}
              className="sidebar-item-btn btn-logout-drawer"
              style={{ width: "100%", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", background: "none", border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)", color: "var(--danger-text)" }}
            >
              <LogOut size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label" style={{ display: "inline-block", opacity: 1, visibility: "visible", maxWidth: "none", fontFamily: "var(--font-sans)", fontWeight: 600 }}>Sign Out Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar - Visible only on screens < 1024px */}
      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === "orders" && activeTab === "order-form");
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mobile-nav-link ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={`mobile-icon-box ${isActive ? "active" : ""}`}>
                <Icon size={18} />
              </div>
              <span className="mobile-nav-label">{item.id === "orders" ? "Orders" : item.id === "library" ? "Kitchen" : item.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setIsMobileMenuOpen(true)} className={`mobile-nav-link ${["contacts", "reports", "settings"].includes(activeTab) ? "active" : ""}`} aria-label="More navigation options" aria-expanded={isMobileMenuOpen}>
          <div className={`mobile-icon-box ${["contacts", "reports", "settings"].includes(activeTab) ? "active" : ""}`}><Menu size={18} /></div>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>

      {/* Desktop Navigation Sidebar - Hidden on mobile screens */}
      <aside className="sidebar">
        {/* Floating Collapse trigger button positioned absolutely on the border line */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="sidebar-collapse-trigger"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-lg">
              <LogoIcon size={18} />
            </div>
            <span className="brand-text-lg">
              Folio
            </span>
          </div>
        </div>

        {/* Main navigation list (excluding settings) */}
        <nav className="sidebar-nav">
          <ul className="sidebar-list">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === "orders" && activeTab === "order-form");
              return (
                <li key={item.id} className="sidebar-list-item">
                  <button 
                    onClick={() => setActiveTab(item.id)}
                    className={`sidebar-item-btn ${isActive ? "active" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon size={20} className="sidebar-item-icon" />
                    <span className="sidebar-item-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Settings and Dark Mode and Collapse toggles pushed to the bottom of the sidebar */}
        <div className="sidebar-bottom-container">
          {sessionUser && (
            <div className="sidebar-session-box">
              {!isCollapsed && (
                <>
                  <div className="session-header">User Session</div>
                  <div className="session-email" title={sessionUser.email}>{sessionUser.email}</div>
                  <div className="session-role">{sessionUser.role}</div>
                </>
              )}
            </div>
          )}

          <button 
            type="button" 
            onClick={toggleTheme}
            className="sidebar-item-btn"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} className="sidebar-item-icon" /> : <Moon size={20} className="sidebar-item-icon" />}
            <span className="sidebar-item-label">
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {settingsItem && (
            <button 
              onClick={() => setActiveTab(settingsItem.id)}
              className={`sidebar-item-btn ${activeTab === settingsItem.id ? "active" : ""}`}
              title={isCollapsed ? settingsItem.label : undefined}
            >
              <settingsItem.icon size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">{settingsItem.label}</span>
            </button>
          )}

          {onLogout && (
            <button 
              type="button" 
              onClick={onLogout}
              className="sidebar-item-btn btn-logout-desktop"
              title="Sign Out"
            >
              <LogOut size={20} className="sidebar-item-icon" />
              <span className="sidebar-item-label">Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
