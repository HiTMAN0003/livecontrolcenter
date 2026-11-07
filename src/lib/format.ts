import type { Orientation } from "@/lib/types";

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function formatCount(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

export function clock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function uptime(started: number, now: number) {
  const total = Math.max(0, Math.floor((now - started) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function guessOrientation(title: string): Orientation {
  return /(vertical|shorts|portrait|tiktok|reels|face cam)/i.test(title) ? "vertical" : "horizontal";
}

export function cleanToken(raw: string) {
  return raw
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/^["']|["']$/g, "");
}

export function toneFor(name: string) {
  const tones = ["bg-neon/25", "bg-signal/25", "bg-hot/20", "bg-ok/20"] as const;
  let h = 0;
  for (const c of name) h = (h + c.charCodeAt(0)) % tones.length;
  return tones[h];
}

export function hitsKeyword(text: string, keywords: string[]) {
  const hay = text.toLowerCase();
  return keywords.find((k) => k.length > 1 && hay.includes(k.toLowerCase())) ?? null;
}
