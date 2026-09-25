import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe, Plus, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PollCard } from "@/components/poll-card";
import { EmptyState, ErrorState, PollListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useMyVotes } from "@/hooks/use-my-votes";
import { usePollRealtime } from "@/hooks/use-poll-realtime";
import { fetchPolls, isClosed } from "@/lib/polls";
import { greeting } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Your campus feed — CampusPulse" },
      {
        name: "description",
        content: "See the polls your campus is voting on right now and add your own voice.",
      },
      { property: "og:title", content: "Your campus feed — CampusPulse" },
      {
        property: "og:description",
        content: "See the polls your campus is voting on right now and add your own voice.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  usePollRealtime();

  const [feed, setFeed] = useState<"all" | "class" | "global">("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "polls",
      {
        feed,
        className: user?.className,
        year: user?.year,
        sort: "recent",
      },
    ],
    queryFn: () =>
      fetchPolls({
        sort: "recent",
        feed: feed === "all" ? undefined : feed,
      }),
  });

  const active = (data ?? []).filter((poll) => !isClosed(poll));
  const recentlyClosed = (data ?? []).filter((poll) => isClosed(poll)).slice(0, 2);
  const myVotes = useMyVotes((data ?? []).map((poll) => poll.id));

  return (
    <AppShell>
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{greeting()}{user ? `, ${user.name.split(" ")[0]}` : ""}</span>
            {user?.role === "admin" ? (
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Administrator
              </span>
            ) : user?.className ? (
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                Class: {user.className}
                {user.year ? ` • ${user.year}` : ""}
              </span>
            ) : null}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">What&apos;s the campus thinking about?</h1>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin" ? (
            <Button asChild variant="outline">
              <Link to="/admin">
                <Sparkles className="h-4 w-4 mr-1.5 text-primary" />
                Admin Portal
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link to="/create">
              <Plus className="h-4 w-4" aria-hidden />
              Create Poll
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="active-polls">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="active-polls"
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Active Polls
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {feed === "all"
                ? "Showing all active polls available to you."
                : feed === "class"
                ? `Showing polls for ${user?.className || "your class"}.`
                : "Showing campus-wide global polls."}
            </p>
          </div>

          {/* Feed Filter Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFeed("all")}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  feed === "all"
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Feed
              </button>
              {user?.className || user?.role === "admin" ? (
                <button
                  type="button"
                  onClick={() => setFeed("class")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1 transition-colors",
                    feed === "class"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="h-3 w-3" />
                  {user?.role === "admin" ? "Class Polls" : user?.className || "My Class"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setFeed("global")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1 transition-colors",
                  feed === "global"
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="h-3 w-3" />
                Campus Global
              </button>
            </div>

            <Link to="/explore" className="text-xs font-medium text-primary hover:underline ml-2">
              Explore all &rarr;
            </Link>
          </div>
        </div>

        {isLoading ? (
          <PollListSkeleton count={4} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : active.length === 0 ? (
          <EmptyState
            title="No active polls yet"
            description="Be the first to ask the campus. It takes about thirty seconds."
            action={
              <Button asChild>
                <Link to="/create">Create a Poll</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((poll) => (
              <PollCard key={poll.id} poll={poll} myOptionIds={myVotes[poll.id]} />
            ))}
          </div>
        )}
      </section>

      {recentlyClosed.length > 0 ? (
        <section className="mt-10 border-t border-border/60 pt-6" aria-labelledby="closed-polls">
          <h2
            id="closed-polls"
            className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Recently decided
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {recentlyClosed.map((poll) => (
              <PollCard key={poll.id} poll={poll} myOptionIds={myVotes[poll.id]} />
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
