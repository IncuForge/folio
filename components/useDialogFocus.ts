"use client";

import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const container = useRef<T>(null);
  const closeRef = useRef(onClose);
  const previousFocus = useRef<HTMLElement | null>(null);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const target = initialFocus?.current ?? container.current?.querySelector<HTMLElement>(focusableSelector) ?? container.current;
      target?.focus();
    }, 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !container.current) return;
      const focusable = [...container.current.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => element.offsetParent !== null && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        container.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => previousFocus.current?.focus(), 0);
    };
  }, [open, initialFocus]);

  return container;
}