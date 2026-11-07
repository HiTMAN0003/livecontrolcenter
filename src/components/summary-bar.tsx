import { useEffect, useRef, useState, type ReactNode } from "react";
import { Area, AreaChart, Tooltip } from "recharts";
import { Eye, RefreshCw, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { refreshDesk } from "@/lib/desk-engine";
import { formatCount } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function SummaryBar() {
  const streams = useDesk((s) => s.streams);
  const history = useDesk((s) => s.history);
  const now = useDesk((s) => s.now);
  const filter = useDesk((s) => s.filter);
  const setFilter = useDesk((s) => s.setFilter);
  const sound = useDesk((s) => s.sound);
  const toggleSound = useDesk((s) => s.toggleSound);
  const events = useDesk((s) => s.events);
  const keywords = useDesk((s) => s.keywords);
  const keywordDraft = useDesk((s) => s.keywordDraft);
  const setKeywordDraft = useDesk((s) => s.setKeywordDraft);
  const commitKeywords = useDesk((s) => s.commitKeywords);

  const viewers = streams.reduce((n, s) => n + (s.viewers ?? 0), 0);
  const likes = streams.reduce((n, s) => n + (s.likes ?? 0), 0);
  const rate = streams.reduce(
    (n, s) => n + s.messages.filter((m) => m.kind !== "system" && now - m.at < 60_000).length,
    0,
  );
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="glass shrink-0 rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold">
          {streams.length} live {streams.length === 1 ? "broadcast" : "broadcasts"}
        </h2>
        <Stat icon={<Eye className="size-3.5" />} label="Viewers" value={formatCount(viewers)} tone="text-signal" />
        <Stat icon={<ThumbsUp className="size-3.5" />} label="Likes" value={formatCount(likes)} tone="text-hot" />
        <Stat icon={null} label="Chat / min" value={String(rate)} tone="text-fg" />
        <button
          type="button"
          onClick={toggleSound}
          className="grid size-11 place-items-center rounded-lg bg-ink text-muted ring-1 ring-line hover:text-fg"
          aria-pressed={sound}
          aria-label={sound ? "Mute signal chime" : "Play a chime on signals"}
        >
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => void refreshDesk()}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold ring-1 ring-line hover:ring-neon/50"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div ref={box} className="h-10 min-w-0 flex-1">
          {width > 0 && history.length > 1 ? (
            <AreaChart width={width} height={40} data={history}>
              <Tooltip
                contentStyle={{
                  background: "var(--color-ink)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 8,
                  color: "var(--color-fg)",
                  fontSize: 12,
                }}
                labelFormatter={() => "Viewers"}
                formatter={(value) => [formatCount(Number(value)), "Watching"]}
              />
              <Area
                type="monotone"
                dataKey="viewers"
                stroke="var(--color-signal)"
                fill="var(--color-signal)"
                fillOpacity={0.18}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <p className="pt-2 text-sm text-muted">Pulse fills in as viewer polls land.</p>
          )}
        </div>
        <form
          className="flex w-full items-center gap-2 lg:w-80"
          onSubmit={(event) => {
            event.preventDefault();
            commitKeywords();
          }}
        >
          <label className="sr-only" htmlFor="ping-words">
            Ping words
          </label>
          <input
            id="ping-words"
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            placeholder="Ping words: raid, discord"
            className="h-11 min-w-0 flex-1 rounded-lg bg-ink px-3 text-sm ring-1 ring-line outline-none placeholder:text-faint focus:ring-neon"
          />
          <button
            type="submit"
            className="h-11 rounded-lg bg-ink px-3 text-sm font-semibold ring-1 ring-line hover:ring-neon/50"
          >
            Save
          </button>
        </form>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          All chat
        </FilterButton>
        <FilterButton active={filter === "signals"} onClick={() => setFilter("signals")}>
          Signals
        </FilterButton>
        <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {events.length === 0 && (
            <li className="truncate text-sm text-muted">
              Waiting for supers, spikes{keywords.length ? `, “${keywords.join("”, “")}”` : ""}.
            </li>
          )}
          {events.map((event) => (
            <li key={event.id} className="max-w-64 shrink-0 truncate rounded-lg bg-ink px-3 py-1.5 text-sm ring-1 ring-line">
              <span className="text-muted">{event.streamTitle.split("—")[0]?.trim()} · </span>
              {event.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-ink px-3 py-1.5 ring-1 ring-line">
      <p className="font-mono text-xs tracking-wider text-faint">{label}</p>
      <p className={`flex items-center gap-1 text-sm font-semibold ${tone}`}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-11 rounded-lg bg-neon/20 px-3 text-sm font-semibold text-neon ring-1 ring-neon/40"
          : "h-11 rounded-lg bg-ink px-3 text-sm font-semibold text-muted ring-1 ring-line hover:text-fg"
      }
    >
      {children}
    </button>
  );
}
