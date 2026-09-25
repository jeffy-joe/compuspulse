import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Isolated ticking label: only this component re-renders each second,
 * never the surrounding poll card.
 */
export function Countdown({
  expiresAt,
  className,
  onExpire,
}: {
  expiresAt: string;
  className?: string;
  onExpire?: () => void;
}) {
  const [label, setLabel] = useState(() => formatRemaining(expiresAt));

  useEffect(() => {
    setLabel(formatRemaining(expiresAt));
    if (new Date(expiresAt).getTime() <= Date.now()) return;

    const id = setInterval(() => {
      const next = formatRemaining(expiresAt);
      setLabel(next);
      if (next === "Poll closed") {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  return (
    <span className={cn("tabular font-mono text-xs", className)} aria-live="off">
      {label}
    </span>
  );
}
