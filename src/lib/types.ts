export type Orientation = "horizontal" | "vertical";
export type Phase = "idle" | "loading" | "empty" | "desk";
export type Mode = "demo" | "live";
export type NoticeTone = "err" | "ok" | "info";
export type Badge = "owner" | "mod" | "member";
export type MsgKind = "text" | "super" | "member" | "system";
export type FilterMode = "all" | "signals";

export type ChatMessage = {
  id: string;
  author: string;
  avatarUrl: string | null;
  text: string;
  at: number;
  badges: Badge[];
  kind: MsgKind;
  superAmount?: string;
  pending?: boolean;
  you?: boolean;
};

export type Stream = {
  id: string;
  title: string;
  orientation: Orientation;
  liveChatId: string | null;
  viewers: number | null;
  likes: number | null;
  startedAt: number;
  messages: ChatMessage[];
  nextPageToken: string;
  pollMs: number;
  replyingTo: string | null;
  chatState: "open" | "closed" | "connecting";
  chatNote: string | null;
};

export type DeskEvent = {
  id: string;
  at: number;
  streamTitle: string;
  text: string;
  tone: "super" | "member" | "keyword" | "spike";
};

export type Notice = {
  id: string;
  tone: NoticeTone;
  text: string;
};

export type Identity = {
  name: string;
  avatarUrl: string | null;
};

export type HistoryPoint = { t: number; viewers: number };
