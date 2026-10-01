import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { SyncStatusValue } from "@/data/syncStatus";

const STATUS_VARIANT: Record<SyncStatusValue | "Disabled", BadgeProps["variant"]> = {
  Success: "positive",
  Partial: "notice",
  Failed: "negative",
  Running: "product",
  Never: "secondary",
  Disabled: "secondary",
};

/** A sync source's or run's status. */
export const SyncStatusBadge = ({ status }: { status: SyncStatusValue | "Disabled" }) => (
  <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
);
