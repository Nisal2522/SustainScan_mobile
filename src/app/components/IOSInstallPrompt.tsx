import { useEffect, useState } from "react";
import { PlusSquare, Share, X } from "lucide-react";

const STORAGE_KEY = "sustainscan-ios-a2hs-dismissed";
const DISMISS_DAYS = 14;

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const iPhoneOrPod = /iphone|ipod/.test(ua);
  const iPad = /ipad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iPhoneOrPod || iPad;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (Number.isNaN(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

function dismissForDays(days: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

/**
 * Guides iPhone/iPad Safari (and other iOS browsers) through Add to Home Screen.
 * Hidden when already running as an installed standalone app.
 */
export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isIosDevice() || isStandaloneMode() || wasDismissedRecently()) return;

    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const close = () => {
    dismissForDays(DISMISS_DAYS);
    setVisible(false);
  };

  return (
    <div
      className="absolute inset-x-0 z-[100] flex justify-center px-3 pointer-events-none"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ios-a2hs-title"
    >
      <div
        className="pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-2xl text-white shadow-2xl animate-fadeIn"
        style={{
          background: "linear-gradient(160deg, #1a45b5 0%, #0f2f8f 55%, #0a1f6b 100%)",
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow: "0 12px 40px rgba(10,31,107,0.45)",
        }}
      >
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{ background: "#000000", border: "1px solid rgba(255,255,255,0.18)" }}
            aria-hidden
          >
            <img src="/icons/icon-192.png" alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="ios-a2hs-title" className="text-sm font-semibold tracking-wide">
              Install SustainScan
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
              Add this app to your Home Screen for a full-screen, app-like experience without Safari chrome.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus:outline-none"
            style={{ background: "rgba(255,255,255,0.12)" }}
            aria-label="Dismiss install tip"
          >
            <X size={16} />
          </button>
        </div>

        {!expanded ? (
          <div className="flex gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] focus:outline-none"
              style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.28)" }}
            >
              Show me how
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Not now
            </button>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <ol className="flex flex-col gap-3 rounded-xl px-3 py-3" style={{ background: "rgba(0,0,0,0.18)" }}>
              <li className="flex items-start gap-3 text-xs leading-relaxed">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  1
                </span>
                <span>
                  Tap the <Share size={14} className="inline align-text-bottom mx-0.5" aria-hidden />{" "}
                  <strong>Share</strong> button at the bottom of Safari
                  <span className="block mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                    (square with an upward arrow)
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3 text-xs leading-relaxed">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  2
                </span>
                <span>
                  Scroll and tap <PlusSquare size={14} className="inline align-text-bottom mx-0.5" aria-hidden />{" "}
                  <strong>Add to Home Screen</strong>
                </span>
              </li>
              <li className="flex items-start gap-3 text-xs leading-relaxed">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  3
                </span>
                <span>
                  Tap <strong>Add</strong> — then open SustainScan from your Home Screen for standalone mode
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={close}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] focus:outline-none"
              style={{ background: "#ffffff", color: "#0f2f8f" }}
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
