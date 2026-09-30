import * as React from "react";
import type { ArgusProposal, ArgusStep } from "@/data/argus";

// Ask Argus's shared state (ArgusProvider holds it), kept apart from the provider component so fast refresh
// doesn't recreate the context while editing it.

export type ProposalState =
  | { status: "pending" }
  | { status: "applying" }
  | { status: "applied" }
  | { status: "dismissed" }
  | { status: "error"; error: string };

export type ArgusEntry =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; steps: ArgusStep[]; proposals: (ArgusProposal & { state: ProposalState })[] };

/** The request in flight, or the last one's failure (shown inline with Retry). */
export type ArgusPending =
  | { status: "idle" }
  | { status: "loading"; steps: ArgusStep[] }
  | { status: "error"; error: string; notSetUp: boolean };

export type ArgusContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  entries: ArgusEntry[];
  pending: ArgusPending;
  send: (text: string) => void;
  retry: () => void;
  newChat: () => void;
  setProposalState: (proposalId: string, state: ProposalState) => void;
};

export const ArgusContext = React.createContext<ArgusContextValue | null>(null);

/** Ask Argus's open state and conversation; inside ArgusProvider (the Layout). */
export function useArgus() {
  const value = React.useContext(ArgusContext);
  if (!value) throw new Error("useArgus must be used inside ArgusProvider");
  return value;
}
