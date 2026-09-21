import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/space-grotesk";
import "./index.css";
import App from "./App";

const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><rect width="80" height="100" fill="#e7ddc5"/><text x="40" y="54" text-anchor="middle" font-size="8" fill="#6e7348" font-family="sans-serif">NIRVANA</text></svg>');
window.addEventListener("error", (e) => {
  const t = e.target;
  if (t instanceof HTMLImageElement && t.dataset.fb !== "1") {
    t.dataset.fb = "1";
    t.src = PLACEHOLDER;
  }
}, true);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
