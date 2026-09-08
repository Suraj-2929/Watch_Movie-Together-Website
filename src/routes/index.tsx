import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, MonitorPlay, Users, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRoom, normalizeRoomId, roomExists } from "@/lib/rooms";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Watch Together — Private 2-Person Video & Screen Share" },
      {
        name: "description",
        content:
          "Create a private room, share the code with one friend, and talk face to face with camera, microphone and screen sharing right in your browser.",
      },
      { property: "og:title", content: "Watch Together — Private Video & Screen Share" },
      {
        property: "og:description",
        content:
          "Create a private room, share the code with one friend, and talk face to face with camera, microphone and screen sharing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const [createdRoom, setCreatedRoom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      const id = await createRoom();
      setCreatedRoom(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!createdRoom) return;
    try {
      await navigator.clipboard.writeText(createdRoom);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = normalizeRoomId(joinValue);
    if (!id) {
      setError("Enter a room code first.");
      return;
    }
    setBusy("join");
    setError(null);
    try {
      if (!(await roomExists(id))) {
        setError("No room with that code. Check it and try again.");
        return;
      }
      await navigate({ to: "/room/$roomId", params: { roomId: id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that room.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-4 py-12 sm:px-6">
      <p className="text-center text-sm font-medium text-primary">For dear Shraddha</p>
      <header className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Private rooms for two
        </span>
        <h1 className="mt-5 text-4xl font-bold sm:text-6xl">
          <span className="accent-text">Watch Together</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-sm text-muted-foreground sm:text-base">
          Start a room, send the code to one person, and you are face to face — camera,
          microphone and screen sharing, straight in the browser.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="stage-panel flex flex-col gap-4 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Video className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Create room</h2>
              <p className="text-xs text-muted-foreground">Get a code to share</p>
            </div>
          </div>

          {createdRoom ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/60 px-4 py-3">
                <span className="font-mono text-2xl font-semibold tracking-[0.3em]">
                  {createdRoom}
                </span>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code, then enter the room. You will see a waiting message until
                the other person arrives.
              </p>
              <Button
                onClick={() =>
                  navigate({ to: "/room/$roomId", params: { roomId: createdRoom } })
                }
                className="h-11 w-full"
              >
                Enter room
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={busy !== null}
              className="h-11 w-full"
            >
              {busy === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create a room
            </Button>
          )}
        </section>

        <section className="stage-panel flex flex-col gap-4 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MonitorPlay className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Join room</h2>
              <p className="text-xs text-muted-foreground">Use the code you were sent</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <Input
              value={joinValue}
              onChange={(e) => setJoinValue(normalizeRoomId(e.target.value))}
              placeholder="ABC123"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="Room code"
              className="h-12 bg-secondary/50 text-center font-mono text-xl tracking-[0.3em]"
            />
            <Button type="submit" disabled={busy !== null} className="h-11 w-full">
              {busy === "join" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join room
            </Button>
          </form>
        </section>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Each room holds two people. Works on desktop, tablet and mobile browsers.
      </p>
    </main>
  );
}
