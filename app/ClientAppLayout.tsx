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
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupBusinessName, setSetupBusinessName] = useState("");
  const [setupUsername, setSetupUsername] = useState("admin");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState("");
  const [setupCurrency, setSetupCurrency] = useState("₹");
  const [setupError, setSetupError] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [showGuide, setShowGuide] = useState(false);
  const [mobileSetupMode, setMobileSetupMode] = useState<"local" | "connect" | null>(null);
  const [pairingAddress, setPairingAddress] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const isNativeMobile = typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

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

    checkInitialState();
  }, []);

  async function checkInitialState() {
    try {
      const setupResponse = await fetch("/api/setup");
      const setupData = await setupResponse.json();
      if (setupResponse.ok && setupData.setupRequired) {
        setSetupRequired(true);
        setAuthLoading(false);
        return;
      }
    } catch (error) {
      console.error("Setup-state check failed", error);
    }
    await checkAuth();
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setCurrentUser(data.user);
        setShowGuide(localStorage.getItem("folio-onboarding-dismissed") !== "1");
        // Pre-fetch core databases for logged in session
        fetchItems();
        fetchPackages();
        fetchOrders();
        fetchSettings();
        fetch("/api/backup/automatic", { method: "POST" }).catch(() => undefined);
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
        setShowGuide(localStorage.getItem("folio-onboarding-dismissed") !== "1");
        fetchItems();
        fetchPackages();
        fetchOrders();
        fetchSettings();
        fetch("/api/backup/automatic", { method: "POST" }).catch(() => undefined);
      } else {
        setLoginError(data.error || "Invalid email or password.");
      }
    } catch (err) {
      setLoginError("Failed to connect to the authentication server.");
    }
  }

  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");
    if (setupPassword !== setupPasswordConfirm) {
      setSetupError("Passwords do not match.");
      return;
    }
    setSetupSaving(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: setupBusinessName,
          username: setupUsername,
          password: setupPassword,
          currencySymbol: setupCurrency,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSetupError(data.error || "Setup could not be completed.");
        return;
      }
      setLoginEmail(setupUsername);
      setLoginPassword("");
      setSetupRequired(false);
    } catch {
      setSetupError("Setup could not connect to the local data service.");
    } finally {
      setSetupSaving(false);
    }
  };

  const scanDesktopPairingCode = async () => {
    setPairingError("");
    try {
      const scanner = await import("@tauri-apps/plugin-barcode-scanner");
      const permission = await scanner.checkPermissions();
      if (permission !== "granted" && await scanner.requestPermissions() !== "granted") throw new Error("Camera access is required to scan the desktop QR code.");
      const result = await scanner.scan({ formats: [scanner.Format.QRCode], cameraDirection: "back" });
      const payload = JSON.parse(result.content);
      if (!payload.address || !payload.code) throw new Error("This is not a Folio pairing code.");
      setPairingAddress(payload.address); setPairingCode(payload.code);
    } catch (error) { setPairingError(error instanceof Error ? error.message : "The QR code could not be scanned."); }
  };

  const connectToDesktop = async () => {
    setPairingLoading(true); setPairingError("");
    try {
      const address = pairingAddress.trim().replace(/\/$/, "");
      if (!address || !pairingCode.trim()) throw new Error("Enter the desktop address and pairing code.");
      const { fetch: mobileFetch } = await import("@tauri-apps/plugin-http");
      const pairResponse = await mobileFetch(`${address}/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pairingCode.trim(), deviceName: "Folio Android" }) });
      const pairData = await pairResponse.json();
      if (!pairResponse.ok) throw new Error(pairData.error || "The desktop rejected this pairing request.");
      const snapshotResponse = await mobileFetch(`${address}${pairData.snapshotUrl}`, { headers: { Authorization: `Bearer ${pairData.deviceToken}` } });
      const snapshotData = await snapshotResponse.json();
      if (!snapshotResponse.ok) throw new Error(snapshotData.error || "The desktop snapshot could not be downloaded.");
      const restoreResponse = await fetch("/api/setup/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup: snapshotData.snapshot }) });
      const restoreData = await restoreResponse.json();
      if (!restoreResponse.ok) throw new Error(restoreData.error || "The desktop snapshot could not be restored.");
      localStorage.setItem("folio-sync-address", address); localStorage.setItem("folio-sync-device-token", pairData.deviceToken); window.location.reload();
    } catch (error) { setPairingError(error instanceof Error ? error.message : "Could not connect to Folio Desktop."); }
    finally { setPairingLoading(false); }
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

  if (setupRequired) {
    if (isNativeMobile && mobileSetupMode === null) {
      return (
        <div className="login-page-container mobile-setup-choice-page"><div className="glass-card login-card mobile-setup-choice-card">
          <div className="login-header"><div className="login-logo">F</div><p className="text-muted-color mobile-setup-kicker">FOLIO ANDROID</p><h1 className="login-title">How should this phone begin?</h1><p className="login-subtitle">Connect to your existing Folio Desktop or create a separate workspace stored only on this phone.</p></div>
          <div className="mobile-setup-options">
            <button type="button" className="mobile-setup-option" onClick={() => setMobileSetupMode("connect")}><strong>Connect to Folio Desktop</strong><span>Scan the pairing QR shown in Desktop Settings.</span></button>
            <button type="button" className="mobile-setup-option" onClick={() => setMobileSetupMode("local")}><strong>Create on this phone</strong><span>Start an independent, offline Folio workspace.</span></button>
          </div>
        </div></div>
      );
    }
    if (isNativeMobile && mobileSetupMode === "connect") {
      return (
        <div className="login-page-container mobile-pair-page"><div className="glass-card login-card mobile-pair-card">
          <div className="login-header"><div className="login-logo">F</div><p className="text-muted-color mobile-setup-kicker">PAIR WITH DESKTOP</p><h1 className="login-title">Connect this phone</h1><p className="login-subtitle">In Folio Desktop, open Settings → Mobile Devices &amp; Sync → Pair New Device.</p></div>
          {pairingError && <div className="login-error-badge">{pairingError}</div>}
          <button type="button" className="btn btn-primary btn-full-width" onClick={scanDesktopPairingCode}>Scan Desktop QR</button>
          <div className="mobile-pair-divider"><span>or enter manually</span></div>
          <div className="login-form">
            <div className="form-group"><label className="form-label">Desktop address</label><input className="form-input" value={pairingAddress} onChange={(event) => setPairingAddress(event.target.value)} placeholder="http://192.168.1.20:47631" /></div>
            <div className="form-group"><label className="form-label">Pairing code</label><input className="form-input" inputMode="numeric" value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} placeholder="000000" /></div>
            <button type="button" className="btn btn-primary btn-full-width" disabled={pairingLoading} onClick={connectToDesktop}>{pairingLoading ? "Connecting…" : "Connect & Import"}</button>
            <button type="button" className="btn btn-secondary btn-full-width" onClick={() => setMobileSetupMode(null)}>Back</button>
          </div>
        </div></div>
      );
    }
    const pages = [
      {
        title: "Welcome to Folio",
        body: "Folio keeps bookings, menus, payment collections, and kitchen preparation together. Your data stays under your control and can be moved using a complete Folio backup.",
      },
      {
        title: "A simple working rhythm",
        body: "Build your Food Library, combine dishes into Package Kits, create an Order for each event, record collection milestones, then print the menu or kitchen sheet.",
      },
    ];

    if (setupStep < pages.length) {
      const page = pages[setupStep];
      return (
        <div className="login-page-container">
          <div className="glass-card login-card" style={{ maxWidth: "560px" }}>
            <div className="login-header">
              <div className="login-logo">F</div>
              <p className="text-muted-color" style={{ fontSize: "0.72rem" }}>FIRST-RUN SETUP · {setupStep + 1} OF 3</p>
              <h1 className="login-title">{page.title}</h1>
              <p className="login-subtitle" style={{ lineHeight: 1.7 }}>{page.body}</p>
            </div>
            {setupStep === 1 && (
              <div style={{ display: "grid", gap: "0.6rem", margin: "1.25rem 0" }}>
                {["Food Library → reusable dishes", "Package Kits → reusable menus", "Orders → event sessions and pricing", "Collections → deposit, midway, settlement", "Kitchen Sheets → preparation at a glance"].map((item) => (
                  <div key={item} style={{ borderTop: "1px solid var(--border-ink)", paddingTop: "0.6rem", fontSize: "0.82rem" }}>{item}</div>
                ))}
              </div>
            )}
            <button className="btn btn-primary btn-full-width" onClick={() => setSetupStep(setupStep + 1)}>
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="login-page-container">
        <div className="glass-card login-card" style={{ maxWidth: "560px" }}>
          <div className="login-header">
            <div className="login-logo">F</div>
            <p className="text-muted-color" style={{ fontSize: "0.72rem" }}>FIRST-RUN SETUP · 3 OF 3</p>
            <h1 className="login-title">Create your workspace</h1>
            <p className="login-subtitle">This account becomes the local owner of Folio.</p>
          </div>
          {setupError && <div className="login-error-badge">⚠️ {setupError}</div>}
          <form onSubmit={handleInitialSetup} className="login-form">
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input className="form-input" required value={setupBusinessName} onChange={(e) => setSetupBusinessName(e.target.value)} placeholder="Your catering business" />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Username</label>
              <input className="form-input" required value={setupUsername} onChange={(e) => setSetupUsername(e.target.value)} placeholder="admin" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" required minLength={8} value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" required minLength={8} value={setupPasswordConfirm} onChange={(e) => setSetupPasswordConfirm(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-input" value={setupCurrency} onChange={(e) => setSetupCurrency(e.target.value)}>
                <option value="₹">₹ Indian Rupee</option>
                <option value="$">$ US Dollar</option>
                <option value="€">€ Euro</option>
                <option value="£">£ Pound Sterling</option>
              </select>
            </div>
            <button className="btn btn-primary btn-full-width" disabled={setupSaving}>
              {setupSaving ? "Creating Folio…" : "Finish Setup"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="login-page-container">
        <div className="login-split">
        <div className="glass-card login-card login-card-panel">
          <div className="login-header">
            <div className="login-logo">
              F
            </div>
            <h1 className="login-title">
              Folio Login
            </h1>
            <p className="login-subtitle">
              Enter your local owner or team credentials.
            </p>
          </div>

          {loginError && (
            <div className="login-error-badge">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                required
                className="form-input"
                  placeholder="e.g. admin"
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

        <aside className="login-attribution-panel">
          <span className="login-attribution-kicker">LOCAL-FIRST CATERING OPERATIONS</span>
          <div>
            <h2 className="login-attribution-title">Built thoughtfully for teams that run real events.</h2>
            <p className="login-attribution-copy">Folio keeps bookings, menus, collections, kitchen preparation, and portable backups together on your own computer.</p>
          </div>
          <div className="login-attribution-credit">
            <span>Designed &amp; developed by</span>
            <a href="https://incuforge.pages.dev/" target="_blank" rel="noreferrer">IncuForge</a>
            <span>© 2026</span>
          </div>
        </aside>
        </div>
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
        </footer>
      </main>

      <ModalOverlays />
      {showGuide && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="getting-started-title">
          <div className="glass-card" style={{ width: "min(620px, calc(100vw - 2rem))", padding: "2rem" }}>
            <p className="text-muted-color" style={{ fontSize: "0.7rem" }}>GETTING STARTED</p>
            <h2 id="getting-started-title" style={{ fontSize: "1.8rem", margin: "0.3rem 0 0.8rem" }}>Your Folio workflow</h2>
            <p className="text-muted-color" style={{ lineHeight: 1.7 }}>
              Add reusable dishes first, group common menus into package kits, then create event orders and record payment collections as work progresses.
            </p>
            <div style={{ display: "grid", gap: "0.65rem", margin: "1.4rem 0" }}>
              {[
                ["01", "Food Library", "Store dishes, prices, ingredients, and availability."],
                ["02", "Package Kits", "Build reusable menu combinations."],
                ["03", "Orders", "Plan sessions, guests, menus, pricing, and collections."],
                ["04", "Kitchen & Print", "Produce preparation sheets, menus, and receipts."],
                ["05", "Backups", "Keep a complete portable copy from Settings."],
              ].map(([number, title, description]) => (
                <div key={number} style={{ display: "grid", gridTemplateColumns: "2rem 8rem 1fr", gap: "0.6rem", borderTop: "1px solid var(--border-ink)", paddingTop: "0.65rem", fontSize: "0.8rem" }}>
                  <span className="text-muted-color">{number}</span><strong>{title}</strong><span className="text-muted-color">{description}</span>
                </div>
              ))}
            </div>
            <button data-mobile-back-close className="btn btn-primary btn-full-width" onClick={() => {
              localStorage.setItem("folio-onboarding-dismissed", "1");
              setShowGuide(false);
            }}>Start Using Folio</button>
          </div>
        </div>
      )}
    </div>
  );
}
