import { useEffect } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { ConnectDialog } from "@/components/connect-dialog";
import { HeaderBar } from "@/components/header-bar";
import { EmptyState, Landing, LoadingState } from "@/components/landing";
import { StreamPanel } from "@/components/stream-panel";
import { SummaryBar } from "@/components/summary-bar";
import { boot, halt } from "@/lib/desk-engine";
import { useDesk } from "@/lib/desk-store";

export function DeskApp() {
  const phase = useDesk((s) => s.phase);
  const streams = useDesk((s) => s.streams);
  const notices = useDesk((s) => s.notices);
  const dismissNotice = useDesk((s) => s.dismissNotice);

  useEffect(() => {
    boot();
    return () => halt();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <HeaderBar />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-3 sm:px-6 lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:overflow-hidden">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 ${
              notice.tone === "err"
                ? "bg-live/15 text-fg ring-live/40"
                : notice.tone === "ok"
                  ? "bg-ok/15 text-fg ring-ok/40"
                  : "bg-signal/15 text-fg ring-signal/40"
            }`}
          >
            {notice.tone === "err" ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-live" aria-hidden="true" />
            ) : notice.tone === "ok" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden="true" />
            )}
            <p className="flex-1">{notice.text}</p>
            <button
              type="button"
              onClick={() => dismissNotice(notice.id)}
              className="grid size-8 place-items-center rounded-md hover:bg-midnight/40"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {phase === "idle" && <Landing />}
        {phase === "loading" && <LoadingState />}
        {phase === "empty" && <EmptyState />}
        {phase === "desk" && (
          <>
            <SummaryBar />
            <div
              className={
                streams.length === 1
                  ? "mx-auto grid min-h-0 w-full max-w-3xl flex-1 gap-3"
                  : "grid min-h-[26rem] flex-1 gap-3 lg:min-h-0 lg:grid-cols-2"
              }
            >
              {streams.map((stream) => (
                <StreamPanel key={stream.id} id={stream.id} />
              ))}
            </div>
          </>
        )}
      </main>
      <ConnectDialog />
    </div>
  );
}
