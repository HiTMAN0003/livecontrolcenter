import { useEffect, useRef, useState } from "react";

type Slot = {
  n: 1 | 2;
  id: string | null;
  showVideo: boolean;
  input: string;
  placeholder: string;
  title: string;
  watching: string;
  likes: string;
};

const API = "https://www.googleapis.com/youtube/v3/";

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function parseId(raw: string) {
  const text = raw.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0]?.slice(0, 11) || null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v.slice(0, 11))) return v.slice(0, 11);
    const match = url.pathname.match(/\/(?:live|shorts|embed|v)\/([\w-]{11})/);
    if (match) return match[1];
  } catch {
    /* not a url */
  }
  return null;
}

function blank(n: 1 | 2): Slot {
  return {
    n,
    id: null,
    showVideo: true,
    input: "",
    placeholder: "Paste YouTube link",
    title: "",
    watching: "–",
    likes: "–",
  };
}

function formatCount(value: string | undefined) {
  if (value == null || value === "") return "–";
  return Number(value).toLocaleString();
}

export function LiveDuo() {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [message, setMessage] = useState("");
  const [visibleSlots, setVisibleSlots] = useState([true, true]);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const menuDrag = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressMenuClick = useRef(false);
  const [slots, setSlots] = useState<Slot[]>([blank(1), blank(2)]);

  useEffect(() => {
    const left = Number(readStorage("menu-left"));
    const top = Number(readStorage("menu-top"));
    if (Number.isFinite(left) && Number.isFinite(top) && readStorage("menu-left") !== null) {
      setMenuPosition({ left: Math.max(0, Math.min(left, window.innerWidth - 90)), top: Math.max(0, Math.min(top, window.innerHeight - 48)) });
    }
    const next = ([1, 2] as const).map((n) => {
      const slot = blank(n);
      slot.id = readStorage(`v${n}`);
      slot.showVideo = readStorage(`h${n}`) !== "0";
      return slot;
    });
    const savedKey = readStorage("ytkey") || "";
    setSlots(next);
    setVisibleSlots(([1, 2] as const).map((n) => readStorage(`p${n}`) !== "0"));
    setApiKey(savedKey);
    setKeyDraft(savedKey);
    setHost(window.location.hostname);
    if (!next.some((slot) => slot.id)) setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancel = false;
    async function stats() {
      if (!apiKey) return;
      const ids = [...new Set(slots.map((slot) => slot.id).filter(Boolean))] as string[];
      if (!ids.length) return;
      try {
        const response = await fetch(
          `${API}videos?part=snippet,statistics,liveStreamingDetails&id=${ids.join(",")}&key=${encodeURIComponent(apiKey)}`,
        );
        const body = (await response.json()) as {
          error?: { message?: string };
          items?: Array<{
            id: string;
            snippet?: { title?: string };
            statistics?: { likeCount?: string };
            liveStreamingDetails?: { concurrentViewers?: string };
          }>;
        };
        if (!response.ok) throw new Error((body.error?.message || String(response.status)).replace(/<[^>]+>/g, ""));
        if (cancel) return;
        setSlots((current) =>
          current.map((slot) => {
            const item = body.items?.find((entry) => entry.id === slot.id);
            return {
              ...slot,
              watching: formatCount(item?.liveStreamingDetails?.concurrentViewers),
              likes: formatCount(item?.statistics?.likeCount),
              title: item?.snippet?.title ?? "",
            };
          }),
        );
        setMessage("");
      } catch (error) {
        if (!cancel) setMessage(`Counts error: ${error instanceof Error ? error.message : "Request failed"}`);
      }
    }
    void stats();
    const timer = window.setInterval(() => void stats(), 20_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [apiKey, slots.map((slot) => slot.id).join("|")]);

  function play(index: number) {
    const raw = slots[index]?.input ?? "";
    const id = parseId(raw);
    if (!id) {
      setSlots((current) =>
        current.map((slot, i) =>
          i === index ? { ...slot, input: "", placeholder: "That is not a YouTube link" } : slot,
        ),
      );
      return;
    }
    writeStorage(`v${index + 1}`, id);
    setSlots((current) =>
      current.map((slot, i) =>
        i === index
          ? { ...slot, id, input: "", placeholder: "Paste YouTube link", title: "", watching: "–", likes: "–" }
          : slot,
      ),
    );
    setOpen(false);
  }

  function togglePanel(index: number, show: boolean) {
    if (!show && visibleSlots.filter(Boolean).length === 1) return;
    writeStorage(`p${index + 1}`, show ? "1" : "0");
    setVisibleSlots((current) => current.map((visible, i) => (i === index ? show : visible)));
  }

  function toggleVideo(index: number, show: boolean) {
    writeStorage(`h${index + 1}`, show ? "1" : "0");
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, showVideo: show } : slot)));
  }

  function saveKey() {
    const next = keyDraft.trim();
    setApiKey(next);
    writeStorage("ytkey", next);
    setMessage(next ? "Saved." : "Key removed.");
    if (!next) {
      setSlots((current) => current.map((slot) => ({ ...slot, watching: "–", likes: "–" })));
    }
  }

  return (
    <div className={`live-duo${open ? " open" : ""}${visibleSlots.filter(Boolean).length === 1 ? " single" : ""}`}>
      <button
        id="menu"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        title="Drag to move menu"
        style={menuPosition ? { left: menuPosition.left, top: menuPosition.top, right: "auto" } : undefined}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          menuDrag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
          suppressMenuClick.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          setMenuPosition({ left: rect.left, top: rect.top });
        }}
        onPointerMove={(event) => {
          const drag = menuDrag.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
          if (!drag.moved) return;
          const left = Math.max(0, Math.min(event.clientX - drag.offsetX, window.innerWidth - event.currentTarget.offsetWidth));
          const top = Math.max(0, Math.min(event.clientY - drag.offsetY, window.innerHeight - event.currentTarget.offsetHeight));
          setMenuPosition({ left, top });
        }}
        onPointerUp={(event) => {
          const drag = menuDrag.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (drag.moved) {
            const left = Math.max(0, Math.min(event.clientX - drag.offsetX, window.innerWidth - event.currentTarget.offsetWidth));
            const top = Math.max(0, Math.min(event.clientY - drag.offsetY, window.innerHeight - event.currentTarget.offsetHeight));
            setMenuPosition({ left, top });
            writeStorage("menu-left", String(left));
            writeStorage("menu-top", String(top));
            suppressMenuClick.current = true;
          }
          menuDrag.current = null;
        }}
        onPointerCancel={() => { menuDrag.current = null; }}
        onClick={() => {
          if (suppressMenuClick.current) { suppressMenuClick.current = false; return; }
          setOpen((current) => !current);
        }}
      >
        {open ? "× Close" : "☰ Menu"}
      </button>
      <div id="scrim" onClick={() => setOpen(false)} />

      <aside id="side" aria-label="Menu">
        <h1>
          Live <span>Duo</span>
        </h1>
        {slots.map((slot, index) => (
          <section className="lv" key={slot.n}>
            <h2>Live {slot.n}</h2>
            <div className="row">
              <input
                type="text"
                placeholder={slot.placeholder}
                inputMode="url"
                autoComplete="off"
                aria-label={`Live ${slot.n} link`}
                value={slot.input}
                onChange={(event) =>
                  setSlots((current) =>
                    current.map((item, i) => (i === index ? { ...item, input: event.target.value } : item)),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") play(index);
                }}
              />
              <button className="btn go" type="button" onClick={() => play(index)}>
                Play
              </button>
            </div>
            <label className="chk">
              <input
                type="checkbox"
                className="sv"
                checked={slot.showVideo}
                onChange={(event) => toggleVideo(index, event.target.checked)}
              />
              Show video
            </label>
            <label className="chk">
              <input type="checkbox" checked={visibleSlots[index]} disabled={visibleSlots[index] && visibleSlots.filter(Boolean).length === 1} onChange={(event) => togglePanel(index, event.target.checked)} />
              Show Live {slot.n} panel
            </label>
          </section>
        ))}

        <section className="keybox">
          <h2>Counts</h2>
          <p>Watching and likes need a free YouTube API key. Without one they stay at –. Video and chat work either way.</p>
          <div className="row">
            <input
              type="password"
              id="key"
              placeholder="API key (optional)"
              autoComplete="off"
              spellCheck={false}
              aria-label="YouTube API key"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            <button className="btn ghost" id="savekey" type="button" onClick={saveKey}>
              Save
            </button>
          </div>
          <div className="msg" id="msg">
            {message}
          </div>
        </section>
      </aside>

      <main id="grid">
        {slots.filter((_, index) => visibleSlots[index]).map((slot) => (
          <section className={`pane live-${slot.n}${slot.showVideo ? "" : " novid"}`} key={slot.n}>
            <div className="hd">
              <strong>Live {slot.n}</strong>
              <span className="st">
                W <b className="w">{slot.watching}</b>
              </span>
              <span className="st">
                L <b className="l">{slot.likes}</b>
              </span>
              <em className="ttl">{slot.title}</em>
            </div>
            <div className="vid">
              {slot.showVideo && slot.id ? (
                <iframe
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={`https://www.youtube.com/embed/${slot.id}?autoplay=1&mute=1&playsinline=1&rel=0`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={`Live ${slot.n} video`}
                />
              ) : null}
            </div>
            <div className="chat">
              {slot.id && host ? (
                <iframe
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={`https://www.youtube.com/live_chat?v=${slot.id}&embed_domain=${encodeURIComponent(host)}&dark_theme=1`}
                  title={`Live ${slot.n} chat`}
                />
              ) : (
                <div className="empty">Open the menu and paste a link for Live {slot.n}</div>
              )}
            </div>
          </section>
        ))}
</main>
    </div>
  );
}
