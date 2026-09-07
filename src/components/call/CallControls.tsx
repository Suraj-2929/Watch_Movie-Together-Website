import {
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CallControlsProps = {
  camOn: boolean;
  micOn: boolean;
  screenOn: boolean;
  canShareScreen: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
};

function ControlButton({
  active,
  danger,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  danger?: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      variant="ghost"
      className={cn(
        "h-12 flex-1 min-w-[3.25rem] gap-2 rounded-xl border border-border bg-secondary/70 px-3 text-secondary-foreground hover:bg-secondary sm:flex-none sm:px-4",
        active && !danger && "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        danger && "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
      )}
    >
      {icon}
      <span className="hidden text-sm font-medium sm:inline">{label}</span>
    </Button>
  );
}

export function CallControls({
  camOn,
  micOn,
  screenOn,
  canShareScreen,
  onToggleCam,
  onToggleMic,
  onToggleScreen,
  onLeave,
}: CallControlsProps) {
  return (
    <div className="stage-panel flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl p-2 sm:gap-3 sm:p-3">
      <ControlButton
        active={camOn}
        label={camOn ? "Camera on" : "Camera off"}
        icon={camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        onClick={onToggleCam}
      />
      <ControlButton
        active={micOn}
        label={micOn ? "Unmuted" : "Muted"}
        icon={micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        onClick={onToggleMic}
      />
      {canShareScreen && (
        <ControlButton
          active={screenOn}
          label={screenOn ? "Stop sharing" : "Share screen"}
          icon={
            screenOn ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />
          }
          onClick={onToggleScreen}
        />
      )}
      <ControlButton
        active={false}
        danger
        label="Leave"
        icon={<PhoneOff className="h-5 w-5" />}
        onClick={onLeave}
      />
    </div>
  );
}
