import { Radio, RefreshCw, Satellite, Sparkles } from "lucide-react";
import { enterDemo, refreshDesk } from "@/lib/desk-engine";
import { useDesk } from "@/lib/desk-store";

export function Landing() {
  const setConnectOpen = useDesk((s) => s.setConnectOpen);
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-2 py-8 text-center">
      <Satellite className="mb-4 size-12 text-muted" aria-hidden="true" />
      <p className="font-mono text-xs tracking-widest text-faint">AWAITING SIGNAL</p>
      <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
        The night desk is dark.
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
        Connect the channel that is actually live, or open a simulated dual broadcast — landscape and
        portrait — and work both chats from one surface.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={enterDemo}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-neon px-5 text-sm font-semibold text-fg hover:bg-neon/90"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Open demo desk
        </button>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold ring-1 ring-line hover:ring-neon/50"
        >
          <Radio className="size-4 text-hot" aria-hidden="true" />
          Connect YouTube
        </button>
      </div>
      <ul className="mt-10 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[
          ["Both orientations", "Horizontal and vertical broadcasts sit side by side."],
          ["Live pulse", "Viewers, likes, and chat rate on one strip."],
          ["Reply in place", "Answer either chat without leaving the desk."],
        ].map(([title, body]) => (
          <li key={title} className="glass rounded-xl p-4">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LoadingState() {
  const label = useDesk((s) => s.loadingLabel);
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-line border-t-neon" />
      <h1 className="mt-4 text-lg font-semibold text-muted">{label}</h1>
    </section>
  );
}

export function EmptyState() {
  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <div className="glass w-full max-w-lg rounded-2xl p-10 text-center">
        <Radio className="mx-auto size-10 text-faint" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">No active broadcasts</h1>
        <p className="mt-2 text-sm text-muted">
          YouTube Studio has nothing in the live state. Start the horizontal and the vertical, then refresh
          the desk.
        </p>
        <button
          type="button"
          onClick={() => void refreshDesk()}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold ring-1 ring-line hover:ring-neon/50"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh status
        </button>
      </div>
    </section>
  );
}
