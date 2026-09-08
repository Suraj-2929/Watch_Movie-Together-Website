import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CallControls } from "@/components/call/CallControls";
import { RoomIdBadge } from "@/components/call/RoomIdBadge";
import { StatusPill } from "@/components/call/StatusPill";
import { VideoTile } from "@/components/call/VideoTile";
import { normalizeRoomId, roomExists } from "@/lib/rooms";
import { useCallSession } from "@/lib/rtc/useCallSession";

export const Route = createFileRoute("/room/$roomId")({
  head: ({ params }) => {
    const title = `Room ${params.roomId} — Watch Together`;
    const description =
      "You are in a private Watch Together room. Turn on your camera, unmute and share your screen with one other person.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: RoomPage,
});

function RoomPage() {
  const { roomId: rawId } = Route.useParams();
  const roomId = normalizeRoomId(rawId);
  const navigate = useNavigate();
  const [check, setCheck] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    roomExists(roomId)
      .then((exists) => {
        if (!cancelled) setCheck(exists ? "ok" : "missing");
      })
      .catch(() => {
        if (!cancelled) setCheck("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (check === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (check === "missing") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">This room doesn&apos;t exist</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The code {roomId} isn&apos;t active. Ask for a new code, or start your own room.
        </p>
        <Button onClick={() => navigate({ to: "/" })} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to start
        </Button>
      </main>
    );
  }

  return <CallStage roomId={roomId} />;
}

function CallStage({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const session = useCallSession(roomId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const screenAudioRef = useRef<HTMLAudioElement>(null);

  const {
    status,
    peerPresent,
    roomFull,
    error,
    localFlags,
    remoteFlags,
    localCamStream,
    localScreenStream,
    remoteCamStream,
    remoteScreenStream,
    remoteAudioStream,
    remoteScreenAudioStream,
  } = session;

  // Ask for the microphone once so people can hear each other straight away.
  const micAsked = useRef(false);
  useEffect(() => {
    if (micAsked.current) return;
    micAsked.current = true;
    void session.enableMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.srcObject !== remoteAudioStream) el.srcObject = remoteAudioStream;
    if (remoteAudioStream) void el.play().catch(() => undefined);
  }, [remoteAudioStream]);

  useEffect(() => {
    const el = screenAudioRef.current;
    if (!el) return;
    if (el.srcObject !== remoteScreenAudioStream) {
      el.srcObject = remoteScreenAudioStream;
    }
    if (remoteScreenAudioStream) {
      el.volume = 1;
      void el.play().catch(() => undefined);
    }
  }, [remoteScreenAudioStream]);


  const canShareScreen =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const someoneSharing = localFlags.screen || remoteFlags.screen;
  const sharedStream = remoteFlags.screen ? remoteScreenStream : localScreenStream;
  const sharedLabel = remoteFlags.screen ? "Other person's screen" : "Your screen";

  const leaveRoom = () => {
    session.leave();
    void navigate({ to: "/" });
  };

  if (roomFull) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">This room is full</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Two people are already talking in room {roomId}. Rooms hold two people at a time.
        </p>
        <Button onClick={() => navigate({ to: "/" })} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to start
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold sm:text-xl">
            <span className="accent-text">Watch Together</span>
          </h1>
          <RoomIdBadge roomId={roomId} />
        </div>
        <StatusPill status={peerPresent ? status : "waiting"} />
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {!peerPresent && (
        <p className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          Waiting for another person to join. Share the code{" "}
          <span className="font-mono font-semibold text-foreground">{roomId}</span> to invite
          them.
        </p>
      )}

      <section className="relative flex-1">
        {someoneSharing ? (
          <div className="relative h-full min-h-[45vh]">
            <VideoTile
              stream={sharedStream}
              label={sharedLabel}
              active={Boolean(sharedStream)}
              muted
              objectFit="contain"
              showMicBadge={false}
              placeholder="Waiting for the shared screen"
              className="h-full min-h-[45vh] w-full bg-background/80"
            />
            <div className="absolute bottom-3 right-3 flex w-28 flex-col gap-2 sm:w-44">
              <VideoTile
                stream={remoteCamStream}
                label="Other person"
                active={peerPresent && remoteFlags.cam}
                micOn={remoteFlags.mic}
                showMicBadge={peerPresent}
                placeholder="Camera off"
                className="aspect-video w-full"
              />
              <VideoTile
                stream={localCamStream}
                label="You"
                active={localFlags.cam}
                muted
                mirrored
                micOn={localFlags.mic}
                placeholder="Camera off"
                className="aspect-video w-full"
              />
            </div>
          </div>
        ) : (
          <div className="grid h-full gap-3 md:grid-cols-2">
            <VideoTile
              stream={remoteCamStream}
              label="Other person"
              active={peerPresent && remoteFlags.cam}
              micOn={remoteFlags.mic}
              showMicBadge={peerPresent}
              placeholder={peerPresent ? "Their camera is off" : "Nobody here yet"}
              className="aspect-video w-full md:aspect-auto md:min-h-[45vh]"
            />
            <VideoTile
              stream={localCamStream}
              label="You"
              active={localFlags.cam}
              muted
              mirrored
              micOn={localFlags.mic}
              placeholder="Your camera is off"
              className="aspect-video w-full md:aspect-auto md:min-h-[45vh]"
            />
          </div>
        )}
      </section>

      <CallControls
        camOn={localFlags.cam}
        micOn={localFlags.mic}
        screenOn={localFlags.screen}
        canShareScreen={canShareScreen}
        onToggleCam={session.toggleCamera}
        onToggleMic={session.toggleMic}
        onToggleScreen={session.toggleScreenShare}
        onLeave={leaveRoom}
      />

      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <audio ref={screenAudioRef} autoPlay playsInline className="hidden" />

    </main>
  );
}
