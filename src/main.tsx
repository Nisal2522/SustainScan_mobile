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

function setupServiceWorkerUpdates() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdates = () => {
        registration.update().catch(() => {
          // Ignore transient network errors during background checks.
        });
      };

      // Let the login UI paint before any background update work.
      window.setTimeout(checkForUpdates, 30_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          window.setTimeout(checkForUpdates, 2_000);
        }
      });
      window.setInterval(checkForUpdates, 5 * 60 * 1000);
    },
    onNeedRefresh() {
      updateSW(true);
    },
  });
}

const register = () => setupServiceWorkerUpdates();
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(register, { timeout: 5000 });
} else {
  window.setTimeout(register, 250);
}
