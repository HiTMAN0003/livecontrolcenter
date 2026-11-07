import { cleanToken, hitsKeyword, uid } from "@/lib/format";
import { hydratePrefs, useDesk } from "@/lib/desk-store";
import type { Badge, ChatMessage, HistoryPoint, Stream } from "@/lib/types";
import {
  chatIsDisabled,
  chatShouldStop,
  fetchActiveBroadcasts,
  fetchChannel,
  fetchVideoPulse,
  postChat,
  watchChatStream,
  YouTubeError,
} from "@/lib/youtube";

const TOKEN_KEY = "midnightog.yt";
const SKIP_DEMO = "midnightog.skipDemo";

let gen = 0;
let connectAttempt = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();
const chatStops = new Set<AbortController>();
let lastViewerTotal = 0;
let audioCtx: AudioContext | null = null;
let booted = false;

const PEOPLE: { name: string; badges: Badge[] }[] = [
  { name: "nova", badges: [] },
  { name: "kite", badges: [] },
  { name: "marble", badges: ["member"] },
  { name: "ash", badges: [] },
  { name: "rin", badges: ["mod"] },
  { name: "lowpoly", badges: [] },
  { name: "junebug", badges: ["member"] },
  { name: "sable", badges: [] },
  { name: "ortho", badges: [] },
  { name: "MidnightOG", badges: ["owner"] },
];

const H_LINES = [
  "that third party was criminal",
  "POG",
  "horizontal looks clean tonight",
  "what rank is this",
  "clip that",
  "can you hear discord",
  "LMAO the rotate",
  "gg go next",
  "audio is peaking a little",
  "this lobby is doomed",
  "say the score",
  "one more then queue",
  "chat move that crosshair",
  "the other stream is popping",
  "who called that rotate",
  "mods, timeout the spam",
  "nice util",
  "I'm only on landscape",
];

const V_LINES = [
  "watching on my phone",
  "vertical frame is perfect",
  "shorts chat is faster",
  "hi from the bus",
  "face cam is a bit close",
  "say the bit again",
  "I only have the vertical open",
  "turn the cam up",
  "this angle eats",
  "late night crew checking in",
  "the mic sounds warmer here",
  "don't crop the hands",
  "portrait is the one I keep open",
  "say it for the clip",
  "volume on the vertical is low",
  "wave at the camera",
];

const recentTexts: Record<"h" | "v", string[]> = { h: [], v: [] };

const SUPERS = ["$2.00", "$5.00", "$10.00", "$20.00"];

function later(fn: () => void, ms: number, epoch: number) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (epoch !== gen) return;
    fn();
  }, ms);
  timers.add(timer);
}

