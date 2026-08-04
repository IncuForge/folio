"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "@/lib/AppContext";
import { Database, FileJson, FileSpreadsheet, UserPlus, Trash2, Users, KeyRound, Lock, Upload, ShieldCheck, Clock, BookOpen, RefreshCw, Download } from "lucide-react";
import { saveResponseToFile } from "@/lib/save-file";
import { getCurrencyOptions } from "@/lib/currencies";

type PairedSyncDevice = { id: string; name: string; pairedAt: number; lastSeenAt: number };
type LiveSyncStatus = { phase: string; revision: number; pending: boolean; lastSyncedAt?: string; message?: string; conflicts?: number };

export default function SettingsView() {
  const confirmationResolver = useRef<((value: boolean) => void) | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string } | null>(null);
  const requestConfirmation = (message: string, title = "Confirm action") => new Promise<boolean>((resolve) => {
    confirmationResolver.current = resolve;
    setConfirmation({ title, message });
  });
  const closeConfirmation = (accepted: boolean) => {
    confirmationResolver.current?.(accepted);
    confirmationResolver.current = null;
    setConfirmation(null);
  };
  const [activeSettingsSection, setActiveSettingsSection] = useState<"backup" | "branding" | "team" | "devices" | "about" | "danger">("backup");
  const { 
    currentUser, 
    pdfBrandName, 
    setPdfBrandName, 
    pdfBrandLogo,
    setPdfBrandLogo,
    currencySymbol,
    currencyCode,
    setCurrencySymbol,
    paymentMethods,
    setPaymentMethods
  } = useAppContext();
  
  const currencyOptions = React.useMemo(() => getCurrencyOptions(), []);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager">("manager");

  // Admin: change another user's password inline
  const [changePwdUserId, setChangePwdUserId] = useState<string | null>(null);
  const [changePwdValue, setChangePwdValue] = useState("");
  const [changePwdLoading, setChangePwdLoading] = useState(false);

  // Self: change own password
  const [selfNewPwd, setSelfNewPwd] = useState("");
  const [selfNewPwdConfirm, setSelfNewPwdConfirm] = useState("");
  const [selfPwdLoading, setSelfPwdLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [localBrandName, setLocalBrandName] = useState("");
  const [localBrandLogo, setLocalBrandLogo] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [autoBackupFrequency, setAutoBackupFrequency] = useState("daily");
  const [autoBackupRetention, setAutoBackupRetention] = useState(14);
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("0.1.0");
  const [updateState, setUpdateState] = useState<"idle" | "checking" | "current" | "available" | "installing" | "error">("idle");
  const [availableVersion, setAvailableVersion] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateMessage, setUpdateMessage] = useState("Check GitHub Releases for a newer signed build.");
  const pendingUpdateRef = React.useRef<any>(null);
  const [syncAddress, setSyncAddress] = useState("");
  const [pairedDevices, setPairedDevices] = useState<PairedSyncDevice[]>([]);
  const [syncRevision, setSyncRevision] = useState(0);
  const [liveSyncStatus, setLiveSyncStatus] = useState<LiveSyncStatus | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState(0);
  const [pairingQr, setPairingQr] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);

  useEffect(() => {
    setLocalBrandName(pdfBrandName || "");
  }, [pdfBrandName]);

  useEffect(() => {
    setLocalBrandLogo(pdfBrandLogo || "");
  }, [pdfBrandLogo]);

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setAutoBackupEnabled(data.autoBackupEnabled !== "false");
        setAutoBackupFrequency(data.autoBackupFrequency || "daily");
        setAutoBackupRetention(Number(data.autoBackupRetention || 14));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const desktop = "__TAURI_INTERNALS__" in window && !/android|iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsDesktopRuntime(desktop);
    if (desktop) {
      import("@tauri-apps/api/app").then(({ getVersion }) => getVersion()).then(setCurrentVersion).catch(() => undefined);
      import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke<{ address: string; revision: number; pairedDevices: PairedSyncDevice[] }>("sync_status"))
        .then((status) => {
          setSyncAddress(status.address);
          setPairedDevices(status.pairedDevices);
          setSyncRevision(status.revision);
        })
        .catch(() => undefined);
    }
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const newPaymentMethodInputRef = React.useRef<HTMLInputElement>(null);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setUsersList(data);
      }
    } catch (e) {
      console.error("Error loading users", e);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    if (!newEmail || !newPassword) {
      setErrorMsg("Please fill in email and password.");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMsg(`User ${newEmail} created successfully.`);
        setNewEmail("");
        setNewPassword("");
        setNewRole("manager");
        loadUsers();
      } else {
        setErrorMsg(data.error || "Failed to create user.");
      }
    } catch (err) {
      setErrorMsg("Failed to connect to the server.");
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!(await requestConfirmation(`Delete user "${email}"? This account will immediately lose access.`, "Delete team account"))) return;
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg(`User ${email} deleted successfully.`);
        loadUsers();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to delete user.");
      }
    } catch (err) {
      setErrorMsg("Failed to connect to the server.");
    }
  };

  const handleAdminChangePassword = async (userId: string) => {
    if (!changePwdValue || changePwdValue.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }
    setChangePwdLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: changePwdValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Password updated successfully.");
        setChangePwdUserId(null);
        setChangePwdValue("");
      } else {
        setErrorMsg(data.error || "Failed to update password.");
      }
    } catch {
      setErrorMsg("Failed to connect to the server.");
    } finally {
      setChangePwdLoading(false);
    }
  };

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!selfNewPwd || selfNewPwd.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }
    if (selfNewPwd !== selfNewPwdConfirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (!currentUser) return;
    setSelfPwdLoading(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: selfNewPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Your password has been updated. Please log in again.");
        setSelfNewPwd("");
        setSelfNewPwdConfirm("");
      } else {
        setErrorMsg(data.error || "Failed to update password.");
      }
    } catch {
      setErrorMsg("Failed to connect to the server.");
    } finally {
      setSelfPwdLoading(false);
    }
  };

  const readRestoreFile = async () => {
    if (!restoreFile) {
      setErrorMsg("Choose a Folio backup file first.");
      return null;
    }
    if (restoreFile.size > 50 * 1024 * 1024) {
      setErrorMsg("Backup files are limited to 50 MB.");
      return null;
    }
    try {
      return JSON.parse(await restoreFile.text());
    } catch {
      setErrorMsg("The selected file is not valid JSON.");
      return null;
    }
  };

  const handleValidateRestore = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    const backup = await readRestoreFile();
    if (!backup) return;
    setRestoreLoading(true);
    try {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, confirm: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backup validation failed.");
      setRestorePreview(data);
    } catch (error) {
      setRestorePreview(null);
      setErrorMsg(error instanceof Error ? error.message : "Backup validation failed.");
    } finally {
      setRestoreLoading(false);
    }
  };

  const downloadSafetyBackup = async () => {
    const response = await fetch("/api/export/backup", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not create the pre-restore safety backup.");
    await saveResponseToFile(response, "folio-pre-restore-backup.folio-backup.json");
  };

  const handleExport = async (endpoint: string, fallbackName: string) => {
    setErrorMsg("");
    try {
      await saveResponseToFile(await fetch(endpoint, { cache: "no-store" }), fallbackName);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Export failed.");
    }
  };

  const handleRestore = async () => {
    const backup = await readRestoreFile();
    if (!backup || !restorePreview) return;
    if (!(await requestConfirmation("All current Folio data will be replaced. A safety backup will download first.", "Restore this backup?"))) return;
    setRestoreLoading(true);
    setErrorMsg("");
    try {
      await downloadSafetyBackup();
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, confirm: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restore failed.");
      setSuccessMsg("Backup restored. Sign in again to load the restored workspace.");
      setRestorePreview(null);
      await fetch("/api/auth/logout", { method: "POST" });
      setTimeout(() => window.location.reload(), 1800);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setRestoreLoading(false);
    }
  };

  const saveBackupPolicy = async () => {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoBackupEnabled, autoBackupFrequency, autoBackupRetention }),
    });
    if (response.ok) setSuccessMsg("Automatic backup policy saved.");
    else setErrorMsg("Could not save the automatic backup policy.");
  };

  const checkForUpdates = async () => {
    setUpdateState("checking");
    setUpdateMessage("Checking the signed Folio release channel…");
    pendingUpdateRef.current = null;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check({ timeout: 30000 });
      if (!update) {
        setUpdateState("current");
        setUpdateMessage(`Folio ${currentVersion} is up to date.`);
        return;
      }
      pendingUpdateRef.current = update;
      setAvailableVersion(update.version);
      setUpdateNotes(update.body || "This release contains Folio improvements and fixes.");
      setUpdateState("available");
      setUpdateMessage(`Folio ${update.version} is ready to install.`);
    } catch (error) {
      console.error("Update check failed", error);
      setUpdateState("error");
      setUpdateMessage("Could not reach the signed update channel. It may not have a published release yet.");
    }
  };

  const installUpdate = async () => {
    const update = pendingUpdateRef.current;
    if (!update) return;
    setUpdateState("installing");
    setUpdateMessage(`Downloading Folio ${availableVersion}…`);
    try {
      await update.downloadAndInstall((event: { event: string }) => {
        if (event.event === "Finished") setUpdateMessage("Update installed. Restarting Folio…");
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      console.error("Update installation failed", error);
      setUpdateState("error");
      setUpdateMessage("The update could not be installed. Your current Folio installation was not changed.");
    }
  };

  const loadSyncStatus = async () => {
    if (!("__TAURI_INTERNALS__" in window) || /android|iphone|ipad|ipod/i.test(navigator.userAgent)) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const status = await invoke<{ running: boolean; address: string; revision: number; pairedDevices: PairedSyncDevice[] }>("sync_status");
      setSyncAddress(status.address);
      setPairedDevices(status.pairedDevices || []);
      setSyncRevision(status.revision);
    } catch (error) {
      console.error("Could not read sync status", error);
    }
  };

  useEffect(() => {
    const update = (event: Event) => setLiveSyncStatus((event as CustomEvent<LiveSyncStatus>).detail);
    window.addEventListener("folio-sync-status", update);
    return () => window.removeEventListener("folio-sync-status", update);
  }, []);

  const revokeSyncDevice = async (deviceId: string) => {
    if (!(await requestConfirmation("This device will stop syncing immediately and must be paired again.", "Revoke paired device?"))) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("sync_revoke_device", { deviceId });
      await loadSyncStatus();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Could not revoke this device.");
    }
  };
  const resolveConflicts = async (choice: "local" | "remote") => {
    const description = choice === "local" ? "this device's versions" : "the hub versions";
    if (!(await requestConfirmation(`Use ${description} for every current conflict? Create a recovery backup first.`, "Resolve synchronization conflicts?"))) return;
    try {
      const { resolveSyncConflicts } = await import("@/desktop/src/sync-coordinator");
      await resolveSyncConflicts(choice);
      setLiveSyncStatus((current) => current ? { ...current, phase: "idle", pending: false, conflicts: 0 } : current);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Could not resolve synchronization conflicts.");
    }
  };
  const createPairingCode = async () => {
    setPairingLoading(true);
    setErrorMsg("");
    try {
      const backupResponse = await fetch("/api/export/backup");
      if (!backupResponse.ok) throw new Error("Could not prepare a desktop snapshot.");
      const snapshot = await backupResponse.json();
      const [{ invoke }, QRCode] = await Promise.all([import("@tauri-apps/api/core"), import("qrcode")]);
      const pairing = await invoke<{ address: string; code: string; expiresAt: number; payload: string }>("sync_create_pairing", { snapshot });
      setSyncAddress(pairing.address);
      setPairingCode(pairing.code);
      setPairingExpiresAt(pairing.expiresAt);
      setPairingQr(await QRCode.toDataURL(pairing.payload, { width: 220, margin: 1, color: { dark: "#111318", light: "#ffffff" } }));
      await loadSyncStatus();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Could not create a pairing code.");
    } finally {
      setPairingLoading(false);
    }
  };
  const eraseLocalData = async () => {
    const confirmation = window.prompt(
      "This permanently removes all Folio orders, library items, packages, users, settings, and automatic backups from this computer. Type DELETE to continue."
    );
    if (confirmation !== "DELETE") return;
    const response = await fetch("/api/system/erase", { method: "POST" });
    if (!response.ok) {
      setErrorMsg("Folio could not erase the local data.");
      return;
    }
    localStorage.clear();
    window.location.reload();
  };
  return (
    <div className="settings-container" data-active-section={activeSettingsSection}>
      <header>
        <h1 className="settings-title">
          System Settings &amp; Backups
        </h1>
        <p className="settings-subtitle">
          Maintain database backups, export spreadsheets, and configure user permissions.
        </p>
      </header>

      <nav className="settings-section-nav" aria-label="Settings sections">
        {([
          ["backup", "Backup & Data"],
          ["branding", "Branding & Receipt"],
          ["team", "Team & Security"],
          ["devices", "Devices & Sync"],
          ["about", "About & Updates"],
          ["danger", "Danger Zone"],
        ] as const).filter(([id]) => {
          if (id === "devices" || id === "danger") return isDesktopRuntime && isAdmin;
          if (id === "about") return isDesktopRuntime;
          return true;
        }).map(([id, label]) => (
          <button key={id} type="button" className={activeSettingsSection === id ? "active" : ""} aria-current={activeSettingsSection === id ? "page" : undefined} onClick={() => setActiveSettingsSection(id)}>
            {label}
          </button>
        ))}
      </nav>

      {errorMsg && (
        <div role="alert" className="folio-alert folio-alert-danger" style={{ marginBottom: "1.5rem" }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" aria-live="polite" className="folio-alert folio-alert-success" style={{ marginBottom: "1.5rem" }}>
          ✅ {successMsg}
        </div>
      )}

      <div className="settings-grid">
        {/* Backups Panel - Admins Only */}
        {isAdmin ? (
          <div className="glass-card settings-panel settings-panel-backup" data-settings-section="backup">
            <h3 className="panel-title">
              Database Backups
            </h3>
            <p className="panel-desc">
              Create a portable copy of orders, history, library items, package kits, settings, and credential hashes.
            </p>

            <div className="panel-actions-list">
              <button
                type="button"
                onClick={() => handleExport("/api/export/backup", "folio-backup.folio-backup.json")}
                className="btn btn-secondary btn-full-width"
              >
                <Database size={16} /> Download Complete Folio Backup
              </button>
              <button
                type="button"
                onClick={() => handleExport("/api/export/json", "folio-export.json")}
                className="btn btn-secondary btn-full-width"
              >
                <FileJson size={16} /> Download Full Dump (JSON)
              </button>
            </div>

            <section className="settings-panel-section">
              <h4 className="users-column-title"><Upload size={15} /> Restore on this computer</h4>
              <div className="backup-file-picker">
                <label className="backup-file-picker-button" htmlFor="backup-restore-file">
                  <Upload size={15} /> Choose backup file
                </label>
                <span className={`backup-file-picker-name${restoreFile ? " has-file" : ""}`} title={restoreFile?.name}>
                  {restoreFile?.name || "No backup selected"}
                </span>
                <input
                  id="backup-restore-file"
                  type="file"
                  accept=".json,.folio-backup.json"
                  onChange={(event) => {
                    setRestoreFile(event.target.files?.[0] || null);
                    setRestorePreview(null);
                  }}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-full-width" style={{ marginTop: "0.7rem" }} disabled={restoreLoading || !restoreFile} onClick={handleValidateRestore}>
                {restoreLoading ? "Checking…" : "Check Backup"}
              </button>
              {restorePreview && (
                <div style={{ marginTop: "0.8rem", padding: "0.8rem", border: "1px solid var(--border-ink)", fontSize: "0.75rem" }}>
                  <ShieldCheck size={15} style={{ display: "inline", marginRight: "0.4rem" }} />
                  Valid backup from {new Date(restorePreview.createdAt).toLocaleString()}.
                  <button type="button" className="btn btn-primary btn-full-width" style={{ marginTop: "0.7rem" }} disabled={restoreLoading} onClick={handleRestore}>
                    Restore Backup
                  </button>
                </div>
              )}
            </section>

            <section className="settings-panel-section">
              <h4 className="users-column-title"><Clock size={15} /> Automatic backups</h4>
              <label className="settings-checkbox-row">
                <input type="checkbox" checked={autoBackupEnabled} onChange={(event) => setAutoBackupEnabled(event.target.checked)} />
                Keep automatic local backups
              </label>
              <div className="settings-inline-fields">
                <select className="form-input" value={autoBackupFrequency} onChange={(event) => setAutoBackupFrequency(event.target.value)} disabled={!autoBackupEnabled}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <input className="form-input" type="number" min={3} max={90} value={autoBackupRetention} onChange={(event) => setAutoBackupRetention(Number(event.target.value))} disabled={!autoBackupEnabled} title="Backups to keep" />
              </div>
              <p className="panel-desc" style={{ marginTop: "0.7rem" }}>
                The policy is ready now. Unattended folder backups activate in Folio Desktop; browsers cannot write to a local folder without asking.
              </p>
              <button type="button" className="btn btn-secondary btn-full-width" onClick={saveBackupPolicy}>Save Backup Policy</button>
            </section>
          </div>
        ) : (
          <div className="glass-card settings-panel settings-panel-disabled" data-settings-section="backup">
            <Database size={32} className="text-muted-color" />
            <h3 className="panel-title-locked">
              Database Access Locked
            </h3>
            <p className="panel-desc-locked">
              You are signed in as a Manager. Raw database backups and full JSON exports are restricted to Admin accounts only.
            </p>
          </div>
        )}

        {/* Data Export Excel Panel */}
        <div className="glass-card settings-panel settings-panel-export" data-settings-section="backup">
          <h3 className="panel-title">
            Spreadsheet Exports
          </h3>
          <p className="panel-desc">
            Export all client details, bookings, and financial tracking data into spreadsheets to open in Microsoft Excel or Google Sheets.
          </p>

          <button
            type="button"
            onClick={() => handleExport("/api/export/csv", "folio-orders.csv")}
            className="btn btn-primary btn-full-width"
          >
            <FileSpreadsheet size={16} /> Export Bookings to CSV (For Excel)
          </button>
        </div>

        {/* PDF Presentation Settings Panel */}
        <div className="glass-card settings-panel settings-panel-branding" data-settings-section="branding">
          <h3 className="panel-title">
            Event Receipt &amp; PDF Settings
          </h3>
          <p className="panel-desc">
            Configure custom brand names and currencies shown on generated receipts and PDFs.
          </p>

          <div className="form-group" style={{ width: "100%", marginTop: "1rem" }}>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>Receipt PDF Brand Name</label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: "0.8rem", width: "100%" }}
              placeholder="Cater Flow Premium Catering"
              value={localBrandName}
              onChange={(e) => setLocalBrandName(e.target.value)}
            />
          </div>


          <div className="form-group" style={{ width: "100%", marginTop: "1rem" }}>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>Business Owner Logo (Optional)</label>
            <div className="receipt-logo-setting">
              {localBrandLogo ? <img src={localBrandLogo} alt="Business owner logo preview" className="receipt-logo-preview" /> : <div className="receipt-logo-placeholder">No logo</div>}
              <div className="receipt-logo-actions">
                <label className="btn btn-secondary btn-sm">
                  <Upload size={15} /> Choose Logo
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      setErrorMsg("The business logo must be 1 MB or smaller.");
                      setTimeout(() => setErrorMsg(""), 4000);
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setLocalBrandLogo(String(reader.result || ""));
                    reader.onerror = () => {
                      setErrorMsg("The selected logo could not be read.");
                      setTimeout(() => setErrorMsg(""), 4000);
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
                {localBrandLogo && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLocalBrandLogo("")}>Remove</button>}
                <small>PNG, JPEG, WebP, or SVG. Maximum 1 MB. Stored with Folio settings and backups.</small>
              </div>
            </div>
          </div>
          <div className="form-group" style={{ width: "100%", marginTop: "1rem" }}>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>Business Currency</label>
            <select className="form-input" value={currencyCode} onChange={(e) => setCurrencySymbol(e.target.value)}>
              {currencyOptions.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
            </select>
            <small>Uses ISO 4217 codes so currencies with similar symbols remain unambiguous.</small>
          </div>

          <div className="form-group" style={{ width: "100%", marginTop: "1.5rem" }}>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>Accepted Payment Methods</label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                ref={newPaymentMethodInputRef}
                type="text"
                className="form-input"
                style={{ fontSize: "0.8rem", flexGrow: 1 }}
                placeholder="Add payment method (e.g. PayPal)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !paymentMethods.includes(val)) {
                      setPaymentMethods([...paymentMethods, val]);
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const input = newPaymentMethodInputRef.current;
                  const val = input?.value.trim();
                  if (val && input && !paymentMethods.includes(val)) {
                    setPaymentMethods([...paymentMethods, val]);
                    input.value = "";
                  }
                }}
              >
                Add
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {paymentMethods.map((pm) => (
                <span
                  key={pm}
                  className="package-item-tag"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-ink)",
                    borderRadius: "4px",
                    color: "var(--ink)",
                  }}
                >
                  {pm}
                  <button
                    type="button"
                    className="payment-method-remove"
                    aria-label={`Remove ${pm} payment method`}
                    onClick={() => setPaymentMethods(paymentMethods.filter((x) => x !== pm))}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-ink)", marginTop: "1.5rem", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm btn-icon-label"
              onClick={async () => {
                try {
                  const res = await fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pdfBrandName: localBrandName, pdfBrandLogo: localBrandLogo })
                  });
                  if (res.ok) {
                    setPdfBrandName(localBrandName);
                    setPdfBrandLogo(localBrandLogo);
                    setSuccessMsg("Brand settings saved successfully.");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setTimeout(() => setSuccessMsg(""), 4000);
                  } else {
                    setErrorMsg("Failed to save brand settings.");
                    setTimeout(() => setErrorMsg(""), 4000);
                  }
                } catch (e) {
                  setErrorMsg("Failed to connect to the server.");
                  setTimeout(() => setErrorMsg(""), 4000);
                }
              }}
            >
              Save Brand Settings
            </button>
          </div>
        </div>
      </div>

      {isDesktopRuntime && (
        <div className="glass-card settings-update-panel" data-settings-section="about">
          <div className="settings-update-copy">
            <span className="settings-update-icon"><RefreshCw size={18} /></span>
            <div>
              <h3>Software Updates</h3>
              <p>{updateMessage}</p>
              {updateState === "available" && updateNotes && <p className="settings-update-notes">{updateNotes}</p>}
            </div>
          </div>
          <div className="settings-update-actions">
            <span className="settings-version-badge">Installed: v{currentVersion}</span>
            {updateState === "available" ? (
              <button type="button" className="btn btn-primary" onClick={installUpdate}><Download size={15} /> Download &amp; Install</button>
            ) : (
              <button type="button" className="btn btn-secondary" disabled={updateState === "checking" || updateState === "installing"} onClick={checkForUpdates}>
                <RefreshCw size={15} className={updateState === "checking" ? "spin" : ""} /> {updateState === "checking" ? "Checking…" : "Check for Updates"}
              </button>
            )}
          </div>
        </div>
      )}

      {isDesktopRuntime && isAdmin && (
        <div className="glass-card settings-update-panel settings-danger-panel" data-settings-section="danger">
          <div className="settings-update-copy">
            <span className="settings-update-icon"><Trash2 size={18} /></span>
            <div>
              <h3>Local Data &amp; Uninstall</h3>
              <p>Erase the database, accounts, settings, and automatic backups stored by Folio on this computer.</p>
            </div>
          </div>
          <button type="button" className="btn btn-danger" onClick={eraseLocalData}>Erase All Local Data</button>
        </div>
      )}
      {isDesktopRuntime && isAdmin && (
        <div className="glass-card sync-pairing-panel" data-settings-section="devices">
          <div className="sync-pairing-copy">
            <span className="settings-update-icon"><RefreshCw size={18} /></span>
            <div>
              <h3>Mobile Devices &amp; Sync</h3>
              <p>Pair Folio Android on the same network. Pairing codes expire after five minutes.</p>
              <span className="sync-address">{syncAddress || "Starting local sync service…"}</span>
            </div>
          </div>
          <div className="sync-pairing-actions">
            {pairingQr ? (
              <div className="sync-qr-block">
                <img src={pairingQr} alt="Folio mobile pairing QR code" />
                <div><strong>{pairingCode}</strong><span>Expires {new Date(pairingExpiresAt * 1000).toLocaleTimeString()}</span></div>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" disabled={pairingLoading} onClick={createPairingCode}>
                {pairingLoading ? "Preparing…" : "Pair New Device"}
              </button>
            )}
                        <div className="sync-runtime-summary">
              <span>Hub revision {syncRevision}</span>
              {liveSyncStatus && <span className={`sync-phase sync-phase-${liveSyncStatus.phase}`}>{liveSyncStatus.phase}{liveSyncStatus.pending ? " · pending" : ""}</span>}
                            {liveSyncStatus?.message && <span>{liveSyncStatus.message}</span>}
              {liveSyncStatus?.phase === "conflict" && (
                <div className="sync-conflict-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => resolveConflicts("local")}>Keep This Device</button>
                  <button type="button" className="btn btn-secondary" onClick={() => resolveConflicts("remote")}>Use Hub Versions</button>
                </div>
              )}
            </div>
            {pairedDevices.length > 0 && (
              <div className="sync-device-list">
                {pairedDevices.map((device) => (
                  <div className="sync-device-row" key={device.id}>
                    <div><strong>{device.name}</strong><span>Last seen {new Date(device.lastSeenAt * 1000).toLocaleString()}</span></div>
                    <button type="button" className="btn btn-secondary" onClick={() => revokeSyncDevice(device.id)}>Revoke</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* User Management Section - Visible to Admins Only */}
      {isAdmin && (
        <div className="glass-card users-panel" data-settings-section="team">
          <h3 className="users-panel-title">
            <Users size={20} /> User Accounts &amp; Team Roles
          </h3>

          <div className="users-layout-grid">
            {/* Create New User Form */}
            <div className="users-form-column">
              <h4 className="users-column-title">
                <UserPlus size={16} /> Add Team Account
              </h4>

              <form onSubmit={handleCreateUser} className="users-form">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. kitchen-manager"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">System Role</label>
                  <select
                    className="form-input"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                  >
                    <option value="manager">Manager (Read &amp; Edit, No Deletions)</option>
                    <option value="admin">Admin (Full System Permissions)</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary btn-full-width">
                  Add Account
                </button>
              </form>
            </div>

            {/* Existing Users Table */}
            <div className="users-table-column table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr className="table-head-row">
                    <th className="th-cell">Teammate Email</th>
                    <th className="th-cell">System Role</th>
                    <th className="th-cell">Created At</th>
                    <th className="th-cell text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((user) => {
                    const isSelf = user.id === currentUser?.id;
                    const isChangingPwd = changePwdUserId === user.id;
                    return (
                      <React.Fragment key={user.id}>
                        <tr className="table-body-row">
                          <td className="td-cell" style={{ fontWeight: 600 }}>
                            {user.email} {isSelf && <span className="session-role">(You)</span>}
                          </td>
                          <td className="td-cell">
                            <span className={`status-badge ${user.role === "admin" ? "status-confirmed" : "status-pending"}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="td-cell text-muted-color">
                            {new Date(user.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="td-cell text-right" style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              type="button"
                              className="btn-icon-subtle"
                              title="Change password"
                              onClick={() => {
                                setChangePwdUserId(isChangingPwd ? null : user.id);
                                setChangePwdValue("");
                              }}
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              className="btn-delete-icon"
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              title={isSelf ? "You cannot delete your own active account" : "Delete user account"}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                        {isChangingPwd && (
                          <tr className="table-body-row" style={{ background: "var(--surface-hover)" }}>
                            <td colSpan={4} className="td-cell" style={{ paddingTop: "0.6rem", paddingBottom: "0.6rem" }}>
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>New password for <strong>{user.email}</strong>:</span>
                                <input
                                  type="password"
                                  className="form-input"
                                  style={{ flex: 1, minWidth: "160px", fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
                                  placeholder="Min 6 characters"
                                  value={changePwdValue}
                                  onChange={(e) => setChangePwdValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleAdminChangePassword(user.id); }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ fontSize: "0.7rem", padding: "0.3rem 0.75rem", whiteSpace: "nowrap" }}
                                  disabled={changePwdLoading}
                                  onClick={() => handleAdminChangePassword(user.id)}
                                >
                                  {changePwdLoading ? "Saving..." : "Set Password"}
                                </button>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}
                                  onClick={() => { setChangePwdUserId(null); setChangePwdValue(""); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="td-cell text-center text-muted-color">
                        No team accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="settings-support-grid" data-settings-section="team">
        {/* Change Own Password — visible to ALL users */}
        <div className="glass-card settings-support-card settings-password-card">
          <h3 className="users-panel-title">
            <Lock size={20} /> Change Your Password
          </h3>
          <form onSubmit={handleSelfPasswordChange} className="settings-password-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="At least 6 characters"
                value={selfNewPwd}
                onChange={(e) => setSelfNewPwd(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="Repeat your new password"
                value={selfNewPwdConfirm}
                onChange={(e) => setSelfNewPwdConfirm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={selfPwdLoading}>
              {selfPwdLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        <div className="glass-card settings-support-card settings-guide-card">
          <h3 className="users-panel-title"><BookOpen size={20} /> Getting Started</h3>
          <p className="panel-desc">Food Library → Package Kits → Orders → Collections → Kitchen Sheets. The first-run guide can be shown again on this device.</p>
          <button type="button" className="btn btn-secondary" onClick={() => {
            localStorage.removeItem("folio-onboarding-dismissed");
            window.location.reload();
          }}>Show Guide Again</button>
        </div>
      </div>

      {confirmation && (
        <div className="folio-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirmation(false); }}>
          <div className="folio-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-confirm-title" aria-describedby="settings-confirm-message">
            <h2 id="settings-confirm-title">{confirmation.title}</h2>
            <p id="settings-confirm-message">{confirmation.message}</p>
            <div className="folio-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => closeConfirmation(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" autoFocus onClick={() => closeConfirmation(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
