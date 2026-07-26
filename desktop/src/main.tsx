import React from "react";
import ReactDOM from "react-dom/client";
import "@/app/globals.css";
import App from "./App";
import { installDesktopApi } from "./desktop-api";

await installDesktopApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
