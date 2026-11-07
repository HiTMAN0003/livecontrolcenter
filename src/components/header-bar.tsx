import { useEffect, useRef, useState } from "react";
import { LogOut, Radio, Sparkles } from "lucide-react";
import { disconnect, enterDemo } from "@/lib/desk-engine";
import { useDesk } from "@/lib/desk-store";

const MOBILE_HEADER = "(max-width: 63.999rem)";

export function HeaderBar() {
  const phase = useDesk((s) => s.phase);
  const mode = useDesk((s) => s.mode);
  const identity = useDesk((s) => s.identity);
  const setConnectOpen = useDesk((s) => s.setConnectOpen);
  const shellRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const shell = shellRef.current;
    const bar = barRef.current;
    if (!shell || !bar) return;
    const measure = () => {
      shell.style.setProperty("--app-header-h", `${bar.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_HEADER);
    let last = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        last = y;
        if (!query.matches || y <= 4) {
          setHidden(false);
          return;
        }
        if (delta > 8) setHidden(true);
        else if (delta < -8) setHidden(false);
      });
    };

    const onChange = () => {
      last = window.scrollY;
      if (!query.matches) setHidden(false);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    query.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      query.removeEventListener("change", onChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={shellRef} className={`app-header-shell ${hidden ? "is-hidden" : ""}`}>
      <header
        ref={barRef}
        className="app-header glass border-b border-line"
        inert={hidden}
        aria-hidden={hidden || undefined}
      >
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="mark grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold text-fg">
            M
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-wide">
              Midnight<span className="text-neon">OG</span>
            </p>
          </div>
          <span className="hidden font-mono text-xs tracking-widest text-faint sm:inline">LIVE DESK</span>
          {mode === "demo" && phase === "desk" && (
            <span className="rounded-full bg-neon/15 px-2 py-0.5 font-mono text-xs text-neon">Simulated</span>
          )}
          {mode === "live" && (
            <span className="rounded-full bg-ok/15 px-2 py-0.5 font-mono text-xs text-ok">YouTube</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === "live" && identity && (
            <div className="mr-1 hidden items-center gap-2 sm:flex">
              <Avatar name={identity.name} url={identity.avatarUrl} />
              <div className="text-right">
                <p className="max-w-40 truncate text-sm font-semibold">{identity.name}</p>
                <p className="flex items-center justify-end gap-1 text-xs text-ok">
                  <span className="size-1.5 rounded-full bg-ok" />
                  Connected
                </p>
              </div>
            </div>
          )}

          {mode !== "live" && (
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold ring-1 ring-line hover:ring-neon/60"
            >
              <Radio className="size-4 text-hot" aria-hidden="true" />
              <span className="hidden sm:inline">Connect YouTube</span>
              <span className="sm:hidden">Connect</span>
            </button>
          )}

          {mode === "demo" || phase === "idle" || phase === "empty" ? (
            mode === "demo" ? (
              <button
                type="button"
                onClick={disconnect}
                className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-ink hover:text-fg"
                aria-label="Leave demo"
              >
                <LogOut className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={enterDemo}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-neon/20 px-3 text-sm font-semibold text-neon ring-1 ring-neon/40 hover:bg-neon/30"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Demo
              </button>
            )
          ) : null}

          {mode === "live" && (
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-ink hover:text-fg"
              aria-label="Disconnect YouTube"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>
      </header>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (!url) {
    return (
      <span className="grid size-9 place-items-center rounded-full bg-neon/30 text-sm font-semibold text-fg">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="size-9 rounded-full object-cover outline outline-1 -outline-offset-1 outline-line"
    />
  );
}
