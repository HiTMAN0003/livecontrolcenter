import { guessOrientation } from "@/lib/format";
import type { Badge, ChatMessage, Stream } from "@/lib/types";

const BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeError extends Error {
  status: number;
  reason: string;
  constructor(message: string, status: number, reason = "") {
    super(message);
    this.name = "YouTubeError";
    this.status = status;
    this.reason = reason;
  }
}

type ErrBody = {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
};

function plainYouTubeMessage(body: ErrBody, status: number) {
  const reason = body.error?.errors?.[0]?.reason ?? "";
  const raw = (body.error?.message ?? "").replace(/<[^>]+>/g, "").trim();
  if (reason === "quotaExceeded" || /quota/i.test(raw)) {
    return "YouTube’s daily API quota for this token is used up. It resets overnight Pacific time. A token from another Google Cloud project still has its own quota.";
  }
  if (reason === "rateLimitExceeded") {
    return "YouTube is rate-limiting this token. Wait a minute, then try again.";
  }
  if (reason === "liveChatDisabled") return "Live chat is off for this broadcast.";
  if (reason === "liveChatEnded") return "Live chat has ended.";
  if (reason === "liveChatNotFound") return "That live chat cannot be found.";
  if (raw) return raw;
  if (status === 401) return "YouTube access expired. Connect again.";
  return `YouTube error ${status}`;
}

async function yt<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrBody;
    const reason = body.error?.errors?.[0]?.reason ?? "";
    throw new YouTubeError(plainYouTubeMessage(body, res.status), res.status, reason);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

type ChannelList = {
  items?: Array<{
    snippet?: {
      title?: string;
      thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
    };
  }>;
};

export async function fetchChannel(token: string) {
  const data = await yt<ChannelList>(token, "channels?part=snippet&mine=true");
  const snippet = data.items?.[0]?.snippet;
  return {
    name: snippet?.title || "Your channel",
    avatarUrl: snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url || null,
  };
}

type BroadcastList = {
  items?: Array<{
    id: string;
    snippet?: { title?: string; publishedAt?: string; liveChatId?: string };
  }>;
};

export async function fetchActiveBroadcasts(token: string): Promise<Stream[]> {
  const data = await yt<BroadcastList>(
    token,
    "liveBroadcasts?part=snippet,status&broadcastStatus=active&broadcastType=all&maxResults=10",
  );
  return (data.items ?? []).map((item) => {
    const title = item.snippet?.title || "Untitled broadcast";
    const started = Date.parse(item.snippet?.publishedAt ?? "");
    return {
      id: item.id,
      title,
      orientation: guessOrientation(title),
      liveChatId: item.snippet?.liveChatId ?? null,
      viewers: null,
      likes: null,
      startedAt: Number.isNaN(started) ? Date.now() : started,
      messages: [],
      nextPageToken: "",
      pollMs: 5000,
      replyingTo: null,
      chatState: item.snippet?.liveChatId ? "connecting" : "closed",
      chatNote: item.snippet?.liveChatId ? null : "This broadcast has no live chat id.",
    } satisfies Stream;
  });
}

type VideoList = {
  items?: Array<{
    statistics?: { likeCount?: string };
    liveStreamingDetails?: { concurrentViewers?: string };
  }>;
};

export async function fetchVideoPulse(token: string, videoId: string) {
  const data = await yt<VideoList>(
    token,
    `videos?part=liveStreamingDetails,statistics&id=${encodeURIComponent(videoId)}`,
  );
  const item = data.items?.[0];
  const viewers = item?.liveStreamingDetails?.concurrentViewers;
  const likes = item?.statistics?.likeCount;
  return {
    viewers: viewers != null ? Number(viewers) : null,
    likes: likes != null ? Number(likes) : null,
  };
}

type ChatList = {
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  offlineAt?: string;
  items?: YTChatItem[];
};

type YTChatItem = {
  id: string;
  authorDetails?: {
    displayName?: string;
    profileImageUrl?: string;
    isChatOwner?: boolean;
    isChatModerator?: boolean;
    isChatSponsor?: boolean;
  };
  snippet?: {
    type?: string;
    displayMessage?: string;
    publishedAt?: string;
    superChatDetails?: { amountDisplayString?: string; userComment?: string };
    superStickerDetails?: { amountDisplayString?: string };
  };
};

export async function postChat(token: string, liveChatId: string, messageText: string) {
  await yt(token, "liveChat/messages?part=snippet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      snippet: {
        type: "textMessageEvent",
        liveChatId,
        textMessageDetails: { messageText },
      },
    }),
  });
}