export function halt() {
  gen += 1;
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  for (const stop of chatStops) stop.abort();
  chatStops.clear();
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function youMessage(text: string, author: string, pending = false): ChatMessage {
  return {
    id: uid("you"),
    author,
    avatarUrl: null,
    text,
    at: Date.now(),
    badges: [],
    kind: "text",
    pending,
    you: true,
  };
}

function demoLine(which: "h" | "v", force?: "super" | "member"): ChatMessage {
  const roll = Math.random();
  const person = pick(PEOPLE.filter((p) => !p.badges.includes("owner") || Math.random() > 0.85));
  const lines = which === "h" ? H_LINES : V_LINES;
  if (force === "member" || roll > 0.94) {
    return {
      id: uid("m"),
      author: person.name,
      avatarUrl: null,
      text: "became a member",
      at: Date.now(),
      badges: ["member", ...person.badges.filter((b) => b !== "member")],
      kind: "member",
    };
  }
  if (force === "super" || roll > 0.88) {
    return {
      id: uid("m"),
      author: person.name,
      avatarUrl: null,
      text: pick(["let's go", "for the raid", "love the dual stream", "take this"]),
      at: Date.now(),
      badges: person.badges,
      kind: "super",
      superAmount: pick(SUPERS),
    };
  }
  let text = pick(lines);
  for (let guard = 0; guard < 6 && recentTexts[which].includes(text); guard += 1) text = pick(lines);
  if (Math.random() > 0.93) text = "raid when you die";
  recentTexts[which] = [...recentTexts[which], text].slice(-5);
  return {
    id: uid("m"),
    author: person.name,
    avatarUrl: null,
    text,
    at: Date.now() - Math.floor(Math.random() * 4000),
    badges: person.badges,
    kind: "text",
  };
}

function seedStream(partial: Omit<Stream, "messages" | "chatState" | "chatNote" | "replyingTo" | "nextPageToken" | "pollMs"> & { which: "h" | "v" }): Stream {
  const seeded: ChatMessage[] = [
    {
      id: uid("sys"),
      author: "desk",
      avatarUrl: null,
      text: "Chat connected",
      at: Date.now() - 1000 * 60 * 8,
      badges: [],
      kind: "system",
    },
  ];
  for (let i = 0; i < 7; i += 1) {
    const msg = demoLine(partial.which);
    msg.at = Date.now() - (7 - i) * 50_000;
    seeded.push(msg);
  }
  return {
    id: partial.id,
    title: partial.title,
    orientation: partial.orientation,
    liveChatId: partial.liveChatId,
    viewers: partial.viewers,
    likes: partial.likes,
    startedAt: partial.startedAt,
    messages: seeded,
    nextPageToken: "",
    pollMs: 2500,
    replyingTo: null,
    chatState: "open",
    chatNote: null,
  };
}

function seedHistory(total: number): HistoryPoint[] {
  const now = Date.now();
  return Array.from({ length: 18 }, (_, i) => ({
    t: now - (17 - i) * 15000,
    viewers: Math.round(total * (0.84 + ((i * 17) % 13) / 80)),
  }));
}

function beep() {
  if (!useDesk.getState().sound) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.07);
  } catch {
    /* autoplay policies vary; the desk still works silently */
  }
}

function watchSignals(before: number) {
  later(() => {
    const after = useDesk.getState().events.length;
    if (after !== before) beep();
  }, 30, gen);
}

function startClock(epoch: number) {
  const tick = () => {
    useDesk.getState().setNow(Date.now());
    later(tick, 1000, epoch);
  };
  later(tick, 1000, epoch);
}

function startDemo(epoch: number) {
  const now = Date.now();
  const horizontal = seedStream({
    which: "h",
    id: "demo-h",
    title: "Midnight Raid — Ranked [Horizontal]",
    orientation: "horizontal",
    liveChatId: "demo-chat-h",
    viewers: 1842,
    likes: 906,
    startedAt: now - 47 * 60 * 1000,
  });
  const vertical = seedStream({
    which: "v",
    id: "demo-v",
    title: "Face Cam & Late Chat [Vertical]",
    orientation: "vertical",
    liveChatId: "demo-chat-v",
    viewers: 326,
    likes: 241,
    startedAt: now - 12 * 60 * 1000,
  });
  const total = (horizontal.viewers ?? 0) + (vertical.viewers ?? 0);
  lastViewerTotal = total;
  useDesk.getState().showDesk({
    mode: "demo",
    token: null,
    identity: { name: "Demo broadcaster", avatarUrl: null },
    streams: [horizontal, vertical],
    history: seedHistory(total),
  });
  if (useDesk.getState().keywords.length === 0) {
    useDesk.setState({ keywords: ["raid"], keywordDraft: "raid" });
  }
  startClock(epoch);

  let step = 0;
  const tick = () => {
    step += 1;
    const state = useDesk.getState();
    const which: "h" | "v" = Math.random() > 0.42 ? "h" : "v";
    const id = which === "h" ? "demo-h" : "demo-v";
    const stream = state.streams.find((s) => s.id === id);
    if (stream) {
      const drift = Math.round((Math.random() - 0.42) * 18);
      const spike = step % 11 === 0;
      const viewers = Math.max(40, (stream.viewers ?? 0) + drift + (spike ? 48 : 0));
      const likes = (stream.likes ?? 0) + (Math.random() > 0.7 ? 1 : 0);
      state.patchStream(id, { viewers, likes, pollMs: 2200 });
      if (spike) state.pushSpike(stream.title, `Viewer spike · ${viewers.toLocaleString()} watching`);
      const before = state.events.length;
      state.appendMessages(id, [demoLine(which)], { announce: true });
      if (useDesk.getState().events.length !== before) beep();
    }
    const sum = useDesk.getState().streams.reduce((n, s) => n + (s.viewers ?? 0), 0);
    if (step % 2 === 0) useDesk.getState().pushHistory(sum);
    lastViewerTotal = sum;
    later(tick, 1600 + Math.random() * 1400, epoch);
  };
  later(tick, 1200, epoch);
}

