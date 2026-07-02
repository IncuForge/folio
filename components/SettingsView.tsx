"use client";

import React, { useState, useEffect } from "react";
import { useAppContext } from "@/lib/AppContext";
import { Database, FileJson, FileSpreadsheet, UserPlus, Trash2, Users } from "lucide-react";

export default function SettingsView() {
  const { 
    currentUser, 
    pdfBrandName, 
    setPdfBrandName, 
    currencySymbol, 
    setCurrencySymbol,
    paymentMethods,
    setPaymentMethods
  } = useAppContext();
  
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager">("manager");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [localBrandName, setLocalBrandName] = useState("");

  useEffect(() => {
    setLocalBrandName(pdfBrandName || "");
  }, [pdfBrandName]);

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
    if (!confirm(`Are you sure you want to delete user "${email}"?`)) return;
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

  return (
    <div className="settings-container">
      <header>
        <h1 className="settings-title">
          System Settings &amp; Backups
        </h1>
        <p className="settings-subtitle">
          Maintain database backups, export spreadsheets, and configure user permissions.
        </p>
      </header>

      {errorMsg && (
        <div className="p-3 bg-[var(--danger-bg)] text-[var(--danger-text)] text-xs font-semibold rounded-[var(--radius-sm)] border border-red-200 dark:border-red-900/40" style={{ marginBottom: "1.5rem" }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-[var(--success-bg)] text-[var(--success-text)] text-xs font-semibold rounded-[var(--radius-sm)] border border-emerald-250" style={{ marginBottom: "1.5rem" }}>
          ✅ {successMsg}
        </div>
      )}

      <div className="settings-grid">
        {/* Backups Panel - Admins Only */}
        {isAdmin ? (
          <div className="glass-card settings-panel">
            <h3 className="panel-title">
              Database Backups
            </h3>
            <p className="panel-desc">
              Download copies of your data to store on secure local drives. Database backups are exported in human-readable JSON formats.
            </p>

            <div className="panel-actions-list">
              <a 
                href="/api/export/backup" 
                className="btn btn-secondary btn-full-width"
              >
                <Database size={16} /> Download Database Backup (JSON)
              </a>
              <a 
                href="/api/export/json" 
                className="btn btn-secondary btn-full-width"
              >
                <FileJson size={16} /> Download Full Dump (JSON)
              </a>
            </div>
          </div>
        ) : (
          <div className="glass-card settings-panel settings-panel-disabled">
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
        <div className="glass-card settings-panel">
          <h3 className="panel-title">
            Spreadsheet Exports
          </h3>
          <p className="panel-desc">
            Export all client details, bookings, and financial tracking data into spreadsheets to open in Microsoft Excel or Google Sheets.
          </p>

          <a 
            href="/api/export/csv" 
            className="btn btn-primary btn-full-width"
          >
            <FileSpreadsheet size={16} /> Export Bookings to CSV (For Excel)
          </a>
        </div>

        {/* PDF Presentation Settings Panel */}
        <div className="glass-card settings-panel">
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
            <label className="form-label" style={{ fontSize: "0.75rem" }}>System Currency Symbol</label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: "0.8rem", width: "100%" }}
              placeholder="e.g. ₹"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
            />
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
                  <span
                    style={{ cursor: "pointer", fontWeight: "bold", marginLeft: "0.25rem", color: "var(--ink-muted)" }}
                    onClick={() => setPaymentMethods(paymentMethods.filter((x) => x !== pm))}
                  >
                    &times;
                  </span>
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
                    body: JSON.stringify({ pdfBrandName: localBrandName })
                  });
                  if (res.ok) {
                    setPdfBrandName(localBrandName);
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

      {/* User Management Section - Visible to Admins Only */}
      {isAdmin && (
        <div className="glass-card users-panel">
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
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="e.g. teammate@cater.com"
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
              <table className="data-table text-xs">
                <thead>
                  <tr className="table-head-row">
                    <th className="th-cell">Teammate Email</th>
                    <th className="th-cell">System Role</th>
                    <th className="th-cell">Created At</th>
                    <th className="th-cell text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((user) => {
                    const isSelf = user.id === currentUser?.id;
                    return (
                      <tr key={user.id} className="table-body-row">
                        <td className="td-cell font-semibold">
                          {user.email} {isSelf && <span className="text-[10px] text-[var(--ink-muted)] italic font-normal">(You)</span>}
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
                        <td className="td-cell text-right">
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
    </div>
  );
}
