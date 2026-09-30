/**
 * Ask Argus, the AI chat panel: the request / response shapes of POST /api/argus/chat, shared by the panel
 * (src/components/argus) and the server (server/routes/argus.ts).
 */

export type ArgusRole = "user" | "assistant";

/** One turn of the plain-text transcript the panel keeps and sends back each time. */
export type ArgusMessage = { role: ArgusRole; content: string };

/** A tool Argus ran while answering, e.g. { tool: "search_theatres", label: "Searching theatres for “PVR”" }. */
export type ArgusStep = { tool: string; label: string };

export type ArgusProposalKind = "theatre" | "chain";

/** An update Argus suggests. Nothing is written until the user applies it through the entity's own endpoint. */
export type ArgusProposal = {
  id: string;
  kind: ArgusProposalKind;
  targetId: string;
  targetName: string;
  changes: { field: string; label: string; from: unknown; to: unknown }[];
  summary: string;
};

export type ArgusChatRequest = { messages: ArgusMessage[]; path: string };

export type ArgusChatResponse = { reply: string; steps: ArgusStep[]; proposals: ArgusProposal[] };

/** With `Accept: application/x-ndjson` the reply streams as one of these per line, ending with "done" or "error". */
export type ArgusStreamEvent =
  | { type: "step"; step: ArgusStep }
  | ({ type: "done" } & ArgusChatResponse)
  | { type: "error"; status: number; error: string };

/** Request limits; the server answers 400 above them. */
export const ARGUS_LIMITS = { messages: 40, chars: 8000 } as const;

/**
 * Fields Argus may propose changing, with their labels. Simple scalar fields the edit endpoints accept:
 * PUT /api/theatres/:id (a partial update) and PUT /api/chains/:id (the full Basic and Contact Information).
 */
export const ARGUS_EDITABLE_FIELDS = {
  theatre: {
    name: "Theatre name",
    displayName: "Display name",
    type: "Type",
    status: "Status",
    listing: "Listing",
    address: "Address",
    postalCode: "Postal code",
    phoneNumber: "Phone number",
    email: "Email",
    website: "Website",
    notes: "Notes",
    closureDetails: "Closure details",
  },
  chain: {
    name: "Chain name",
    displayName: "Display name",
    postalCode: "Postal code",
    area: "Area",
    headOfficeAddress: "Head office address",
  },
} as const satisfies Record<ArgusProposalKind, Record<string, string>>;
