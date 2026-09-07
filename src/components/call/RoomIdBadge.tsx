import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RoomIdBadge({ roomId, className }: { roomId: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-1.5",
        className,
      )}
    >
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Room</span>
      <span className="font-mono text-base font-semibold tracking-[0.2em] text-foreground">
        {roomId}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        aria-label="Copy room ID"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
