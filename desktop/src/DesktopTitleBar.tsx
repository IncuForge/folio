import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export default function DesktopTitleBar() {
  const agent = navigator.userAgent.toLowerCase();
  const isWindows = agent.includes("windows");
  const isMac = agent.includes("macintosh") || agent.includes("mac os");
  if (!isWindows && !isMac) return null;

  return (
    <div className={"desktop-titlebar " + (isMac ? "desktop-titlebar-mac" : "")} data-tauri-drag-region>
      <div className="desktop-titlebar-brand" data-tauri-drag-region>Folio</div>
      {isWindows && (
        <div className="desktop-window-controls">
          <button type="button" aria-label="Minimize" onClick={() => appWindow.minimize()}><Minus size={14} /></button>
          <button type="button" aria-label="Maximize or restore" onClick={() => appWindow.toggleMaximize()}><Square size={12} /></button>
          <button type="button" className="desktop-window-close" aria-label="Close" onClick={() => appWindow.close()}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
