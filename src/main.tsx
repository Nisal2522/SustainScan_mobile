
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App.tsx";
import { MobileShell } from "./app/MobileShell.tsx";
import "./styles/index.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <MobileShell>
    <App />
  </MobileShell>,
);
  