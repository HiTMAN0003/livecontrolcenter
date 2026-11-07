import { create } from "zustand";
import { hitsKeyword, uid } from "@/lib/format";
import type {
  ChatMessage,
  DeskEvent,
  FilterMode,
  HistoryPoint,
  Identity,
  Mode,
  Notice,
  NoticeTone,
  Phase,
  Stream,
} from "@/lib/types";

const KW_KEY = "midnightog.keywords";
const SOUND_KEY = "midnightog.sound";

function readKeywords(): string[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(KW_KEY) ?? "";
  return raw
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 1)
    .slice(0, 12);
}

function readSound() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SOUND_KEY) === "1";
}

type Announce = { announce: boolean };

function signalFor(msg: ChatMessage, keywords: string[]): DeskEvent["tone"] | null {
  if (msg.kind === "super") return "super";
  if (msg.kind === "member") return "member";
  if (msg.kind === "text" && hitsKeyword(msg.text, keywords)) return "keyword";
  return null;
}

function signalText(msg: ChatMessage, tone: DeskEvent["tone"], keywords: string[]) {
  if (tone === "super") return `${msg.superAmount ?? "Super"} · ${msg.author}`;
  if (tone === "member") return `${msg.author} joined`;
  const word = hitsKeyword(msg.text, keywords);
  return `${msg.author} said “${word}”`;
}

export type DeskState = {
  phase: Phase;
  mode: Mode | null;
  token: string | null;
  identity: Identity | null;
  streams: Stream[];
  notices: Notice[];
  events: DeskEvent[];
  history: HistoryPoint[];
  keywords: string[];
  keywordDraft: string;
  filter: FilterMode;
  sound: boolean;
  connectOpen: boolean;
  connecting: boolean;
  connectError: string | null;
  drafts: Record<string, string>;
  sending: Record<string, boolean>;
  loadingLabel: string;
  now: number;
  pushNotice: (tone: NoticeTone, text: string) => void;
  dismissNotice: (id: string) => void;
  setConnectOpen: (open: boolean) => void;
  setConnectError: (text: string | null) => void;
  setConnecting: (value: boolean) => void;
  setKeywordDraft: (value: string) => void;
  commitKeywords: () => void;
  toggleSound: () => void;
  setFilter: (filter: FilterMode) => void;
  setDraft: (streamId: string, value: string) => void;
  setReply: (streamId: string, name: string | null) => void;
  toggleOrientation: (streamId: string) => void;
  patchStream: (streamId: string, partial: Partial<Stream>) => void;
  appendMessages: (streamId: string, incoming: ChatMessage[], opts: Announce) => void;
  removeMessage: (streamId: string, messageId: string) => void;
  setSending: (streamId: string, value: boolean) => void;
  pushHistory: (viewers: number) => void;
  pushSpike: (streamTitle: string, text: string) => void;
  setNow: (now: number) => void;
  beginLoading: (label: string) => void;
  showEmpty: (input: { token: string; identity: Identity }) => void;
  showDesk: (input: {
    mode: Mode;
    token: string | null;
    identity: Identity;
    streams: Stream[];
    history: HistoryPoint[];
  }) => void;
  resetIdle: () => void;
};

