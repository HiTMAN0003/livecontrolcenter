import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Copy,
  Crown,
  ExternalLink,
  Eye,
  Monitor,
  Reply,
  Send,
  Smartphone,
  Star,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";
import { isSignal, sendChat } from "@/lib/desk-engine";
import { clock, formatCount, toneFor, uptime } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";
import type { Badge, ChatMessage, Stream } from "@/lib/types";

export function StreamPanel({ id }: { id: string }) {
  const stream = useDesk((s) => s.streams.find((item) => item.id === id));
  if (!stream) return null;
  return <Panel stream={stream} />;
}

function Panel({ stream }: { stream: Stream }) {
  const filter = useDesk((s) => s.filter);
  const keywords = useDesk((s) => s.keywords);
  const draft = useDesk((s) => s.drafts[stream.id] ?? "");
  const sending = useDesk((s) => s.sending[stream.id] ?? false);
  const mode = useDesk((s) => s.mode);
  const setDraft = useDesk((s) => s.setDraft);
  const setReply = useDesk((s) => s.setReply);
  const toggleOrientation = useDesk((s) => s.toggleOrientation);
  const pushNotice = useDesk((s) => s.pushNotice);

  const visible =
    filter === "all" ? stream.messages : stream.messages.filter((message) => isSignal(message, keywords));
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const vertical = stream.orientation === "vertical";

  useEffect(() => {
    const el = scroller.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [visible.length, pinned, stream.id]);

  return (
    <section className={`${vertical ? "accent-v" : "accent-h"} stream-panel rounded-2xl`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink/70 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="live-dot size-2.5 shrink-0 rounded-full bg-live" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 truncate text-sm font-semibold" title={stream.title}>
              {vertical ? (
                <Smartphone className="size-3.5 shrink-0 text-hot" aria-hidden="true" />
              ) : (
                <Monitor className="size-3.5 shrink-0 text-signal" aria-hidden="true" />
              )}
              {stream.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-faint">
              <span className="truncate">ID {stream.id}</span>
              <Uptime started={stream.startedAt} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 rounded-lg bg-midnight/70 px-3 py-1.5 ring-1 ring-line">
            <span className="text-center">
              <span className="block font-mono text-xs tracking-wider text-faint">Viewers</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-signal">
                <Eye className="size-3" aria-hidden="true" />
                {formatCount(stream.viewers)}
              </span>
            </span>
            <span className="h-6 w-px bg-line" />
            <span className="text-center">
              <span className="block font-mono text-xs tracking-wider text-faint">Likes</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-hot">
                <ThumbsUp className="size-3" aria-hidden="true" />
                {formatCount(stream.likes)}
              </span>
            </span>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={() => toggleOrientation(stream.id)}
          className="h-8 rounded-md px-2 text-xs font-medium text-muted hover:bg-ink hover:text-fg"
        >
          Mark {vertical ? "horizontal" : "vertical"}
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(stream.id).then(
              () => pushNotice("ok", "Broadcast id copied."),
              () => pushNotice("err", "Couldn’t copy that id."),
            );
          }}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-ink hover:text-fg"
        >
          <Copy className="size-3" aria-hidden="true" />
          Copy id
        </button>
        {mode === "live" && (
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(stream.id)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-ink hover:text-fg"
          >
            <ExternalLink className="size-3" aria-hidden="true" />
            Open
          </a>
        )}
        <span className="ml-auto font-mono text-xs text-faint">Poll {(stream.pollMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={() => {
            const el = scroller.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 48;
            setPinned(atBottom);
          }}
          className="chat-scroll flex h-full min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-2"
        >
          <div className="mt-auto" />
          {stream.chatState === "connecting" && visible.length === 0 && (
            <p className="m-auto text-center font-mono text-xs text-faint">Fetching live chat…</p>
          )}
          {stream.chatState === "closed" && (
            <p className="m-auto max-w-xs text-center text-sm text-live">
              {stream.chatNote ?? "Chat unavailable."}
            </p>
          )}
          {visible.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              keywords={keywords}
              onReply={() => setReply(stream.id, message.author)}
            />
          ))}
        </div>
        {!pinned && (
          <button
            type="button"
            onClick={() => {
              setPinned(true);
              const el = scroller.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
            className="absolute bottom-3 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1 rounded-full bg-neon px-3 text-xs font-semibold text-fg"
          >
            <ArrowDown className="size-3" aria-hidden="true" />
            Latest
          </button>
        )}
      </div>

      <form
        className="border-t border-line bg-ink/80 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void sendChat(stream.id);
        }}
      >
        {stream.replyingTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon ring-1 ring-neon/30">
            <span>
              Replying to <span className="text-fg">@{stream.replyingTo}</span>
            </span>
            <button
              type="button"
              onClick={() => setReply(stream.id, null)}
              className="grid size-8 place-items-center rounded-md hover:text-fg"
              aria-label="Cancel reply"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`chat-${stream.id}`}>
            Message {stream.title}
          </label>
          <input
            id={`chat-${stream.id}`}
            value={draft}
            disabled={sending || stream.chatState === "closed"}
            onChange={(event) => setDraft(stream.id, event.target.value)}
            placeholder={vertical ? "Chat in the vertical stream…" : "Chat in the horizontal stream…"}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-lg bg-midnight px-3 text-sm ring-1 ring-line outline-none placeholder:text-faint focus:ring-neon disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim() || stream.chatState === "closed"}
            className="grid size-11 place-items-center rounded-lg bg-neon text-fg hover:bg-neon/90 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </section>
  );
}