function noteAuthFailure(message: string) {
  halt();
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
  useDesk.getState().resetIdle();
  useDesk.getState().pushNotice("err", message);
}

async function pollStats(token: string, streamId: string, epoch: number) {
  if (epoch !== gen) return;
  try {
    const pulse = await fetchVideoPulse(token, streamId);
    if (epoch !== gen) return;
    const state = useDesk.getState();
    const stream = state.streams.find((s) => s.id === streamId);
    if (!stream) return;
    state.patchStream(streamId, {
      viewers: pulse.viewers ?? stream.viewers,
      likes: pulse.likes ?? stream.likes,
    });
    const total = useDesk.getState().streams.reduce((n, s) => n + (s.viewers ?? 0), 0);
    state.pushHistory(total);
    if (lastViewerTotal > 30 && total > lastViewerTotal * 1.12) {
      state.pushSpike(stream.title, `Viewer spike · ${total.toLocaleString()} across the desk`);
      beep();
    }
    lastViewerTotal = total;
  } catch (error) {
    if (epoch !== gen) return;
    if (error instanceof YouTubeError && error.status === 401) {
      noteAuthFailure(error.message);
      return;
    }
  }
  later(() => void pollStats(token, streamId, epoch), 15000, epoch);
}

async function streamChat(token: string, streamId: string, epoch: number) {
  if (epoch !== gen) return;
  const stream = useDesk.getState().streams.find((item) => item.id === streamId);
  if (!stream?.liveChatId) return;
  const stop = new AbortController();
  chatStops.add(stop);
  let first = true;
  try {
    for await (const page of watchChatStream(token, stream.liveChatId, stop.signal, stream.nextPageToken)) {
      if (epoch !== gen) return;
      const announce = !first;
      const batch = first ? page.messages.slice(-40) : page.messages;
      first = false;
      const before = useDesk.getState().events.length;
      useDesk.getState().patchStream(streamId, {
        nextPageToken: page.nextPageToken,
        pollMs: page.pollMs,
        chatState: page.offlineAt ? "closed" : "open",
        chatNote: page.offlineAt ? "This livestream is offline." : null,
      });
      useDesk.getState().appendMessages(streamId, batch, { announce });
      if (announce && useDesk.getState().events.length !== before) beep();
      if (page.offlineAt) return;
    }
  } catch (error) {
    if (epoch !== gen || stop.signal.aborted) return;
    if (error instanceof YouTubeError && error.status === 401) {
      noteAuthFailure(error.message);
      return;
    }
    if (chatIsDisabled(error)) {
      useDesk.getState().patchStream(streamId, {
        chatState: "closed",
        chatNote: error instanceof YouTubeError ? error.message : "Live chat is off or this token can’t read it.",
      });
      return;
    }
    if (chatShouldStop(error)) {
      useDesk.getState().pushNotice("err", error instanceof YouTubeError ? error.message : "Chat stream stopped.");
      useDesk.getState().patchStream(streamId, { chatState: "closed", chatNote: "Chat stream stopped." });
    }
  } finally {
    chatStops.delete(stop);
  }
}

function startLive(epoch: number, token: string) {
  startClock(epoch);
  const streams = useDesk.getState().streams;
  lastViewerTotal = 0;
  for (const stream of streams) {
    void pollStats(token, stream.id, epoch);
    if (stream.liveChatId) void streamChat(token, stream.id, epoch);
  }
}

export function boot() {
  if (!booted) {
    hydratePrefs();
    booted = true;
  }
  const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
  if (token) {
    void connectWithToken(token, { fromBoot: true });
    return;
  }
  const skip = typeof sessionStorage !== "undefined" && sessionStorage.getItem(SKIP_DEMO) === "1";
  if (skip) {
    useDesk.getState().resetIdle();
    return;
  }
  enterDemo();
}

