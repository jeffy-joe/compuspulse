import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/countdown";
import { LiveDot } from "@/components/brand";
import { PollResults } from "@/components/poll-results";
import { ShareDialog } from "@/components/share-dialog";
import { useAuth } from "@/components/auth-provider";
import { castVote, friendlyError, isClosed, type Poll } from "@/lib/polls";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

export function PollCard({
  poll,
  myOptionIds,
  headingLevel = "h3",
  showQuestionLink = true,
}: {
  poll: Poll;
  myOptionIds?: string[] | undefined;
  headingLevel?: "h2" | "h3" | undefined;
  showQuestionLink?: boolean | undefined;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [expired, setExpired] = useState(() => isClosed(poll));

  const closed = expired || isClosed(poll);
  const hasVoted = (myOptionIds?.length ?? 0) > 0;
  const showResults = closed || hasVoted;
  const Heading = headingLevel;

  const vote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("unauthenticated");
      await castVote(poll.id, selected, user.id);
    },
    onSuccess: () => {
      toast.success("Vote submitted");
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      queryClient.invalidateQueries({ queryKey: ["my-votes"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  function toggle(optionId: string) {
    setSelected((current) => {
      if (poll.multiple_selection) {
        return current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      }
      return current[0] === optionId ? [] : [optionId];
    });
  }

  function submit() {
    if (!user) {
      toast.info("Sign in to cast your vote");
      navigate({ to: "/auth", search: { redirect: `/poll/${poll.id}` } });
      return;
    }
    if (selected.length === 0) {
      toast.info("Pick an option first");
      return;
    }
    vote.mutate();
  }

  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-raised">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-medium">
          {poll.category}
        </Badge>
        {poll.is_global ? (
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/10 text-primary text-[10px] font-semibold"
          >
            Global
          </Badge>
        ) : poll.class_name ? (
          <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
            {poll.class_name}
            {poll.year ? ` • ${poll.year}` : ""}
          </Badge>
        ) : null}
        {closed ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            Poll closed
          </span>
        ) : (
          <LiveDot />
        )}
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {poll.creator_name} · {formatRelative(poll.created_at)}
        </span>
      </div>

      <Heading className="mt-3 text-base font-semibold leading-snug">
        {showQuestionLink ? (
          <Link
            to="/poll/$pollId"
            params={{ pollId: poll.id }}
            className="rounded-sm transition-colors hover:text-primary"
          >
            {poll.question}
          </Link>
        ) : (
          poll.question
        )}
      </Heading>

      <div className="mt-4 flex-1">
        {showResults ? (
          <PollResults poll={poll} myOptionIds={myOptionIds ?? []} />
        ) : (
          <fieldset>
            <legend className="sr-only">
              {poll.multiple_selection ? "Choose one or more options" : "Choose one option"}
            </legend>
            <ul className="space-y-2">
              {poll.poll_options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role={poll.multiple_selection ? "checkbox" : "radio"}
                      aria-checked={active}
                      onClick={() => toggle(option.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "border-primary bg-primary-soft font-medium text-accent-foreground"
                          : "border-border hover:border-input hover:bg-secondary",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center border",
                          poll.multiple_selection ? "rounded-[4px]" : "rounded-full",
                          active ? "border-primary bg-primary" : "border-input",
                        )}
                        aria-hidden
                      >
                        {active ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
                      </span>
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">
          {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
        </span>
        <span aria-hidden>·</span>
        <Countdown expiresAt={poll.expires_at} onExpire={() => setExpired(true)} />
        <div className="ml-auto flex items-center gap-1">
          <ShareDialog pollId={poll.id} question={poll.question} />
          {!showResults ? (
            <Button size="sm" onClick={submit} disabled={vote.isPending}>
              {vote.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Vote
            </Button>
          ) : null}
        </div>
      </div>

      {hasVoted && !closed ? (
        <p className="mt-3 text-xs text-success" role="status">
          Thanks for voting — results update live.
        </p>
      ) : null}
    </article>
  );
}
