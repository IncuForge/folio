"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ModalOverlays from "@/components/ModalOverlays";
import { useAppContext } from "@/lib/AppContext";

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    setCurrentUser,
    activeTab,
    setActiveTab,
    isDarkMode,
    setIsDarkMode,
    toggleTheme,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    fetchItems,
    fetchPackages,
    fetchOrders,
    fetchSettings,
    handleLogout
  } = useAppContext();

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  // Load configuration and verify session on mount
  useEffect(() => {
    try {
      // Check saved theme preference
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        setIsDarkMode(true);
        document.documentElement.classList.add("dark");
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove("dark");
      }

      // Check saved sidebar collapse preference
      const savedCollapse = localStorage.getItem("sidebar-collapsed");
      if (savedCollapse === "true") {
        setIsSidebarCollapsed(true);
      }
    } catch (e) {
      console.warn("localStorage is not accessible in this browser context:", e);
    }

    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setCurrentUser(data.user);
        // Pre-fetch core databases for logged in session
        fetchItems();
        fetchPackages();
        fetchOrders();
        fetchSettings();
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error("Session verification failure", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCurrentUser(data.user);
        fetchItems();
        fetchPackages();
        fetchOrders();
        fetchSettings();
      } else {
        setLoginError(data.error || "Invalid email or password.");
      }
    } catch (err) {
      setLoginError("Failed to connect to the authentication server.");
    }
  };

  const handleSetSidebarCollapsed = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    localStorage.setItem("sidebar-collapsed", collapsed ? "true" : "false");
  };

  if (authLoading) {
    return (
      <div className="login-loading-screen">
        <div className="login-loading-content">
          <div className="login-logo animate-pulse">
            C
          </div>
          <span className="login-brand-title">Folio</span>
          <span className="login-loading-text">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="login-page-container">
        <div className="glass-card login-card">
          <div className="login-header">
            <div className="login-logo">
              C
            </div>
            <h1 className="login-title">
              Folio Login
            </h1>
            <p className="login-subtitle">
              Enter your seeded administrator or team credentials to access the catering system.
            </p>
          </div>

          {loginError && (
            <div className="login-error-badge">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="e.g. admin1@cater.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full-width">
              Sign In
            </button>
          </form>
        </div>

        <footer className="app-footer" style={{ position: "fixed", bottom: "1.5rem", left: 0, right: 0, border: "none" }}>
          Folio - built by <a href="https://incuforge.pages.dev/" target="_blank" rel="noreferrer" className="underline-link">IncuForge</a> @ 2026
          <span className="footer-separator">·</span>
          <a href="https://github.com/IncuForge/folio" target="_blank" rel="noreferrer" className="underline-link">GitHub</a>
        </footer>
      </div>
    );
  }

  return (
    <div className={`app-container ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isDarkMode={isDarkMode} 
        toggleTheme={toggleTheme} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={handleSetSidebarCollapsed}
        sessionUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {children}
        <footer className="app-footer">
          Folio - built by <a href="https://incuforge.pages.dev/" target="_blank" rel="noreferrer" className="underline-link">IncuForge</a> @ 2026
          <span className="footer-separator">·</span>
          <a href="https://github.com/IncuForge/folio" target="_blank" rel="noreferrer" className="underline-link">GitHub</a>
        </footer>
      </main>

      <ModalOverlays />
    </div>
  );
}
