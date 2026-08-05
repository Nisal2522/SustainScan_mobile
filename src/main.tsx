import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App.tsx";
import { MobileShell } from "./app/MobileShell.tsx";
import "./styles/index.css";

const rootEl = document.getElementById("root")!;

createRoot(rootEl).render(
  <MobileShell>
    <App />
  </MobileShell>,
);

// Register the service worker after first paint so launch isn't blocked
// by SW setup (helps Android dismiss its system splash sooner).
const register = () => registerSW({ immediate: true });
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(register, { timeout: 2000 });
} else {
  window.setTimeout(register, 1);
}
