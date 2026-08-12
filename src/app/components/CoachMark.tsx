import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { GuidePlacement } from "../onboardingGuide";

export interface CoachMarkRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface CoachMarkProps {
  message: string;
  targetId: string;
  placement: GuidePlacement;
  onSkip: () => void;
  onTargetInteract?: () => void;
}

function getDeviceHost(): HTMLElement | null {
  return document.querySelector(".mobile-device");
}

function measureTarget(targetId: string, host: HTMLElement): CoachMarkRect | null {
  const el = document.querySelector(`[data-guide-id="${targetId}"]`);
  if (!el) return null;
  const target = el.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  return {
    top: target.top - hostRect.top,
    left: target.left - hostRect.left,
    width: target.width,
    height: target.height,
  };
}

function computeChipStyle(
  rect: CoachMarkRect,
  placement: GuidePlacement,
  chipSize: { width: number; height: number },
  hostSize: { width: number; height: number },
): { chip: CSSProperties; arrow: CSSProperties; arrowClass: string } {
  const pad = 10;
  const arrowSize = 8;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxChipWidth = Math.min(240, hostSize.width - 32);

  let chipTop = 0;
  let chipLeft = 0;
  let arrowTop = 0;
  let arrowLeft = 0;
  let arrowRotate = 0;
  let arrowClass = "coach-mark__arrow--down";

  switch (placement) {
    case "top": {
      chipTop = rect.top + rect.height + pad + arrowSize;
      chipLeft = Math.max(16, Math.min(cx - maxChipWidth / 2, hostSize.width - maxChipWidth - 16));
      arrowTop = rect.top + rect.height + pad;
      arrowLeft = cx - arrowSize;
      arrowRotate = 0;
      arrowClass = "coach-mark__arrow--up";
      break;
    }
    case "bottom": {
      chipTop = rect.top - pad - arrowSize - chipSize.height;
      chipLeft = Math.max(16, Math.min(cx - maxChipWidth / 2, hostSize.width - maxChipWidth - 16));
      arrowTop = rect.top - pad - arrowSize;
      arrowLeft = cx - arrowSize;
      arrowRotate = 180;
      arrowClass = "coach-mark__arrow--down";
      break;
    }
    case "left": {
      chipTop = Math.max(16, cy - chipSize.height / 2);
      chipLeft = rect.left + rect.width + pad + arrowSize;
      arrowTop = cy - arrowSize;
      arrowLeft = rect.left + rect.width + pad;
      arrowRotate = -90;
      arrowClass = "coach-mark__arrow--left";
      break;
    }
    case "right": {
      chipTop = Math.max(16, cy - chipSize.height / 2);
      chipLeft = rect.left - pad - arrowSize - maxChipWidth;
      arrowTop = cy - arrowSize;
      arrowLeft = rect.left - pad - arrowSize;
      arrowRotate = 90;
      arrowClass = "coach-mark__arrow--right";
      break;
    }
  }

  return {
    chip: {
      top: chipTop,
      left: chipLeft,
      maxWidth: maxChipWidth,
      position: "absolute",
    },
    arrow: {
      top: arrowTop,
      left: arrowLeft,
      transform: `rotate(${arrowRotate}deg)`,
      position: "absolute",
    },
    arrowClass,
  };
}

export function CoachMark({ message, targetId, placement, onSkip, onTargetInteract }: CoachMarkProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<CoachMarkRect | null>(null);
  const [chipSize, setChipSize] = useState({ width: 220, height: 72 });
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHost(getDeviceHost());
  }, []);

  const remeasure = () => {
    const h = getDeviceHost();
    if (!h) return;
    setHost(h);
    setRect(measureTarget(targetId, h));
  };

  useLayoutEffect(() => {
    remeasure();
    const vp = document.querySelector(".mobile-viewport");
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    vp?.addEventListener("scroll", remeasure);
    const interval = window.setInterval(remeasure, 400);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
      vp?.removeEventListener("scroll", remeasure);
      window.clearInterval(interval);
    };
  }, [targetId]);

  useLayoutEffect(() => {
    if (!chipRef.current || !rect) return;
    const r = chipRef.current.getBoundingClientRect();
    setChipSize(prev =>
      Math.abs(r.height - prev.height) > 4 || Math.abs(r.width - prev.width) > 4
        ? { width: r.width, height: r.height }
        : prev,
    );
  }, [message, rect]);

  useEffect(() => {
    const target = document.querySelector(`[data-guide-id="${targetId}"]`);
    if (!target || !onTargetInteract) return;

    const handleClick = () => onTargetInteract();
    target.addEventListener("click", handleClick, { capture: true });
    return () => target.removeEventListener("click", handleClick, { capture: true });
  }, [targetId, onTargetInteract]);

  if (!host || !rect) return null;

  const hostRect = host.getBoundingClientRect();
  const layout = computeChipStyle(rect, placement, chipSize, {
    width: hostRect.width,
    height: hostRect.height,
  });
  const spotlightPad = 6;
  const spotlight = {
    top: Math.max(0, rect.top - spotlightPad),
    left: Math.max(0, rect.left - spotlightPad),
    width: Math.min(hostRect.width - Math.max(0, rect.left - spotlightPad), rect.width + spotlightPad * 2),
    height: Math.min(hostRect.height - Math.max(0, rect.top - spotlightPad), rect.height + spotlightPad * 2),
  };

  return createPortal(
    <div className="coach-mark-layer" aria-live="polite">
      <div className="coach-mark-backdrop" style={{ top: 0, left: 0, right: 0, height: spotlight.top }} />
      <div className="coach-mark-backdrop" style={{ top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.height }} />
      <div className="coach-mark-backdrop" style={{ top: spotlight.top, left: spotlight.left + spotlight.width, right: 0, height: spotlight.height }} />
      <div className="coach-mark-backdrop" style={{ top: spotlight.top + spotlight.height, left: 0, right: 0, bottom: 0 }} />
      <div
        className="coach-mark-spotlight"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
        aria-hidden="true"
      />
      <div
        className={`coach-mark__arrow ${layout.arrowClass}`}
        style={layout.arrow}
        aria-hidden="true"
      />
      <div
        ref={chipRef}
        className="coach-mark__chip animate-coachMarkIn"
        style={layout.chip}
        role="status"
      >
        <p className="coach-mark__text">{message}</p>
        <button
          type="button"
          onClick={onSkip}
          className="coach-mark__skip"
        >
          Skip
        </button>
      </div>
    </div>,
    host,
  );
}
