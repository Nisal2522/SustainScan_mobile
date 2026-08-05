import type { ReactNode } from "react";
import { IOSInstallPrompt } from "./components/IOSInstallPrompt";

/** Wraps the app in a phone-sized viewport on desktop; full screen on real devices. */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-shell">
      <div className="mobile-device relative" role="presentation">
        <div className="mobile-viewport">{children}</div>
        <IOSInstallPrompt />
      </div>
    </div>
  );
}
