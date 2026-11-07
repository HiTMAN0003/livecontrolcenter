import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { connectWithToken } from "@/lib/desk-engine";
import { useDesk } from "@/lib/desk-store";

export function ConnectDialog() {
  const open = useDesk((s) => s.connectOpen);
  const connecting = useDesk((s) => s.connecting);
  const error = useDesk((s) => s.connectError);
  const setOpen = useDesk((s) => s.setConnectOpen);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-midnight/80 p-4 sm:place-items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-faint">CHANNEL</p>
            <h2 id="connect-title" className="text-xl font-semibold">
              Connect YouTube
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-11 place-items-center rounded-lg text-muted hover:bg-ink hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          The desk reads your active broadcasts with a YouTube access token. It stays in this browser tab —
          nothing is sent to a MidnightOG server.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            Open the{" "}
            <a
              className="text-signal underline decoration-signal/40 underline-offset-2"
              href="https://developers.google.com/oauthplayground/"
              target="_blank"
              rel="noreferrer"
            >
              OAuth 2.0 Playground
            </a>
            .
          </li>
          <li>
            Choose YouTube Data API v3 and the scope{" "}
            <span className="font-mono text-xs text-fg">https://www.googleapis.com/auth/youtube</span>.
          </li>
          <li>Authorize, exchange the code, and copy the access token.</li>
          <li>Paste it below. Tokens usually last about an hour.</li>
        </ol>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = inputRef.current?.value ?? "";
            void connectWithToken(value);
          }}
        >
          <label className="block text-sm font-medium" htmlFor="yt-token">
            Access token
          </label>
          <textarea
            id="yt-token"
            ref={inputRef}
            rows={4}
            spellCheck={false}
            autoComplete="off"
            placeholder="ya29…"
            className="w-full resize-none rounded-lg bg-ink px-3 py-2 font-mono text-sm text-fg ring-1 ring-line outline-none placeholder:text-faint focus:ring-neon"
          />
          {error && <p className="text-sm text-live">{error}</p>}
          <button
            type="submit"
            disabled={connecting}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-neon px-4 text-sm font-semibold text-fg hover:bg-neon/90 disabled:opacity-60"
          >
            {connecting ? "Checking broadcasts…" : "Attach channel"}
          </button>
        </form>
      </div>
    </div>
  );
}
