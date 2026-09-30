import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, ArrowUp, Check, ChevronRight, Loader2, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { common } from "@/i18n/common";
import type { ArgusStep } from "@/data/argus";
import { ArgusIcon } from "./ArgusIcon";
import { ArgusMarkdown } from "./ArgusMarkdown";
import { ArgusProposalCard } from "./ArgusProposalCard";
import { useArgus, type ArgusEntry } from "./argusState";

export const ARGUS_PANEL_ID = "argus-panel";
export const ARGUS_TOGGLE_ID = "argus-toggle";
const PANEL_WIDTH = 420;

/** Example questions for the empty state, on the seeded data. */
const EXAMPLES = [
  "How many active theatres are there in India?",
  "Which chains have the most theatres?",
  "Show PVR theatres in Mumbai",
  "What screens and devices does PVR Crown Casino have?",
  "Find GDC playback server models",
  "Set the display name of PVR Crown Casino to PVR Crown Casino Chicago",
];

/**
 * Ask Argus, docked on the right like GitHub's Copilot chat: on desktop a full-height column beside the page that
 * pushes it narrower, on a phone a full-screen sheet.
 */
export function ArgusPanel() {
  const { open, setOpen } = useArgus();
  const isMobile = useIsMobile();

  const close = React.useCallback(() => {
    setOpen(false);
    document.getElementById(ARGUS_TOGGLE_ID)?.focus();
  }, [setOpen]);

  // On desktop the page stays usable beside the panel, so Escape closes it wherever focus is, unless it's closing
  // something else first (a dialog, menu or popover handles Escape itself and marks the event handled)
  React.useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [data-radix-popper-content-wrapper]')) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isMobile, close]);

  if (isMobile) {
    // A modal sheet: Radix traps focus, hides the page from assistive technology and closes on Escape
    return (
      <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            id={ARGUS_PANEL_ID}
            aria-describedby={undefined}
            className="fixed inset-0 z-50 bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              document.getElementById(ARGUS_TOGGLE_ID)?.focus();
            }}
          >
            <DialogPrimitive.Title className="sr-only">Ask Argus</DialogPrimitive.Title>
            <ArgusChat onClose={close} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="desktop"
          id={ARGUS_PANEL_ID}
          aria-label="Ask Argus"
          initial={{ width: 0 }}
          animate={{ width: PANEL_WIDTH }}
          exit={{ width: 0 }}
          transition={{ type: "tween", duration: 0.25 }}
          className="sticky top-0 h-screen shrink-0 overflow-hidden border-l border-border bg-card"
        >
          <div className="h-full" style={{ width: PANEL_WIDTH }}>
            <ArgusChat onClose={close} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** The server's not-set-up message without the heading it repeats ("Ask Argus isn't set up yet: add …"). */
const setUpHint = (message: string) => {
  const hint = message.replace(/^Ask Argus isn't set up yet:\s*/i, "");
  return hint.charAt(0).toUpperCase() + hint.slice(1);
};

const IconButton =({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled}>{children}</Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

function ArgusChat({ onClose }: { onClose: () => void }) {
  const { entries, pending, send, retry, newChat } = useArgus();
  const [draft, setDraft] = React.useState("");
  const input = React.useRef<HTMLTextAreaElement>(null);
  const scroller = React.useRef<HTMLDivElement>(null);
  const loading = pending.status === "loading";

  React.useEffect(() => input.current?.focus(), []);

  // Keep the latest message (and progress) in view
  const progress = pending.status === "loading" ? pending.steps.length : pending.status;
  React.useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, progress]);

  // Grow with the text, up to about eight lines
  React.useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const submit = (text = draft) => {
    if (!text.trim() || loading) return;
    send(text);
    setDraft("");
    input.current?.focus();
  };

  const startOver = () => {
    newChat();
    setDraft("");
    input.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <ArgusIcon className="h-5 w-5 text-purple-500" />
        <h2 className="text-sm font-semibold">Ask Argus</h2>
        <Badge variant="violet">AI</Badge>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="New chat" onClick={startOver} disabled={!entries.length && pending.status === "idle"}>
            <SquarePen />
          </IconButton>
          <IconButton label={common.close} onClick={onClose}><X /></IconButton>
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {entries.length === 0 && pending.status === "idle" ? (
          <EmptyState onPick={(text) => submit(text)} />
        ) : (
          <div className="space-y-4">
            {entries.map((e) => <Entry key={e.id} entry={e} />)}
            {pending.status === "loading" && <Progress steps={pending.steps} />}
            {pending.status === "error" && (
              <div role="alert" className={cn("rounded-lg border px-3 py-2 text-sm", pending.notSetUp ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50")}>
                <div className="flex gap-2">
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", pending.notSetUp ? "text-yellow-900" : "text-red-500")} aria-hidden />
                  <div className="min-w-0 space-y-2">
                    {pending.notSetUp && <p className="font-medium">Ask Argus isn't set up yet</p>}
                    <p className={cn(pending.notSetUp && "text-muted-foreground")}>
                      {pending.notSetUp ? setUpHint(pending.error) : pending.error}
                    </p>
                    <Button variant="outline" size="sm" className="min-w-20" onClick={retry}>{common.retry}</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-input bg-card p-1.5 focus-within:border-primary">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about theatres, chains, screens…"
            aria-label="Message Ask Argus"
            maxLength={8000}
            className="max-h-[180px] min-h-[2.125rem] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm leading-5 placeholder:text-grey-300 focus:outline-none"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Send" disabled={!draft.trim() || loading} onClick={() => submit()}>
                <ArrowUp />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send (Enter)</TooltipContent>
          </Tooltip>
        </div>
        <p className="mt-1.5 px-1 text-[11px] leading-4 text-muted-foreground">
          Argus can make mistakes. It never changes data itself: proposed updates are saved only when you choose {common.save}.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-500">
        <ArgusIcon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-semibold">Ask Argus</p>
      <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
        Ask about theatres, chains, screens and devices, or ask me to update a record.
      </p>
      <div className="mt-5 w-full space-y-2 text-left">
        {EXAMPLES.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-grey-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="flex-1">{text}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

const Avatar = () => (
  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
    <ArgusIcon className="h-3.5 w-3.5" />
  </div>
);

function Entry({ entry }: { entry: ArgusEntry }) {
  if (entry.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground [overflow-wrap:anywhere]">
          {entry.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Avatar />
      <div className="min-w-0 flex-1 space-y-2">
        {entry.steps.length > 0 && (
          <details className="group text-xs text-muted-foreground">
            <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden />
              Used {entry.steps.length} {entry.steps.length === 1 ? "lookup" : "lookups"}
            </summary>
            <StepList steps={entry.steps} className="mt-1 pl-4" />
          </details>
        )}
        <ArgusMarkdown text={entry.content} />
        {entry.proposals.map((p) => <ArgusProposalCard key={p.id} proposal={p} />)}
      </div>
    </div>
  );
}

const StepList = ({ steps, running, className }: { steps: ArgusStep[]; running?: boolean; className?: string }) => (
  <ul className={cn("space-y-1 text-xs text-muted-foreground", className)}>
    {steps.map((s, i) => {
      const current = running && i === steps.length - 1;
      return (
        <li key={i} className="flex items-center gap-1.5">
          {current ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : <Check className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="[overflow-wrap:anywhere]">{s.label}{current ? "…" : ""}</span>
        </li>
      );
    })}
  </ul>
);

function Progress({ steps }: { steps: ArgusStep[] }) {
  return (
    <div className="flex gap-2">
      <Avatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {steps.length ? <StepList steps={steps} running /> : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />Thinking…
          </p>
        )}
      </div>
    </div>
  );
}
