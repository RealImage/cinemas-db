import * as React from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api";
import { sendArgusChat } from "@/hooks/api/argus";
import { ARGUS_LIMITS, type ArgusMessage } from "@/data/argus";
import { ArgusContext, type ArgusEntry, type ArgusPending, type ProposalState } from "./argusState";

const STORAGE_KEY = "argus.conversation";

/** The session's conversation; storage can be unavailable (private mode, blocked site data). */
function loadEntries(): ArgusEntry[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    // A save interrupted by a reload may or may not have happened; the card offers it again
    return (saved as ArgusEntry[]).map((e) => (e.role !== "assistant" ? e : {
      ...e, proposals: e.proposals.map((p) => (p.state.status === "applying" ? { ...p, state: { status: "pending" } } : p)),
    }));
  } catch {
    return [];
  }
}

function saveEntries(entries: ArgusEntry[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Not persisted: the conversation still lasts while the page is open
  }
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "(empty)" : JSON.stringify(v));

/**
 * The plain-text transcript the server gets: the latest messages (within its limits), each reply noting its
 * proposals and what the user did with them, so a follow-up like "apply it" or "why did that fail" makes sense.
 */
function transcript(entries: ArgusEntry[]): ArgusMessage[] {
  const messages = entries.map((e): ArgusMessage => {
    if (e.role === "user") return { role: "user", content: e.content };
    const notes = e.proposals.map((p) => {
      const outcome = { pending: "not applied yet", applying: "being applied", applied: "applied by the user", dismissed: "cancelled by the user",
        error: `failed to apply: ${p.state.status === "error" ? p.state.error : ""}` }[p.state.status];
      return `[Proposed update to ${p.kind} ${p.targetName}: ${p.changes.map((c) => `${c.label} ${show(c.from)} → ${show(c.to)}`).join("; ")} (${outcome})]`;
    });
    return { role: "assistant", content: [e.content, ...notes].join("\n") };
  });
  return messages.slice(-ARGUS_LIMITS.messages).map((m) => ({ ...m, content: m.content.slice(0, ARGUS_LIMITS.chars) }));
}

const isEditable = (el: EventTarget | null) => el instanceof HTMLElement && el.isContentEditable;

/** Ask Argus's open state and conversation, for the header button (toggle) and the panel. */
export function ArgusProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<ArgusEntry[]>(loadEntries);
  // A question left unanswered by a reload gets Retry
  const [pending, setPending] = React.useState<ArgusPending>(() => (entries[entries.length - 1]?.role === "user"
    ? { status: "error", error: "This question wasn't answered.", notSetUp: false }
    : { status: "idle" }));
  const abort = React.useRef<AbortController | null>(null);
  const location = useLocation();
  const isMobile = useIsMobile();

  React.useEffect(() => saveEntries(entries), [entries]);

  // On a phone the panel covers the page, so following one of its links shows the page
  React.useEffect(() => {
    if (isMobile) setOpen(false);
  }, [location.pathname, isMobile]);

  const toggle = React.useCallback(() => setOpen((o) => !o), []);

  // ⌘I / Ctrl+I toggles the panel (except in rich-text fields, where it's italic)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "i" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || isEditable(e.target)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const pathname = location.pathname;
  const ask = React.useCallback(async (history: ArgusEntry[]) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setPending({ status: "loading", steps: [] });
    try {
      const result = await sendArgusChat(
        { messages: transcript(history), path: pathname },
        (step) => setPending((p) => (p.status === "loading" ? { ...p, steps: [...p.steps, step] } : p)),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setEntries((list) => [...list, {
        id: newId(), role: "assistant", content: result.reply, steps: result.steps,
        proposals: result.proposals.map((p) => ({ ...p, state: { status: "pending" } })),
      }]);
      setPending({ status: "idle" });
    } catch (err) {
      if (controller.signal.aborted) return;
      setPending({
        status: "error",
        error: err instanceof Error ? err.message : "Ask Argus failed",
        notSetUp: err instanceof ApiError && err.status === 503,
      });
    }
  }, [pathname]);

  const send = React.useCallback((text: string) => {
    const content = text.trim().slice(0, ARGUS_LIMITS.chars);
    if (!content || pending.status === "loading") return;
    const next = [...entries, { id: newId(), role: "user" as const, content }];
    setEntries(next);
    void ask(next);
  }, [entries, pending.status, ask]);

  const retry = React.useCallback(() => {
    if (entries.length) void ask(entries);
  }, [entries, ask]);

  const newChat = React.useCallback(() => {
    abort.current?.abort();
    setEntries([]);
    setPending({ status: "idle" });
  }, []);

  const setProposalState = React.useCallback((proposalId: string, state: ProposalState) => {
    setEntries((list) => list.map((e) => (e.role !== "assistant" || !e.proposals.some((p) => p.id === proposalId) ? e : {
      ...e, proposals: e.proposals.map((p) => (p.id === proposalId ? { ...p, state } : p)),
    })));
  }, []);

  const value = React.useMemo(
    () => ({ open, setOpen, toggle, entries, pending, send, retry, newChat, setProposalState }),
    [open, toggle, entries, pending, send, retry, newChat, setProposalState],
  );
  return <ArgusContext.Provider value={value}>{children}</ArgusContext.Provider>;
}
