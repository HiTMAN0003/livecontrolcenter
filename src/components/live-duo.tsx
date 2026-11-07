import { useEffect, useState } from "react";

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
  const [activeChat, setActiveChat] = useState<1 | 2>(1); const [slots, setSlots] = useState<Slot[]>([blank(1), blank(2)]);

  useEffect(() => {
    const next = ([1, 2] as const).map((n) => {
      const slot = blank(n);
      slot.id = readStorage(`v${n}`);
      slot.showVideo = readStorage(`h${n}`) !== "0";
      return slot;
    });
    const savedKey = readStorage("ytkey") || "";
    setSlots(next);
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
    <div className={`live-duo${open ? " open" : ""}`}>
      <button
        id="menu"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
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
        {slots.map((slot) => (
          <section className={`pane${slot.showVideo ? "" : " novid"}`} key={slot.n}>
            <div className="hd">
              <strong>Live {slot.n}</strong>
              <span className="st">
                Watching <b className="w">{slot.watching}</b>
              </span>
              <span className="st">
                Likes <b className="l">{slot.likes}</b>
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
<section id="chat-panel" className="pane chat-panel"><div className="chat-hd"><strong>Live chat</strong>{([1,2] as const).map(n=><button key={n} type="button" aria-pressed={activeChat===n} onClick={()=>setActiveChat(n)}>Live {n}</button>)}</div><div className="chat-stack">{slots[activeChat-1].id&&host?<iframe src={"https://www.youtube.com/live_chat?v="+slots[activeChat-1].id+"&embed_domain="+encodeURIComponent(host)+"&dark_theme=1"} title={"Live "+activeChat+" chat"}/>:<div className="empty">Open the menu and paste a link for Live {activeChat}</div>}</div></section></main>
    </div>
  );
}
