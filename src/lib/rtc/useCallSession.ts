import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  ICE_SERVERS,
  SLOT,
  type ConnectionStatus,
  type MediaFlags,
  type SignalPayload,
} from "./types";

const EVENT = "signal";

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export type CallSession = ReturnType<typeof useCallSession>;

/**
 * One peer connection for the whole session.
 *
 * Three transceivers are negotiated once (audio, camera, screen) and are never
 * added or removed again. Turning a camera or screen share on/off only calls
 * `replaceTrack`, so media can be started and stopped as often as the users
 * like without renegotiation, without breaking audio, and without destroying
 * the remote tracks.
 */
export function useCallSession(roomId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [peerPresent, setPeerPresent] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [localFlags, setLocalFlags] = useState<MediaFlags>({
    cam: false,
    mic: false,
    screen: false,
  });
  const [remoteFlags, setRemoteFlags] = useState<MediaFlags>({
    cam: false,
    mic: false,
    screen: false,
  });

  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteCamStream, setRemoteCamStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  const [remoteScreenAudioStream, setRemoteScreenAudioStream] = useState<MediaStream | null>(null);

  const selfId = useRef<string>("");
  if (!selfId.current) selfId.current = randomId();

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const makingOfferRef = useRef(false);
  const politeRef = useRef(true);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const flagsRef = useRef<MediaFlags>({ cam: false, mic: false, screen: false });

  const setFlags = useCallback((next: Partial<MediaFlags>) => {
    flagsRef.current = { ...flagsRef.current, ...next };
    setLocalFlags(flagsRef.current);
  }, []);

  const send = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: EVENT, payload });
  }, []);

  const broadcastState = useCallback(() => {
    send({ type: "state", from: selfId.current, flags: flagsRef.current });
  }, [send]);

  /* ------------------------------------------------------------------ */
  /* peer connection                                                     */
  /* ------------------------------------------------------------------ */

  const senderFor = (slot: number) => {
    const pc = pcRef.current;
    if (!pc) return null;
    return pc.getTransceivers()[slot]?.sender ?? null;
  };

  const pushLocalTracks = useCallback(() => {
    void senderFor(SLOT.audio)?.replaceTrack(micTrackRef.current);
    void senderFor(SLOT.camera)?.replaceTrack(camTrackRef.current);
    void senderFor(SLOT.screen)?.replaceTrack(screenTrackRef.current);
    void senderFor(SLOT.screenAudio)?.replaceTrack(screenAudioTrackRef.current);
  }, []);

  const closePeer = useCallback(() => {
    const pc = pcRef.current;
    pcRef.current = null;
    peerIdRef.current = null;
    pendingIceRef.current = [];
    makingOfferRef.current = false;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.onnegotiationneeded = null;
      pc.close();
    }
    setRemoteCamStream(null);
    setRemoteScreenStream(null);
    setRemoteAudioStream(null);
    setRemoteScreenAudioStream(null);
    setRemoteFlags({ cam: false, mic: false, screen: false });
  }, []);

  const createPeer = useCallback(
    (asInitiator: boolean) => {
      closePeer();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      const camStream = new MediaStream();
      const screenStream = new MediaStream();

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !peerIdRef.current) return;
        send({
          type: "ice",
          from: selfId.current,
          to: peerIdRef.current,
          candidate: ev.candidate.toJSON(),
        });
      };

      pc.ontrack = (ev) => {
        const index = pc.getTransceivers().indexOf(ev.transceiver);
        if (index === SLOT.audio) {
          // Fresh stream object each time so the <audio> element re-attaches.
          setRemoteAudioStream(new MediaStream([ev.track]));
        } else if (index === SLOT.camera) {
          camStream.addTrack(ev.track);
          setRemoteCamStream(camStream);
        } else if (index === SLOT.screen) {
          screenStream.addTrack(ev.track);
          setRemoteScreenStream(screenStream);
        } else if (index === SLOT.screenAudio) {
          const track = ev.track;
          setRemoteScreenAudioStream(new MediaStream([track]));
          const refresh = () => setRemoteScreenAudioStream(
            track.muted ? null : new MediaStream([track]),
          );
          track.onunmute = refresh;
          track.onmute = refresh;
        }
      };

      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case "connected":
            setStatus("connected");
            break;
          case "connecting":
            setStatus("connecting");
            break;
          case "disconnected":
            setStatus("reconnecting");
            break;
          case "failed":
            setStatus("failed");
            pc.restartIce();
            break;
          default:
            break;
        }
      };

      if (asInitiator) {
        // Fixed slot order — must match SLOT.
        pc.addTransceiver("audio", { direction: "sendrecv" });
        pc.addTransceiver("video", { direction: "sendrecv" });
        pc.addTransceiver("video", { direction: "sendrecv" });
        pc.addTransceiver("audio", { direction: "sendrecv" });
        pushLocalTracks();
      }

      return pc;
    },
    [closePeer, pushLocalTracks, send],
  );

  const startNegotiation = useCallback(async () => {
    const pc = pcRef.current;
    const peerId = peerIdRef.current;
    if (!pc || !peerId) return;
    try {
      makingOfferRef.current = true;
      setStatus("connecting");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({
        type: "offer",
        from: selfId.current,
        to: peerId,
        sdp: pc.localDescription!.toJSON(),
      });
    } catch (err) {
      console.error("negotiation failed", err);
      setError("Could not start the connection.");
    } finally {
      makingOfferRef.current = false;
    }
  }, [send]);

  const connectToPeer = useCallback(
    (peerId: string) => {
      if (peerIdRef.current === peerId && pcRef.current) return;
      peerIdRef.current = peerId;
      // Deterministic roles: the larger id offers, the smaller one is polite.
      const initiator = selfId.current > peerId;
      politeRef.current = !initiator;
      createPeer(initiator);
      peerIdRef.current = peerId;
      if (initiator) void startNegotiation();
      else setStatus("connecting");
    },
    [createPeer, startNegotiation],
  );

  const drainIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("ice candidate rejected", err);
      }
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* signaling                                                           */
  /* ------------------------------------------------------------------ */

  const handleSignal = useCallback(
    async (msg: SignalPayload) => {
      if (msg.from === selfId.current) return;
      if ("to" in msg && msg.to !== selfId.current) return;

      switch (msg.type) {
        case "hello": {
          setPeerPresent(true);
          setRemoteFlags(msg.flags);
          send({
            type: "hello-ack",
            from: selfId.current,
            to: msg.from,
            flags: flagsRef.current,
          });
          connectToPeer(msg.from);
          break;
        }
        case "hello-ack": {
          setPeerPresent(true);
          setRemoteFlags(msg.flags);
          connectToPeer(msg.from);
          break;
        }
        case "offer": {
          if (!pcRef.current || peerIdRef.current !== msg.from) connectToPeer(msg.from);
          const pc = pcRef.current;
          if (!pc) return;
          const collision =
            makingOfferRef.current || pc.signalingState !== "stable";
          if (collision && !politeRef.current) return; // impolite peer ignores
          try {
            if (collision) {
              await pc.setLocalDescription({ type: "rollback" });
            }
            await pc.setRemoteDescription(msg.sdp);
            await drainIce();
            // Make sure our side of every slot can send, then attach tracks.
            pc.getTransceivers().forEach((t) => {
              if (t.direction !== "sendrecv") t.direction = "sendrecv";
            });
            pushLocalTracks();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({
              type: "answer",
              from: selfId.current,
              to: msg.from,
              sdp: pc.localDescription!.toJSON(),
            });
            broadcastState();
          } catch (err) {
            console.error("offer handling failed", err);
          }
          break;
        }
        case "answer": {
          const pc = pcRef.current;
          if (!pc || pc.signalingState !== "have-local-offer") return;
          try {
            await pc.setRemoteDescription(msg.sdp);
            await drainIce();
            broadcastState();
          } catch (err) {
            console.error("answer handling failed", err);
          }
          break;
        }
        case "ice": {
          const pc = pcRef.current;
          if (!pc || !pc.remoteDescription) {
            pendingIceRef.current.push(msg.candidate);
            return;
          }
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            console.warn("ice candidate rejected", err);
          }
          break;
        }
        case "state": {
          setRemoteFlags(msg.flags);
          break;
        }
        case "bye": {
          closePeer();
          setPeerPresent(false);
          setStatus("waiting");
          break;
        }
      }
    },
    [broadcastState, closePeer, connectToPeer, drainIce, pushLocalTracks, send],
  );

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    const channel = supabase.channel(`watch-together:${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: selfId.current },
      },
    });
    channelRef.current = channel;
    setStatus("waiting");

    channel.on("broadcast", { event: EVENT }, ({ payload }) => {
      void handleSignal(payload as SignalPayload);
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      if (key === peerIdRef.current) {
        closePeer();
        setPeerPresent(false);
        setStatus("waiting");
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ peerId: string; joinedAt: number }>();
      const members = Object.values(state)
        .flat()
        .map((m) => ({ peerId: m.peerId, joinedAt: m.joinedAt }))
        .sort((a, b) => a.joinedAt - b.joinedAt || a.peerId.localeCompare(b.peerId));
      const seatIndex = members.findIndex((m) => m.peerId === selfId.current);
      setRoomFull(seatIndex > 1);
    });


    void channel.subscribe(async (state) => {
      if (state !== "SUBSCRIBED" || cancelled) return;
      await channel.track({ peerId: selfId.current, joinedAt: Date.now() });
      send({ type: "hello", from: selfId.current, flags: flagsRef.current });
    });

    return () => {
      cancelled = true;
      send({ type: "bye", from: selfId.current });
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const stopAllLocalMedia = useCallback(() => {
    [micTrackRef, camTrackRef, screenTrackRef, screenAudioTrackRef].forEach((ref) => {
      ref.current?.stop();
      ref.current = null;
    });
    setLocalCamStream(null);
    setLocalScreenStream(null);
  }, []);

  const leave = useCallback(() => {
    send({ type: "bye", from: selfId.current });
    stopAllLocalMedia();
    closePeer();
  }, [closePeer, send, stopAllLocalMedia]);

  useEffect(() => {
    const onHide = () => {
      send({ type: "bye", from: selfId.current });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      stopAllLocalMedia();
      closePeer();
    };
  }, [closePeer, send, stopAllLocalMedia]);

  /* ------------------------------------------------------------------ */
  /* media controls                                                      */
  /* ------------------------------------------------------------------ */

  const enableMic = useCallback(async () => {
    if (micTrackRef.current) {
      micTrackRef.current.enabled = true;
      setFlags({ mic: true });
      broadcastState();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0] ?? null;
      micTrackRef.current = track;
      await senderFor(SLOT.audio)?.replaceTrack(track);
      setFlags({ mic: true });
      broadcastState();
      setError(null);
    } catch {
      setError("Microphone access was blocked.");
    }
  }, [broadcastState, setFlags]);

  const muteMic = useCallback(() => {
    if (micTrackRef.current) micTrackRef.current.enabled = false;
    setFlags({ mic: false });
    broadcastState();
  }, [broadcastState, setFlags]);

  const toggleMic = useCallback(() => {
    if (flagsRef.current.mic) muteMic();
    else void enableMic();
  }, [enableMic, muteMic]);

  const startCamera = useCallback(async () => {
    if (camTrackRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      const track = stream.getVideoTracks()[0]!;
      track.onended = () => {
        camTrackRef.current = null;
        setLocalCamStream(null);
        setFlags({ cam: false });
        void senderFor(SLOT.camera)?.replaceTrack(null);
        broadcastState();
      };
      camTrackRef.current = track;
      setLocalCamStream(new MediaStream([track]));
      await senderFor(SLOT.camera)?.replaceTrack(track);
      setFlags({ cam: true });
      broadcastState();
      setError(null);
    } catch {
      setError("Camera access was blocked.");
    }
  }, [broadcastState, setFlags]);

  const stopCamera = useCallback(() => {
    const track = camTrackRef.current;
    camTrackRef.current = null;
    if (track) {
      track.onended = null;
      track.stop();
    }
    setLocalCamStream(null);
    void senderFor(SLOT.camera)?.replaceTrack(null);
    setFlags({ cam: false });
    broadcastState();
  }, [broadcastState, setFlags]);

  const toggleCamera = useCallback(() => {
    if (flagsRef.current.cam) stopCamera();
    else void startCamera();
  }, [startCamera, stopCamera]);

  const stopScreenShare = useCallback(() => {
    const track = screenTrackRef.current;
    const audioTrack = screenAudioTrackRef.current;
    screenTrackRef.current = null;
    screenAudioTrackRef.current = null;
    if (track) {
      track.onended = null;
      track.stop();
    }
    if (audioTrack) audioTrack.stop();
    setLocalScreenStream(null);
    void senderFor(SLOT.screen)?.replaceTrack(null);
    void senderFor(SLOT.screenAudio)?.replaceTrack(null);
    setFlags({ screen: false });
    broadcastState();
  }, [broadcastState, setFlags]);

  const startScreenShare = useCallback(async () => {
    if (screenTrackRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        // Ask for tab/system sound too; browsers that can't provide it
        // still return the video, so sharing never fails over audio.
        audio: true,
      });
      const track = stream.getVideoTracks()[0]!;
      const audioTrack = stream.getAudioTracks()[0] ?? null;
      track.onended = () => stopScreenShare();
      if (audioTrack) audioTrack.onended = () => stopScreenShare();
      screenTrackRef.current = track;
      screenAudioTrackRef.current = audioTrack;
      setLocalScreenStream(new MediaStream([track]));
      await senderFor(SLOT.screen)?.replaceTrack(track);
      await senderFor(SLOT.screenAudio)?.replaceTrack(audioTrack);
      setFlags({ screen: true });
      broadcastState();
      setError(null);
    } catch {
      // user cancelled the picker — nothing to report
    }
  }, [broadcastState, setFlags, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (flagsRef.current.screen) stopScreenShare();
    else void startScreenShare();
  }, [startScreenShare, stopScreenShare]);

  return {
    selfId: selfId.current,
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
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    enableMic,
    leave,
  };
}
