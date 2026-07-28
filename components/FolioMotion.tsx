"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function FolioPageTransition({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="folio-route-frame"
        key={pageKey}
        initial={reduceMotion ? false : { opacity: 0, y: 7, filter: "blur(3px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -3, filter: "blur(2px)" }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function FolioOverlay({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
    >
      {children}
    </motion.div>
  );
}