export const useDesk = create<DeskState>((set, get) => ({
  phase: "idle",
  mode: null,
  token: null,
  identity: null,
  streams: [],
  notices: [],
  events: [],
  history: [],
  keywords: [],
  keywordDraft: "",
  filter: "all",
  sound: false,
  connectOpen: false,
  connecting: false,
  connectError: null,
  drafts: {},
  sending: {},
  loadingLabel: "Syncing active broadcasts…",
  now: Date.now(),

  pushNotice: (tone, text) => {
    const id = uid("n");
    set((s) => ({ notices: [...s.notices, { id, tone, text }].slice(-4) }));
    setTimeout(() => {
      set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
    }, 7000);
  },
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  setConnectOpen: (open) => set({ connectOpen: open, connectError: open ? get().connectError : null }),
  setConnectError: (text) => set({ connectError: text }),
  setConnecting: (value) => set({ connecting: value }),
  setKeywordDraft: (value) => set({ keywordDraft: value }),
  commitKeywords: () => {
    const words = get()
      .keywordDraft.split(",")
      .map((w) => w.trim())
      .filter((w) => w.length > 1)
      .slice(0, 12);
    if (typeof localStorage !== "undefined") localStorage.setItem(KW_KEY, words.join(", "));
    set({ keywords: words, keywordDraft: words.join(", ") });
  },
  toggleSound: () => {
    const sound = !get().sound;
    if (typeof localStorage !== "undefined") localStorage.setItem(SOUND_KEY, sound ? "1" : "0");
    set({ sound });
  },
  setFilter: (filter) => set({ filter }),
  setDraft: (streamId, value) => set((s) => ({ drafts: { ...s.drafts, [streamId]: value } })),
  setReply: (streamId, name) =>
    set((s) => ({
      streams: s.streams.map((st) => (st.id === streamId ? { ...st, replyingTo: name } : st)),
    })),
  toggleOrientation: (streamId) =>
    set((s) => ({
      streams: s.streams.map((st) =>
        st.id === streamId
          ? { ...st, orientation: st.orientation === "horizontal" ? "vertical" : "horizontal" }
          : st,
      ),
    })),
  patchStream: (streamId, partial) =>
    set((s) => ({
      streams: s.streams.map((st) => (st.id === streamId ? { ...st, ...partial } : st)),
    })),
  appendMessages: (streamId, incoming, opts) =>
    set((s) => {
      const stream = s.streams.find((st) => st.id === streamId);
      if (!stream || incoming.length === 0) return s;
      const known = new Set(stream.messages.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return s;

      let messages = stream.messages;
      for (const msg of fresh) {
        if (msg.badges.includes("owner")) {
          messages = messages.filter((existing) => !(existing.pending && existing.text === msg.text));
        }
      }
      messages = [...messages, ...fresh].slice(-140);

      let events = s.events;
      if (opts.announce) {
        const added: DeskEvent[] = [];
        for (const msg of fresh) {
          const tone = signalFor(msg, s.keywords);
          if (!tone) continue;
          added.push({
            id: uid("ev"),
            at: msg.at,
            streamTitle: stream.title,
            text: signalText(msg, tone, s.keywords),
            tone,
          });
        }
        if (added.length) events = [...added.reverse(), ...events].slice(0, 12);
      }

      return {
        events,
        streams: s.streams.map((st) => (st.id === streamId ? { ...st, messages } : st)),
      };
    }),
  removeMessage: (streamId, messageId) =>
    set((s) => ({
      streams: s.streams.map((st) =>
        st.id === streamId ? { ...st, messages: st.messages.filter((m) => m.id !== messageId) } : st,
      ),
    })),
  setSending: (streamId, value) => set((s) => ({ sending: { ...s.sending, [streamId]: value } })),
  pushHistory: (viewers) =>
    set((s) => ({
      history: [...s.history, { t: Date.now(), viewers }].slice(-28),
    })),
  pushSpike: (streamTitle, text) =>
    set((s) => ({
      events: [
        { id: uid("ev"), at: Date.now(), streamTitle, text, tone: "spike" as const },
        ...s.events,
      ].slice(0, 12),
    })),
  setNow: (now) => set({ now }),
  beginLoading: (label) => set({ phase: "loading", loadingLabel: label, connectError: null }),
  showEmpty: ({ token, identity }) =>
    set({
      phase: "empty",
      mode: "live",
      token,
      identity,
      streams: [],
      history: [],
      connecting: false,
      connectOpen: false,
      connectError: null,
    }),
  showDesk: ({ mode, token, identity, streams, history }) =>
    set({
      phase: "desk",
      mode,
      token,
      identity,
      streams,
      history,
      drafts: {},
      sending: {},
      events: mode === "demo" ? [] : get().events,
      connecting: false,
      connectOpen: false,
      connectError: null,
      now: Date.now(),
    }),
  resetIdle: () =>
    set({
      phase: "idle",
      mode: null,
      token: null,
      identity: null,
      streams: [],
      history: [],
      events: [],
      drafts: {},
      sending: {},
      connecting: false,
      connectError: null,
    }),
}));

export function hydratePrefs() {
  const keywords = readKeywords();
  useDesk.setState({
    keywords,
    keywordDraft: keywords.join(", "),
    sound: readSound(),
  });
}
