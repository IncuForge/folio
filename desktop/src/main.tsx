import React from "react";
import ReactDOM from "react-dom/client";
import "@/app/globals.css";
import App from "./App";
import { installDesktopApi } from "./desktop-api";
import { startSyncCoordinator } from "./sync-coordinator";
import { openUrl } from "@tauri-apps/plugin-opener";

const externalProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.hasAttribute("download")) return;

  const url = new URL(anchor.href, window.location.href);
  if (!externalProtocols.has(url.protocol)) return;

  event.preventDefault();
  void openUrl(url.href).catch((error) => {
    console.error("Could not open external link", error);
  });
});

await installDesktopApi();
void startSyncCoordinator();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
