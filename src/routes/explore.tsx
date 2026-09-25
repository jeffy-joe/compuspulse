import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PollCard } from "@/components/poll-card";
import { EmptyState, ErrorState, PollListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyVotes } from "@/hooks/use-my-votes";
import { usePollRealtime } from "@/hooks/use-poll-realtime";
import { CATEGORIES, fetchPolls, type SortKey } from "@/lib/polls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore live polls — CampusPulse" },
      {
        name: "description",
        content:
          "Browse active campus polls by category, search by topic, and vote on the decisions that matter to you.",
      },
      { property: "og:title", content: "Explore live polls — CampusPulse" },
      {
        property: "og:description",
        content: "Browse active campus polls by category and vote in seconds.",
      },
    ],
  }),
  component: ExplorePage,
});

const FILTERS = ["All", ...CATEGORIES, "Closed"] as const;

function ExplorePage() {
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  usePollRealtime();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["polls", { category, search, sort }],
    queryFn: () => fetchPolls({ category, search, sort }),
  });

  const polls = data ?? [];
  const myVotes = useMyVotes(polls.map((poll) => poll.id));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Explore polls</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every open question on campus, in one place.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search polls..."
            aria-label="Search polls"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger className="sm:w-48" aria-label="Sort polls">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="votes">Most votes</SelectItem>
            <SelectItem value="ending">Ending soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              category === item
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item === "Closed" ? "Closed Polls" : item}
          </button>
        ))}
      </div>

      <div className="mt-7">
        {isLoading ? (
          <PollListSkeleton count={4} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : polls.length === 0 ? (
          <EmptyState
            title={
              search
                ? "Nothing matched that search"
                : category === "Closed"
                ? "No closed polls yet"
                : "No polls in this category yet"
            }
            description={
              search
                ? "Try a different word, or clear the search to see everything."
                : category === "Closed"
                ? "When polls reach their expiration time, their final results will appear here."
                : "Start the conversation — ask something your classmates actually care about."
            }
            action={
              <Button asChild>
                <Link to="/create">Create a Poll</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} myOptionIds={myVotes[poll.id]} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
