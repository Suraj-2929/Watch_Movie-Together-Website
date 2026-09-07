import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/rtc/types";

const LABELS: Record<ConnectionStatus, string> = {
  idle: "Starting…",
  waiting: "Waiting for the other person",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  failed: "Connection problem",
};

export function StatusPill({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const tone =
    status === "connected"
      ? "bg-success/15 text-success"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-secondary/70 text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full bg-current",
          status !== "connected" && "animate-pulse",
        )}
      />
      {LABELS[status]}
    </span>
  );
}