function mapChatItem(item: YTChatItem): ChatMessage | null {
  const snippet = item.snippet ?? {};
  const author = item.authorDetails ?? {};
  const type = snippet.type ?? "textMessageEvent";
  const name = author.displayName || "Viewer";
  const badges: Badge[] = [];
  if (author.isChatOwner) badges.push("owner");
  if (author.isChatModerator) badges.push("mod");
  if (author.isChatSponsor) badges.push("member");
  const at = Date.parse(snippet.publishedAt ?? "") || Date.now();
  const base = {
    id: item.id,
    author: name,
    avatarUrl: author.profileImageUrl ?? null,
    at,
    badges,
  };

  if (type === "superChatEvent" || type === "superStickerEvent" || type === "fanFundingEvent") {
    const amount =
      snippet.superChatDetails?.amountDisplayString ||
      snippet.superStickerDetails?.amountDisplayString ||
      "Super";
    const text = snippet.superChatDetails?.userComment || snippet.displayMessage || "Super Chat";
    return { ...base, text, kind: "super", superAmount: amount };
  }

  if (
    type === "newSponsorEvent" ||
    type === "memberMilestoneChatEvent" ||
    type === "membershipGiftingEvent"
  ) {
    return { ...base, text: snippet.displayMessage || "New member", kind: "member" };
  }

  if (!snippet.displayMessage) return null;
  return { ...base, text: snippet.displayMessage, kind: "text" };
}

export function chatIsDisabled(error: unknown) {
  if (!(error instanceof YouTubeError)) return false;
  if (error.status === 404) return true;
  if (error.reason === "liveChatDisabled" || error.reason === "liveChatEnded" || error.reason === "liveChatNotFound") {
    return true;
  }
  return /live chat is off|live chat has ended|cannot be found|disabled|not found/i.test(error.message);
}

export function chatShouldStop(error: unknown) {
  if (!(error instanceof YouTubeError)) return false;
  if (error.status === 401) return true;
  if (error.reason === "quotaExceeded" || /quota/i.test(error.message)) return true;
  return chatIsDisabled(error);
}

export type ChatPage = {
  messages: ChatMessage[];
  nextPageToken: string;
  pollMs: number;
  offlineAt: string | null;
};

const STREAM_PATH = "liveChat/messages/stream";

function pageFromBody(data: ChatList, pageToken: string): ChatPage {
  const messages = (data.items ?? []).map(mapChatItem).filter((m): m is ChatMessage => m != null);
  return {
    messages,
    nextPageToken: data.nextPageToken ?? pageToken,
    pollMs: data.pollingIntervalMillis ?? 5000,
    offlineAt: data.offlineAt ?? null,
  };
}

/** Pulls complete JSON objects out of a server-streamed HTTP body. */
export function takeJsonObjects(buffer: string): { objects: unknown[]; rest: string } {
  const objects: unknown[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let consumed = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(JSON.parse(buffer.slice(start, i + 1)));
        consumed = i + 1;
        start = -1;
      }
    }
  }
  return { objects, rest: buffer.slice(consumed) };
}

async function* readChatObjects(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<ChatList> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.startsWith(")]}'")) pending = pending.slice(pending.indexOf("\n") + 1);
      const pulled = takeJsonObjects(pending);
      pending = pulled.rest;
      for (const object of pulled.objects) yield object as ChatList;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* openChatStream(
  token: string,
  liveChatId: string,
  pageToken: string,
  signal: AbortSignal,
): AsyncGenerator<ChatPage> {
  const query = new URLSearchParams({
    liveChatId,
    part: "id,snippet,authorDetails",
    maxResults: "200",
    profileImageSize: "64",
  });
  if (pageToken) query.set("pageToken", pageToken);
  const response = await fetch(`${BASE}/${STREAM_PATH}?${query.toString()}`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrBody;
    const reason = body.error?.errors?.[0]?.reason ?? "";
    throw new YouTubeError(plainYouTubeMessage(body, response.status), response.status, reason);
  }
  if (!response.body) throw new YouTubeError("YouTube closed the chat stream.", 0);
  let cursor = pageToken;
  for await (const data of readChatObjects(response.body, signal)) {
    const page = pageFromBody(data, cursor);
    cursor = page.nextPageToken;
    yield page;
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", finish);
      resolve();
    }, ms);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", finish, { once: true });
  });
}

/**
 * One liveChatMessages.streamList connection per chat.
 * A dropped stream resumes from the last nextPageToken instead of re-polling.
 */
export async function* watchChatStream(
  token: string,
  liveChatId: string,
  signal: AbortSignal,
  pageToken = "",
): AsyncGenerator<ChatPage> {
  let cursor = pageToken;
  let delay = 1000;
  while (!signal.aborted) {
    let received = false;
    try {
      for await (const page of openChatStream(token, liveChatId, cursor, signal)) {
        if (signal.aborted) return;
        cursor = page.nextPageToken || cursor;
        received = true;
        delay = 1000;
        yield page;
        if (page.offlineAt) return;
      }
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      if (chatShouldStop(error)) throw error;
      await wait(delay, signal);
      delay = Math.min(delay * 2, 30_000);
      continue;
    }
    if (signal.aborted) return;
    await wait(received ? 1000 : delay, signal);
    if (!received) delay = Math.min(delay * 2, 30_000);
  }
}
