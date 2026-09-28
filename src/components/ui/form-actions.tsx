import * as React from "react";
import { ACTION_BUTTONS } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The Save / Cancel row of a form page; its buttons share the action button width. */
export const FormActions = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center justify-end gap-2", ACTION_BUTTONS, className)} {...props} />
);
