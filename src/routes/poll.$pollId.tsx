import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PollCard } from "@/components/poll-card";
import { EmptyState, ErrorState, PollCardSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useMyVotes } from "@/hooks/use-my-votes";
import { usePollRealtime } from "@/hooks/use-poll-realtime";
import { fetchPoll, isClosed } from "@/lib/polls";
import { formatRelative } from "@/lib/time";

export const Route = createFileRoute("/poll/$pollId")({
  loader: async ({ params }) => {
    try {
      const poll = await fetchPoll(params.pollId);
      if (!poll) throw notFound();
      return { poll, error: null as string | null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Poll unavailable";
      return { poll: null, error: msg };
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.poll) {
      return {
        meta: [{ title: "Poll unavailable — CampusPulse" }, { name: "robots", content: "noindex" }],
      };
    }
    const { poll } = loaderData;
    const description = `${poll.total_votes} ${poll.total_votes === 1 ? "vote" : "votes"} so far — cast yours and watch the results move in real time.`;
    return {
      meta: [
        { title: `${poll.question} — CampusPulse` },
        { name: "description", content: description },
        { property: "og:title", content: poll.question },
        { property: "og:description", content: description },
      ],
    };
  },
  component: PollPage,
});

function PollPage() {
  const { pollId } = Route.useParams();
  const initial = Route.useLoaderData();
  useAuth();
  usePollRealtime(pollId);

  const { data, isError, error, refetch } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => fetchPoll(pollId),
    initialData: initial.poll ?? undefined,
  });

  const myVotes = useMyVotes([pollId]);
  const restrictionError = (error as Error)?.message || initial.error;

  return (
    <AppShell>
      <Link
        to="/explore"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to polls
      </Link>

      <div className="mx-auto mt-6 max-w-2xl">
        {restrictionError ? (
          <EmptyState
            title="Class Poll Restricted"
            description={restrictionError}
            action={
              <Button asChild>
                <Link to="/home">Return to My Feed</Link>
              </Button>
            }
          />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data ? (
          <PollCardSkeleton />
        ) : (
          <>
            <PollCard
              poll={data}
              myOptionIds={myVotes[pollId]}
              headingLevel="h2"
              showQuestionLink={false}
            />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Created {formatRelative(data.created_at)} by {data.creator_name}
              {isClosed(data) ? " · voting has ended" : " · results update live"}
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
