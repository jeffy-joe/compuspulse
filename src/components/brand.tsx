import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** CampusPulse mark: a ballot square with a pulse line running through it. */
export function PulseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="CampusPulse"
      className={cn("h-7 w-7", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8.5" className="fill-primary" />
      <path
        d="M6.5 17.5h4.2l2.6-6.4 3.6 11.2 2.6-6.6 1.6 1.8h4.4"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2 rounded-md", className)}>
      <PulseMark />
      <span className="font-display text-[17px] font-extrabold tracking-tight">CampusPulse</span>
    </Link>
  );
}

export function LiveDot({ label = "Live", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold text-success",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {label}
    </span>
  );
}