export function enterDemo() {
  connectAttempt += 1;
  halt();
  const epoch = gen;
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SKIP_DEMO);
  startDemo(epoch);
}

export function disconnect() {
  connectAttempt += 1;
  halt();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(SKIP_DEMO, "1");
  }
  useDesk.getState().setConnectOpen(false);
  useDesk.getState().resetIdle();
}

export async function connectWithToken(raw: string, opts?: { fromBoot?: boolean }) {
  const token = cleanToken(raw);
  const attempt = ++connectAttempt;
  if (token.length < 20) {
    useDesk.getState().setConnectError("That doesn’t look like an access token.");
    useDesk.getState().setConnecting(false);
    if (opts?.fromBoot) useDesk.getState().resetIdle();
    return;
  }
  useDesk.getState().setConnecting(true);
  useDesk.getState().setConnectError(null);
  if (opts?.fromBoot) useDesk.getState().beginLoading("Reconnecting YouTube…");
  try {
    const identity = await fetchChannel(token);
    const streams = await fetchActiveBroadcasts(token);
    if (attempt !== connectAttempt) return;
    halt();
    const epoch = gen;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(SKIP_DEMO);
    }
    if (streams.length === 0) {
      useDesk.getState().showEmpty({ token, identity });
      return;
    }
    useDesk.getState().showDesk({
      mode: "live",
      token,
      identity,
      streams,
      history: [{ t: Date.now(), viewers: 0 }],
    });
    startLive(epoch, token);
  } catch (error) {
    if (attempt !== connectAttempt) return;
    const message = error instanceof YouTubeError ? error.message : "Couldn’t reach YouTube.";
    useDesk.getState().setConnecting(false);
    if (opts?.fromBoot) {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
      useDesk.getState().resetIdle();
      useDesk.getState().pushNotice("err", message);
      return;
    }
    useDesk.getState().setConnectError(message);
  }
}

export async function refreshDesk() {
  const { mode, token } = useDesk.getState();
  if (mode === "demo") {
    enterDemo();
    return;
  }
  if (token) {
    useDesk.getState().beginLoading("Refreshing broadcasts…");
    await connectWithToken(token, { fromBoot: true });
  }
}

export async function sendChat(streamId: string) {
  const state = useDesk.getState();
  const stream = state.streams.find((s) => s.id === streamId);
  const raw = (state.drafts[streamId] ?? "").trim();
  if (!stream || !raw || state.sending[streamId]) return;
  const text = stream.replyingTo ? `@${stream.replyingTo} ${raw}` : raw;
  if (state.mode === "live" && !stream.liveChatId) {
    state.pushNotice("err", "This broadcast has no live chat id.");
    return;
  }
  state.setDraft(streamId, "");
  state.setReply(streamId, null);

  if (state.mode === "demo") {
    const before = state.events.length;
    state.appendMessages(
      streamId,
      [youMessage(text, "You")],
      { announce: Boolean(hitsKeyword(text, state.keywords)) },
    );
    watchSignals(before);
    return;
  }

  const pending = youMessage(text, state.identity?.name || "You", true);
  state.appendMessages(streamId, [pending], { announce: false });
  state.setSending(streamId, true);
  try {
    await postChat(state.token ?? "", stream.liveChatId ?? "", text);
  } catch (error) {
    useDesk.getState().removeMessage(streamId, pending.id);
    useDesk.getState().setDraft(streamId, raw);
    const message = error instanceof YouTubeError ? error.message : "Couldn’t send that message.";
    if (error instanceof YouTubeError && error.status === 401) noteAuthFailure(message);
    else useDesk.getState().pushNotice("err", message);
  } finally {
    useDesk.getState().setSending(streamId, false);
  }
}

export function isSignal(message: ChatMessage, keywords: string[]) {
  if (message.kind === "system") return true;
  if (message.kind === "super" || message.kind === "member") return true;
  return Boolean(hitsKeyword(message.text, keywords));
}
