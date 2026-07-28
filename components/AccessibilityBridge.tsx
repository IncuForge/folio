"use client";
import { useEffect } from "react";

/** Temporary compatibility bridge while legacy forms are migrated component-by-component. */
export default function AccessibilityBridge() {
  useEffect(() => {
    let sequence = 0;
    const associate = () => {
      document.querySelectorAll<HTMLElement>(".form-group").forEach((group) => {
        const label = group.querySelector<HTMLLabelElement>("label.form-label:not([for])");
        const control = group.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
        if (!label || !control) return;
        if (!control.id) control.id = `folio-field-${++sequence}`;
        label.htmlFor = control.id;
      });
    };
    associate();
    const observer = new MutationObserver(associate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
