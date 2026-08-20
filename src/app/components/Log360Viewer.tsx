import { useCallback, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import logFrame1 from "../../imports/timber.png";
import logFrame2 from "../../imports/image-2.png";
import logFrame3 from "../../imports/image-3.png";
import logFrame4 from "../../imports/image-4.png";

const LOG_360_FRAMES = [logFrame1, logFrame2, logFrame3, logFrame4] as const;
const LOG_360_ROTATE_Y = [-32, -11, 11, 32] as const;

interface Log360ViewerProps {
  className?: string;
  alt?: string;
}

export function Log360Viewer({ className = "", alt = "Log 360 view" }: Log360ViewerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    setFrameIndex(i => (i - 1 + LOG_360_FRAMES.length) % LOG_360_FRAMES.length);
  }, []);

  const goNext = useCallback(() => {
    setFrameIndex(i => (i + 1) % LOG_360_FRAMES.length);
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 24) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  return (
    <div
      className={`log-360-viewer ${className}`.trim()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="group"
      aria-label={`${alt}. Frame ${frameIndex + 1} of ${LOG_360_FRAMES.length}. Swipe to rotate.`}
    >
      <img
        src={logFrame1}
        alt=""
        aria-hidden
        className="log-360-viewer__bg"
      />

      <div className="log-360-viewer__stage">
        <img
          key={frameIndex}
          src={LOG_360_FRAMES[frameIndex]}
          alt={`${alt} — angle ${frameIndex + 1}`}
          className="log-360-viewer__frame"
          style={{ transform: `rotateY(${LOG_360_ROTATE_Y[frameIndex]}deg)` }}
          draggable={false}
        />
      </div>

      <button
        type="button"
        onClick={goPrev}
        className="log-360-viewer__nav log-360-viewer__nav--prev"
        aria-label="Previous angle"
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={goNext}
        className="log-360-viewer__nav log-360-viewer__nav--next"
        aria-label="Next angle"
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>

      <div className="log-360-viewer__dots" aria-hidden>
        {LOG_360_FRAMES.map((_, i) => (
          <span
            key={i}
            className={`log-360-viewer__dot${i === frameIndex ? " log-360-viewer__dot--active" : ""}`}
          />
        ))}
      </div>

      <p className="log-360-viewer__hint">Swipe or tap arrows to rotate</p>
    </div>
  );
}
