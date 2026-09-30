import { ApiError } from "@/lib/api";
import type { ArgusChatRequest, ArgusChatResponse, ArgusStep, ArgusStreamEvent } from "@/data/argus";

/**
 * Ask Argus a question: POST /api/argus/chat, streamed so `onStep` hears about each tool as it runs. Resolves with
 * the answer; failures throw an ApiError (503 when the server has no API key).
 */
export async function sendArgusChat(body: ArgusChatRequest, onStep: (step: ArgusStep) => void, signal?: AbortSignal) {
  const res = await fetch("/api/argus/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(res.status, payload?.error ?? `Ask Argus failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ArgusStreamEvent;
      if (event.type === "step") onStep(event.step);
      else if (event.type === "error") throw new ApiError(event.status, event.error);
      else {
        const { type: _type, ...result } = event;
        return result as ArgusChatResponse;
      }
    }
    if (done) throw new ApiError(502, "Ask Argus's reply was cut off. Try again.");
  }
}
