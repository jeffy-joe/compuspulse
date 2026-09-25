import { Trophy } from "lucide-react";
import type { Poll } from "@/lib/polls";
import { percentage } from "@/lib/polls";
import { cn } from "@/lib/utils";

export function PollResults({
  poll,
  myOptionIds = [],
}: {
  poll: Poll;
  myOptionIds?: string[];
}) {
  const total = poll.total_votes;
  const leader = poll.poll_options.reduce(
    (best, option) => (option.votes_count > (best?.votes_count ?? -1) ? option : best),
    poll.poll_options[0],
  );

  return (
    <ul className="space-y-3">
      {poll.poll_options.map((option) => {
        const pct = percentage(option.votes_count, total);
        const isLeader = total > 0 && option.id === leader?.id;
        const isMine = myOptionIds.includes(option.id);

        return (
          <li key={option.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                {isLeader ? (
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Leading option" />
                ) : null}
                <span className="truncate">{option.label}</span>
                {isMine ? (
                  <span className="shrink-0 text-xs font-semibold text-primary">· your vote</span>
                ) : null}
              </span>
              <span className="tabular shrink-0 text-xs text-muted-foreground">
                {option.votes_count} {option.votes_count === 1 ? "vote" : "votes"} ·{" "}
                <span className="font-semibold text-foreground">{pct}%</span>
              </span>
            </div>
            <div
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`${option.label}: ${pct} percent, ${option.votes_count} votes`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  isLeader ? "bg-primary" : "bg-primary/45",
                )}
                style={{ width: `${total === 0 ? 0 : Math.max(pct, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
