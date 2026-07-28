import { useEffect, useState } from "react";
import { Minus, Search, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export default function DesktopTitleBar() {
  const [authenticated, setAuthenticated] = useState(false);
  const agent = navigator.userAgent.toLowerCase();
  const isWindows = agent.includes("windows");
  const isMac = agent.includes("macintosh") || agent.includes("mac os");
  useEffect(() => {
    const update = (event: Event) => setAuthenticated(Boolean((event as CustomEvent<{ authenticated?: boolean }>).detail?.authenticated));
    window.addEventListener("folio-auth-state", update);
    return () => window.removeEventListener("folio-auth-state", update);
  }, []);

  if (!isWindows && !isMac) return null;

  return (
    <div className={`desktop-titlebar ${isMac ? "desktop-titlebar-mac" : ""} ${authenticated ? "desktop-titlebar-authenticated" : "desktop-titlebar-login"}`} data-tauri-drag-region>
      <span className="desktop-titlebar-drag-space" data-tauri-drag-region />
      {authenticated && <button type="button" className="desktop-titlebar-search" onClick={() => window.dispatchEvent(new CustomEvent("folio-open-command-palette"))} aria-label="Search Folio">
        <Search size={13} /><span>Search Folio</span><kbd>Ctrl K</kbd>
      </button>}
      {isWindows && (
        <div className="desktop-window-controls">
          <button type="button" aria-label="Minimize" onClick={() => appWindow.minimize()}><Minus size={14} /></button>
          <button type="button" data-window-control="maximize" aria-label="Maximize or restore" onClick={() => appWindow.toggleMaximize()}><Square size={12} /></button>
          <button type="button" className="desktop-window-close" aria-label="Close" onClick={() => appWindow.close()}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
