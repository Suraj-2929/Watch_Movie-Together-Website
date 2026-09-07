import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";

import { cn } from "@/lib/utils";

type VideoTileProps = {
  stream: MediaStream | null;
  label: string;
  active: boolean;
  muted?: boolean;
  mirrored?: boolean;
  micOn?: boolean;
  showMicBadge?: boolean;
  placeholder?: string;
  objectFit?: "cover" | "contain";
  className?: string;
};

/**
 * Stable video surface: the <video> element is never unmounted when media
 * starts or stops, only its stream and overlay change.
 */
export function VideoTile({
  stream,
  label,
  active,
  muted = false,
  mirrored = false,
  micOn = true,
  showMicBadge = true,
  placeholder = "Camera off",
  objectFit = "cover",
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-border bg-secondary/60",
        className,
      )}
      style={{ boxShadow: "var(--shadow-tile)" }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "h-full w-full transition-opacity duration-200",
          objectFit === "cover" ? "object-cover" : "object-contain",
          active ? "opacity-100" : "opacity-0",
          mirrored && "scale-x-[-1]",
        )}
      />

      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <VideoOff className="h-6 w-6" aria-hidden />
          <span className="text-xs font-medium sm:text-sm">{placeholder}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/85 to-transparent px-3 py-2">
        <span className="truncate text-xs font-semibold tracking-wide text-foreground sm:text-sm">
          {label}
        </span>
        {showMicBadge && !micOn && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
            <MicOff className="h-3 w-3" aria-hidden />
            Muted
          </span>
        )}
      </div>
    </div>
  );
}
