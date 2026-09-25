import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, QrCode, Zap } from "lucide-react";
import { Wordmark, LiveDot } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PollResults } from "@/components/poll-results";
import { Countdown } from "@/components/countdown";
import { Skeleton } from "@/components/ui/skeleton";
import { usePollRealtime } from "@/hooks/use-poll-realtime";
import { fetchPolls } from "@/lib/polls";
import { useAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusPulse — Real opinions. Real-time decisions." },
      {
        name: "description",
        content:
          "Campus decisions, powered by everyone's voice. Create a poll, share a link or QR code, and watch results update live.",
      },
      { property: "og:title", content: "CampusPulse — Real opinions. Real-time decisions." },
      {
        property: "og:description",
        content: "Create polls, gather opinions and watch the results change in real time.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  usePollRealtime();

  const { data: polls, isLoading } = useQuery({
    queryKey: ["polls", { sort: "votes", limit: 1 }],
    queryFn: () => fetchPolls({ sort: "votes" }),
  });

  const featured = polls?.find((poll) => new Date(poll.expires_at).getTime() > Date.now()) ?? polls?.[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Wordmark />
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/explore">Explore</Link>
            </Button>
            <Button asChild size="sm">
              <Link to={user ? "/home" : "/auth"}>{user ? "Open app" : "Sign in"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
              Real opinions. Real-time decisions.
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
              Campus decisions, powered by everyone&apos;s voice.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              Create polls, gather opinions, and watch the results change in real time — for events,
              classrooms, clubs and everything your campus argues about.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/create">
                  Create a Poll
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/explore">Explore Polls</Link>
              </Button>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              <Feature icon={Zap} title="Live results" body="Votes appear instantly" />
              <Feature icon={QrCode} title="Scan to vote" body="Share a QR in the room" />
              <Feature icon={BarChart3} title="Clear outcomes" body="No spreadsheets needed" />
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-raised">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : featured ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {featured.category} · {featured.creator_name}
                  </span>
                  <LiveDot label="Live results" />
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-snug">{featured.question}</h2>
                <div className="mt-5">
                  <PollResults poll={featured} />
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="tabular">
                    {featured.total_votes} {featured.total_votes === 1 ? "vote" : "votes"}
                  </span>
                  <Countdown expiresAt={featured.expires_at} />
                </div>
                <Button asChild variant="secondary" className="mt-5 w-full">
                  <Link to="/poll/$pollId" params={{ pollId: featured.id }}>
                    Cast your vote
                  </Link>
                </Button>
              </>
            ) : (
              <div className="py-10 text-center">
                <h2 className="font-display text-base font-semibold">No polls running yet</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Be the first to ask the campus something.
                </p>
                <Button asChild className="mt-5">
                  <Link to="/create">Create a Poll</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-4">
            <div>
              <h2 className="text-xl font-bold">Turn opinions into decisions — instantly.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Four steps, about a minute end to end.
              </p>
            </div>
            {[
              { step: "01", title: "Create", body: "Write a question, add options, set how long it runs." },
              { step: "02", title: "Share", body: "Send a link or put the QR code on the projector." },
              { step: "03", title: "Vote", body: "One tap on any phone. Duplicate votes are blocked." },
              { step: "04", title: "Decide", body: "Results update live and close automatically." },
            ]
              .slice(0, 3)
              .map((item) => (
                <div key={item.step}>
                  <span className="font-mono text-xs font-medium text-primary">{item.step}</span>
                  <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-xs text-muted-foreground sm:px-6">
          <Wordmark />
          <span className="ml-auto">Real opinions. Real-time decisions.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Zap;
  title: string;
  body: string;
}) {
  return (
    <div>
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <dt className="mt-2 text-sm font-semibold">{title}</dt>
      <dd className="text-xs text-muted-foreground">{body}</dd>
    </div>
  );
}
