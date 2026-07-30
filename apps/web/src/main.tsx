import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.js";
import { GlobalTooltip } from "./Tooltip.js";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <GlobalTooltip />
  </React.StrictMode>,
);