function Uptime({ started }: { started: number }) {
  const now = useDesk((s) => s.now);
  return <span>Up {uptime(started, now)}</span>;
}

function MessageRow({
  message,
  keywords,
  onReply,
}: {
  message: ChatMessage;
  keywords: string[];
  onReply: () => void;
}) {
  if (message.kind === "system") {
    return <p className="py-1 text-center font-mono text-xs text-faint">{message.text}</p>;
  }

  const hit = message.kind === "text" && keywords.some((word) => word.length > 1 && message.text.toLowerCase().includes(word.toLowerCase()));
  const tone =
    message.kind === "super"
      ? "bg-hot/10 ring-1 ring-hot/30"
      : message.kind === "member"
        ? "bg-ok/10 ring-1 ring-ok/25"
        : hit
          ? "bg-neon/10 ring-1 ring-neon/30"
          : "hover:bg-ink";

  return (
    <button
      type="button"
      onClick={onReply}
      className={`rise group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${tone} ${message.pending ? "opacity-60" : ""}`}
    >
      <Avatar name={message.author} url={message.avatarUrl} you={message.you} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className={`truncate text-xs font-semibold ${message.you ? "text-neon" : "text-fg"}`}>
            {message.author}
          </span>
          {message.badges.map((badge) => (
            <BadgeIcon key={badge} badge={badge} />
          ))}
          {message.superAmount && (
            <span className="rounded bg-hot/20 px-1.5 font-mono text-xs text-hot">{message.superAmount}</span>
          )}
          <span className="font-mono text-xs text-faint">{message.pending ? "Sending" : clock(message.at)}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-snug break-words text-fg/90">{message.text}</span>
      </span>
      <Reply className="mt-1 size-3 shrink-0 text-faint opacity-0 group-hover:opacity-100" aria-hidden="true" />
    </button>
  );
}

function BadgeIcon({ badge }: { badge: Badge }) {
  if (badge === "owner") return <Crown className="size-3 text-neon" aria-label="Owner" />;
  if (badge === "mod") return <Wrench className="size-3 text-signal" aria-label="Moderator" />;
  return <Star className="size-3 text-ok" aria-label="Member" />;
}

function Avatar({ name, url, you }: { name: string; url: string | null; you?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (you || !url || failed) {
    return (
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${you ? "bg-neon/40" : toneFor(name)}`}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className="size-7 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-line"
    />
  );
}
