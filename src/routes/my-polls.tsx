import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SignInRequired } from "@/components/sign-in-required";
import { EmptyState, ErrorState, PollListSkeleton } from "@/components/states";
import { Countdown } from "@/components/countdown";
import { ShareDialog } from "@/components/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/components/auth-provider";
import { usePollRealtime } from "@/hooks/use-poll-realtime";
import { deletePoll, fetchMyPolls, friendlyError, isClosed, type Poll } from "@/lib/polls";
import { formatRelative } from "@/lib/time";

export const Route = createFileRoute("/my-polls")({
  head: () => ({
    meta: [
      { title: "My polls — CampusPulse" },
      {
        name: "description",
        content: "Track the polls you've created, watch votes come in, and close the loop on decisions.",
      },
      { property: "og:title", content: "My polls — CampusPulse" },
      {
        property: "og:description",
        content: "Track the polls you've created and the decisions they produced.",
      },
    ],
  }),
  component: MyPollsPage,
});

function MyPollsPage() {
  const { user, loading } = useAuth();
  usePollRealtime();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["polls", "mine", user?.id],
    queryFn: () => fetchMyPolls(user!.id),
    enabled: Boolean(user),
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <SignInRequired
          title="Sign in to see your polls"
          description="Your polls, their results and their history live in your account."
        />
      </AppShell>
    );
  }

  const polls = data ?? [];
  const active = polls.filter((poll) => !isClosed(poll));
  const completed = polls.filter((poll) => isClosed(poll));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">My polls</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything you&apos;ve asked the campus.
      </p>

      {isLoading || loading ? (
        <div className="mt-7">
          <PollListSkeleton count={2} />
        </div>
      ) : isError ? (
        <div className="mt-7">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : polls.length === 0 ? (
        <div className="mt-7">
          <EmptyState
            title="You haven't created a poll yet"
            description="Ask one clear question, add a few options, and let your campus decide."
            action={
              <Button asChild>
                <Link to="/create">Create a Poll</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <Tabs defaultValue="active" className="mt-7">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-5 space-y-3">
            {active.length === 0 ? (
              <EmptyState
                title="Nothing running right now"
                description="All of your polls have closed. Start a new one when the next decision comes up."
                action={
                  <Button asChild>
                    <Link to="/create">Create a Poll</Link>
                  </Button>
                }
              />
            ) : (
              active.map((poll) => <MyPollRow key={poll.id} poll={poll} />)
            )}
          </TabsContent>
          <TabsContent value="completed" className="mt-5 space-y-3">
            {completed.length === 0 ? (
              <EmptyState
                title="No completed polls yet"
                description="Once a poll's timer runs out it moves here with its final results."
              />
            ) : (
              completed.map((poll) => <MyPollRow key={poll.id} poll={poll} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function MyPollRow({ poll }: { poll: Poll }) {
  const queryClient = useQueryClient();
  const closed = isClosed(poll);

  const remove = useMutation({
    mutationFn: () => deletePoll(poll.id),
    onSuccess: () => {
      toast.success("Poll deleted");
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{poll.category}</Badge>
        {closed ? (
          <span className="text-xs font-semibold text-muted-foreground">Poll ended</span>
        ) : (
          <span className="text-xs font-semibold text-success">Open</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Created {formatRelative(poll.created_at)}
        </span>
      </div>

      <h2 className="mt-3 text-base font-semibold leading-snug">
        <Link
          to="/poll/$pollId"
          params={{ pollId: poll.id }}
          className="transition-colors hover:text-primary"
        >
          {poll.question}
        </Link>
      </h2>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">
          {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
        </span>
        <span aria-hidden>·</span>
        <Countdown expiresAt={poll.expires_at} />
        <div className="ml-auto flex items-center gap-1">
          <ShareDialog pollId={poll.id} question={poll.question} />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/poll/$pollId" params={{ pollId: poll.id }}>
              View results
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete poll: ${poll.question}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this poll?</AlertDialogTitle>
                <AlertDialogDescription>
                  The question and every vote it collected will be removed. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep poll</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate()}>Delete poll</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </article>
  );
}
