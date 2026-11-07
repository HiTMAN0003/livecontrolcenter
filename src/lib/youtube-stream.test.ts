import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { takeJsonObjects, watchChatStream, YouTubeError } from "./youtube.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(chunks: string[], status = 200) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function message(id: string, text: string) {
  return {
    kind: "youtube#liveChatMessageListResponse",
    nextPageToken: `page-${id}`,
    pollingIntervalMillis: 5000,
    items: [
      {
        id,
        snippet: {
          type: "textMessageEvent",
          displayMessage: text,
          publishedAt: "2026-10-26T04:30:00Z",
        },
        authorDetails: { displayName: text.split(" ")[0], isChatOwner: false },
      },
    ],
  };
}

test("takeJsonObjects keeps a partial object and ignores braces inside strings", () => {
  const raw = `${JSON.stringify({ note: "brace } here" })}{"next":`;
  const pulled = takeJsonObjects(raw);
  assert.equal(pulled.objects.length, 1);
  assert.equal((pulled.objects[0] as { note: string }).note, "brace } here");
  assert.equal(pulled.rest, '{"next":');
});

test("both live chats stream independently and resume with pageToken", async () => {
  const calls: Array<{ chat: string; page: string | null; auth: string | null }> = [];
  const seen: Record<string, string[]> = { horizontal: [], vertical: [] };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/youtube/v3/liveChat/messages/stream");
    assert.equal(url.searchParams.has("access_token"), false);
    const chat = url.searchParams.get("liveChatId") ?? "";
    const page = url.searchParams.get("pageToken");
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ chat, page, auth });
    assert.equal(auth, "Bearer test-token");
    if (!page) {
      const id = chat === "chat-h" ? "h1" : "v1";
      const text = chat === "chat-h" ? "landscape hello" : "portrait hello";
      const body = JSON.stringify(message(id, text));
      return jsonResponse([body.slice(0, 24), body.slice(24)]);
    }
    const id = chat === "chat-h" ? "h2" : "v2";
    const text = chat === "chat-h" ? "landscape again" : "portrait again";
    return jsonResponse([JSON.stringify(message(id, text))]);
  }) as typeof fetch;

  const stop = new AbortController();
  const watch = async (chatId: string, bucket: string) => {
    for await (const page of watchChatStream("test-token", chatId, stop.signal)) {
      seen[bucket].push(...page.messages.map((item) => item.text));
      if (seen[bucket].length >= 2) return;
    }
  };

  await Promise.all([watch("chat-h", "horizontal"), watch("chat-v", "vertical")]);
  stop.abort();

  assert.deepEqual(seen.horizontal, ["landscape hello", "landscape again"]);
  assert.deepEqual(seen.vertical, ["portrait hello", "portrait again"]);
  assert.deepEqual(
    calls.map((call) => `${call.chat}:${call.page ?? ""}`),
    ["chat-h:", "chat-v:", "chat-h:page-h1", "chat-v:page-v1"],
  );
});

test("a quota error stops the stream instead of reconnecting", async () => {
  let hits = 0;
  globalThis.fetch = (async () => {
    hits += 1;
    return new Response(
      JSON.stringify({
        error: {
          message: 'exceeded your <a href="/youtube/data/getting-started#quota">quota</a>',
          errors: [{ reason: "quotaExceeded" }],
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const stop = new AbortController();
  await assert.rejects(
    async () => {
      for await (const _page of watchChatStream("test-token", "chat-h", stop.signal)) {
        void _page;
      }
    },
    (error: unknown) => {
      assert.ok(error instanceof YouTubeError);
      assert.equal(error.reason, "quotaExceeded");
      assert.equal(error.message.includes("<a"), false);
      return true;
    },
  );
  assert.equal(hits, 1);
});
