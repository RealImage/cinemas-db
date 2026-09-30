import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ask Argus's logo: an eye whose iris is an AI sparkle, with a small sparkle at its corner. Drawn like the lucide
 * icons (24×24, currentColor, 2px strokes), so it sizes and colours with them (e.g. h-4 w-4).
 */
export const ArgusIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={cn("h-4 w-4", className)}
    {...props}
  >
    {/* lucide's eye, its upper lid left open at the corner for the sparkle */}
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 16.44-4.46" />
    <path d="M21.938 11.652a1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <path d="M12 9l.9 2.1L15 12l-2.1.9L12 15l-.9-2.1L9 12l2.1-.9z" fill="currentColor" strokeWidth={1.5} />
    <path d="M20 2v4M18 4h4" />
  </svg>
);
