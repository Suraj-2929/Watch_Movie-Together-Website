import { supabase } from "@/integrations/supabase/client";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomId(length = 6) {
  let id = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

export function normalizeRoomId(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function createRoom(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateRoomId();
    const { error } = await supabase.from("rooms").insert({ id });
    if (!error) return id;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not create a room. Please try again.");
}

export async function roomExists(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function touchRoom(id: string) {
  await supabase.from("rooms").update({ last_seen_at: new Date().toISOString() }).eq("id", id);
}
