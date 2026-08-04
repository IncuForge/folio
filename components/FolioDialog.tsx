"use client";

import React, { useRef } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";

export type DialogTone = "default" | "danger" | "warning";

export type DialogRequest = {
  title: string;
  message: string;
  tone: DialogTone;
  /** Names the action being confirmed, e.g. "Delete contact". */
  confirmLabel: string;
  cancelLabel: string;
  /** A notice has nothing to decline, so it shows one dismiss control. */
  kind: "confirm" | "notice";
};

export default function FolioDialog({
  request,
  onResolve,
}: {
  request: DialogRequest | null;
  onResolve: (accepted: boolean) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const open = request !== null;
  // Escape resolves as declined, which is the safe outcome for both kinds.
  const container = useDialogFocus<HTMLDivElement>(open, () => onResolve(false), confirmRef);

  if (!request) return null;

  const isDanger = request.tone === "danger";
  const Icon = request.tone === "default" ? Info : AlertTriangle;

  return (
    <div
      className="folio-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div
        ref={container}
        className="folio-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="folio-dialog-title"
        aria-describedby="folio-dialog-message"
        tabIndex={-1}
      >
        <div className="folio-dialog-head">
          <span className={`folio-dialog-icon${isDanger ? " folio-dialog-icon-danger" : ""}`}>
            <Icon size={16} />
          </span>
          <h2 id="folio-dialog-title" className="folio-dialog-title">
            {request.title}
          </h2>
        </div>

        <p id="folio-dialog-message" className="folio-dialog-message">
          {request.message}
        </p>

        <div className="folio-confirm-actions">
          {request.kind === "confirm" && (
            <button type="button" className="btn btn-secondary" onClick={() => onResolve(false)}>
              {request.cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${isDanger ? "btn-danger" : "btn-primary"}`}
            onClick={() => onResolve(true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
