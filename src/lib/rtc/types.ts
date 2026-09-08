export type MediaFlags = {
  cam: boolean;
  mic: boolean;
  screen: boolean;
};

export type ConnectionStatus =
  | "idle"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type SignalPayload =
  | { type: "hello"; from: string; flags: MediaFlags }
  | { type: "hello-ack"; from: string; to: string; flags: MediaFlags }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "state"; from: string; flags: MediaFlags }
  | { type: "bye"; from: string };

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["stun:global.stun.twilio.com:3478"] },
];

/** Fixed m-line order shared by both peers. Never changes for the call's lifetime. */
export const SLOT = {
  audio: 0,
  camera: 1,
  screen: 2,
  screenAudio: 3,
} as const;
