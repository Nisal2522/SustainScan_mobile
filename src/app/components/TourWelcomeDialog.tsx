import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Compass, X } from "lucide-react";

const GRADIENT = "linear-gradient(135deg,#1a45b5 0%,#0f2f8f 60%,#0a1f6b 100%)";

interface TourWelcomeDialogProps {
  onStart: () => void;
  onDismiss: () => void;
}

function getDeviceHost(): HTMLElement | null {
  return document.querySelector(".mobile-device");
}

export function TourWelcomeDialog({ onStart, onDismiss }: TourWelcomeDialogProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(getDeviceHost());
  }, []);

  if (!host) return null;

  return createPortal(
    <div
      className="absolute inset-0 z-[75] flex items-center justify-center p-5 animate-fadeIn"
      style={{
        background: "rgba(10, 22, 70, 0.52)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-welcome-title"
      aria-describedby="tour-welcome-desc"
    >
      <div
        className="relative w-full max-w-[340px] rounded-2xl px-5 pt-5 pb-5 animate-riseIn"
        style={{
          background: "#ffffff",
          boxShadow: "0 20px 48px rgba(15, 47, 143, 0.22)",
        }}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3.5 right-3.5 w-9 h-9 rounded-xl flex items-center justify-center focus:outline-none pressable"
          style={{
            background: "rgba(15,47,143,0.08)",
            color: "#0f2f8f",
            border: "1px solid rgba(15,47,143,0.12)",
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
        >
          <Compass size={22} strokeWidth={2.2} />
        </div>

        <h2 id="tour-welcome-title" className="text-[18px] font-bold tracking-tight pr-8" style={{ color: "#0a1a4a" }}>
          Welcome to SustainScan
        </h2>
        <p id="tour-welcome-desc" className="text-[14px] leading-relaxed mt-2" style={{ color: "#5a6a99" }}>
          Would you like a guided tour of the app? We&apos;ll walk you through the key features to help you get started.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onStart}
            className="w-full h-11 rounded-xl text-sm font-bold text-white focus:outline-none active:scale-[0.98] transition-transform pressable"
            style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.32)" }}
          >
            Yes, start tour
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full h-11 rounded-xl text-sm font-semibold focus:outline-none pressable"
            style={{
              color: "#0f2f8f",
              background: "rgba(15,47,143,0.06)",
              border: "1px solid rgba(15,47,143,0.12)",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
