import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  Check,
  Globe,
  GripVertical,
  Layers,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PollCard } from "@/components/poll-card";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, createPoll, fetchPolls, friendlyError, validatePoll, VISTAS_CLASSES } from "@/lib/polls";
import { useMyVotes } from "@/hooks/use-my-votes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — CampusPulse" },
      {
        name: "description",
        content: "CampusPulse administrator portal for creating campus-wide and targeted class polls.",
      },
    ],
  }),
  component: AdminPage,
});

const DURATIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "24 hours", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "1 week", minutes: 10080 },
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate"];

const COMMON_CLASSES = ["CSE-A", "CSE-B", "CSE-C", "IT-A", "IT-B", "ECE-A", "ECE-B", "EEE", "MECH", "CIVIL", "BCA", "MCA", "MBA", "BBA", "B.Com"];

const COMMON_DEPTS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Civil Engineering",
  "School of Management Studies",
  "School of Computing Sciences",
  "School of Basic Sciences",
];

function AdminPage() {
  const { user, loading, setUser, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Admin gate form states
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);

  // Poll creation form state
  const [targetScope, setTargetScope] = useState<"global" | "class">("global");
  const [targetClass, setTargetClass] = useState("");
  const [targetYear, setTargetYear] = useState("3rd Year");
  const [targetDept, setTargetDept] = useState("");

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [duration, setDuration] = useState(1440);
  const [anonymous, setAnonymous] = useState(false);
  const [multiple, setMultiple] = useState(false);

  // Feed filter for admin monitoring
  const [feedFilter, setFeedFilter] = useState<"all" | "global" | "class">("all");

  // Fetch admin statistics
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(user && user.email === "admin@vistas.ac.in" && user.role === "admin"),
  });

  // Fetch registered classes in the system
  const { data: registeredClassesData } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/classes");
      if (!res.ok) return { classes: [] };
      return res.json();
    },
    enabled: Boolean(user && user.email === "admin@vistas.ac.in" && user.role === "admin"),
  });

  const registeredClasses: Array<{ className: string; year?: string; department?: string }> =
    registeredClassesData?.classes || [];

  // Fetch polls according to filter
  const { data: pollsList, isLoading: pollsLoading } = useQuery({
    queryKey: ["polls", { feed: feedFilter }],
    queryFn: () => fetchPolls({ feed: feedFilter === "all" ? undefined : feedFilter }),
    enabled: Boolean(user && user.email === "admin@vistas.ac.in" && user.role === "admin"),
  });

  const myVotes = useMyVotes((pollsList ?? []).map((poll) => poll.id));

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanPass = adminPassword.trim();

    if (!cleanEmail || !cleanPass) {
      toast.error("Please enter administrator email and password.");
      return;
    }

    setAdminLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid administrator credentials.");
      }
      setUser(data.user);
      queryClient.invalidateQueries();
      toast.success("Administrator access granted!");
    } catch (err: any) {
      toast.error(err?.message || "Invalid administrator credentials.");
    } finally {
      setAdminLoggingIn(false);
    }
  };

  const createAdminPoll = useMutation({
    mutationFn: () => {
      const isGlobal = targetScope === "global";
      return createPoll(
        {
          question,
          options,
          category,
          durationMinutes: duration,
          anonymousVoting: anonymous,
          multipleSelection: multiple,
          isGlobal,
          className: isGlobal ? undefined : targetClass.trim(),
          year: isGlobal ? undefined : targetYear.trim(),
          department: isGlobal ? undefined : (targetDept.trim() || undefined),
        },
        { id: user!.id, name: user!.name }
      );
    },
    onSuccess: (pollId) => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
      toast.success(
        targetScope === "global"
          ? "Campus-wide Global Poll is live for all students!"
          : `Class poll is live for ${targetClass} (${targetYear})!`
      );
      setQuestion("");
      setOptions(["", ""]);
      navigate({ to: "/poll/$pollId", params: { pollId } });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (loading) {
    return (
      <AppShell>
        <div className="py-12 text-center text-sm text-muted-foreground">Checking authorization...</div>
      </AppShell>
    );
  }

  // Strict Admin Gate: Only admin@vistas.ac.in can access this portal
  if (!user || user.email !== "admin@vistas.ac.in" || user.role !== "admin") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-12">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-card">
            <div className="text-center mb-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Portal Access</h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Restricted to authorized campus administrators only.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-sm font-medium">
                  Administrator Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@vistas.ac.in"
                  className="h-11 rounded-lg border-input bg-card text-sm"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-sm font-medium">
                  Administrator Password
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="h-11 rounded-lg border-input bg-card text-sm"
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                disabled={adminLoggingIn}
                className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity mt-2"
              >
                {adminLoggingIn ? "Verifying credentials..." : "Authenticate as Administrator"}
              </Button>
            </form>

            <div className="mt-6 text-center border-t border-border pt-4">
              <Link to="/home" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                &larr; Return to Student Home
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const validation = validatePoll({ question, options });

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validation) {
      toast.error(validation);
      return;
    }
    if (targetScope === "class") {
      if (!targetClass.trim()) {
        toast.error("Please enter or select a Target Class / Section (e.g. CSE-A).");
        return;
      }
      if (!targetYear.trim()) {
        toast.error("Please select a Year of Study for the targeted class.");
        return;
      }
    }
    createAdminPoll.mutate();
  };

  // Combine registered and common class suggestions
  const suggestedClassNames = Array.from(
    new Set([
      ...registeredClasses.map((c) => c.className).filter(Boolean),
      ...COMMON_CLASSES,
    ])
  ).slice(0, 10);

  return (
    <AppShell>
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-semibold">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Admin Portal
            </Badge>
            <Badge variant="secondary" className="text-xs">
              VISTAS Campus
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold">Admin Poll Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create campus-wide global polls for all students, or target specific classes and sections.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
          className="text-xs"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          Exit Admin Session
        </Button>
      </section>

      {/* Admin Stats Overview */}
      {stats ? (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-primary" />
              Global Polls
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.globalPollsCount ?? 0}</p>
          </Card>
          <Card className="p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5 text-primary" />
              Class Polls
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.classPollsCount ?? 0}</p>
          </Card>
          <Card className="p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Registered Users
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.totalUsers ?? 0}</p>
          </Card>
          <Card className="p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5 text-primary" />
              Total Votes Cast
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.totalVotes ?? 0}</p>
          </Card>
        </section>
      ) : null}

      {/* Main Grid: Form + Existing Polls Feed */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Poll Creation Form */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Create Administrator Poll
            </h2>
            <p className="text-xs text-muted-foreground">
              Select whether this poll should reach all campus students or be scoped to a specific class.
            </p>
          </div>

          <form
            className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-card"
            onSubmit={handleSubmit}
          >
            {/* Target Audience Scope Selector */}
            <div className="space-y-3 rounded-lg border border-border/80 bg-secondary/30 p-4">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Target Audience
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Global Option */}
                <button
                  type="button"
                  onClick={() => setTargetScope("global")}
                  className={cn(
                    "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all",
                    targetScope === "global"
                      ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                      : "border-border bg-card hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-primary" />
                      Campus-Wide (Global)
                    </span>
                    {targetScope === "global" ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Displayed to <strong>all students & all users</strong> across every department and year.
                  </p>
                </button>

                {/* Specific Class Option */}
                <button
                  type="button"
                  onClick={() => setTargetScope("class")}
                  className={cn(
                    "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all",
                    targetScope === "class"
                      ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                      : "border-border bg-card hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      Specific Class
                    </span>
                    {targetScope === "class" ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Only students in the <strong>selected class and year</strong> will be able to see and vote.
                  </p>
                </button>
              </div>

              {/* Class Specific Inputs */}
              {targetScope === "class" ? (
                <div className="mt-3 space-y-4 rounded-md border border-border bg-card p-4 pt-3 transition-all animate-in fade-in-50">
                  <div className="space-y-2">
                    <Label htmlFor="target-class" className="text-xs font-semibold">
                      Target Class / Course <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="target-class"
                      required={targetScope === "class"}
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <option value="" disabled>Select target class</option>
                      {VISTAS_CLASSES.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>

                    {/* Quick selection pills */}
                    <div className="space-y-1 pt-1">
                      <p className="text-[11px] text-muted-foreground">Quick select class:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {VISTAS_CLASSES.map((cls) => (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => setTargetClass(cls)}
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                              targetClass === cls
                                ? "border-primary bg-primary text-primary-foreground font-semibold"
                                : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                            )}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Year of Study Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Year of Study <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {YEARS.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setTargetYear(yr)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            targetYear === yr
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border bg-card text-foreground hover:bg-secondary"
                          )}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Department (Optional) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="target-dept" className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      Department <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Input
                      id="target-dept"
                      value={targetDept}
                      onChange={(e) => setTargetDept(e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="h-10 text-sm"
                      list="dept-options"
                    />
                    <datalist id="dept-options">
                      {COMMON_DEPTS.map((dept) => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Question */}
            <div className="space-y-2">
              <Label htmlFor="admin-question" className="text-sm font-medium">
                Poll Question <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="admin-question"
                required
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={
                  targetScope === "global"
                    ? "e.g. Should the campus cafeteria extend operating hours till midnight?"
                    : `e.g. When should we schedule the ${targetClass || "class"} project review?`
                }
                maxLength={200}
                rows={3}
              />
              <p className="text-xs text-muted-foreground tabular">{question.length}/200</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Options <span className="text-destructive">*</span></Label>
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <Input
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={80}
                    aria-label={`Option ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove option ${index + 1}`}
                    disabled={options.length <= 2}
                    onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ))}

              {options.length < 8 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((current) => [...current, ""])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add another option
                </Button>
              ) : null}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === cat
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((dur) => (
                  <button
                    key={dur.minutes}
                    type="button"
                    onClick={() => setDuration(dur.minutes)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      duration === dur.minutes
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    )}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="admin-multiple" className="text-sm font-medium">
                    Multiple selections
                  </Label>
                  <p className="text-xs text-muted-foreground">Allow voters to pick more than one option.</p>
                </div>
                <Switch id="admin-multiple" checked={multiple} onCheckedChange={setMultiple} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="admin-anon" className="text-sm font-medium">
                    Anonymous poll
                  </Label>
                  <p className="text-xs text-muted-foreground">Hide administrator name from the poll card.</p>
                </div>
                <Switch id="admin-anon" checked={anonymous} onCheckedChange={setAnonymous} />
              </div>
            </div>

            <Button
              type="submit"
              disabled={createAdminPoll.isPending}
              className="w-full bg-primary font-semibold h-11 text-sm shadow-sm"
            >
              {createAdminPoll.isPending
                ? "Publishing Poll..."
                : targetScope === "global"
                ? "Publish Campus Global Poll (All Users)"
                : `Publish Poll for ${targetClass || "Selected Class"}`}
            </Button>
          </form>
        </section>

        {/* Live Polls Feed & Monitor */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Active Campus Polls</h2>
              <p className="text-xs text-muted-foreground">
                Live view of all polls across campus and classes.
              </p>
            </div>

            {/* Feed Filter Segmented Controls */}
            <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFeedFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  feedFilter === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter("global")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  feedFilter === "global"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter("class")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  feedFilter === "class"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Class
              </button>
            </div>
          </div>

          {pollsLoading ? (
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (pollsList ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Globe className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No polls found for this filter</p>
              <p className="text-xs text-muted-foreground">
                Publish a poll using the form on the left to start voting.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(pollsList ?? []).map((poll) => (
                <PollCard key={poll.id} poll={poll} myOptionIds={myVotes[poll.id]} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
