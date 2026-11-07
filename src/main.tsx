import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveDuo } from "./components/live-duo";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The Live Duo root element is missing.");

createRoot(root).render(
  <StrictMode>
    <LiveDuo />
  </StrictMode>,
);
