import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  Globe,
  GripVertical,
  Layers,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SignInRequired } from "@/components/sign-in-required";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, createPoll, friendlyError, validatePoll, VISTAS_CLASSES } from "@/lib/polls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a poll — CampusPulse" },
      {
        name: "description",
        content:
          "Write a question, add your options and set a timer. Your poll goes live instantly.",
      },
      { property: "og:title", content: "Create a poll — CampusPulse" },
      {
        property: "og:description",
        content: "Write a question, add options, set a timer — live in seconds.",
      },
    ],
  }),
  component: CreatePage,
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

function CreatePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin" || user?.email === "admin@vistas.ac.in";

  // Admin target selection
  const [adminTargetScope, setAdminTargetScope] = useState<"global" | "class">("global");
  const [adminTargetClass, setAdminTargetClass] = useState("");
  const [adminTargetYear, setAdminTargetYear] = useState("3rd Year");
  const [adminTargetDept, setAdminTargetDept] = useState("");

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [duration, setDuration] = useState(1440);
  const [anonymous, setAnonymous] = useState(false);
  const [multiple, setMultiple] = useState(false);

  // Fetch registered classes if admin
  const { data: registeredClassesData } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/classes");
      if (!res.ok) return { classes: [] };
      return res.json();
    },
    enabled: Boolean(isAdmin),
  });

  const registeredClasses: Array<{ className: string; year?: string; department?: string }> =
    registeredClassesData?.classes || [];

  const suggestedClassNames = Array.from(
    new Set([
      ...registeredClasses.map((c) => c.className).filter(Boolean),
      ...COMMON_CLASSES,
    ])
  ).slice(0, 8);

  const create = useMutation({
    mutationFn: () => {
      const isGlobal = isAdmin && adminTargetScope === "global";
      return createPoll(
        {
          question,
          options,
          category,
          durationMinutes: duration,
          anonymousVoting: anonymous,
          multipleSelection: multiple,
          isGlobal,
          className: isAdmin && adminTargetScope === "class" ? adminTargetClass.trim() : undefined,
          year: isAdmin && adminTargetScope === "class" ? adminTargetYear.trim() : undefined,
          department: isAdmin && adminTargetScope === "class" ? adminTargetDept.trim() || undefined : undefined,
        },
        { id: user!.id, name: user!.name },
      );
    },
    onSuccess: (pollId) => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast.success(
        isAdmin && adminTargetScope === "global"
          ? "Campus-wide Global Poll is live!"
          : "Your poll is live!"
      );
      navigate({ to: "/poll/$pollId", params: { pollId } });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <SignInRequired
          title="Sign in to create a poll"
          description="We link every poll to its creator so results stay trustworthy."
        />
      </AppShell>
    );
  }

  const validation = validatePoll({ question, options });
  const filledOptions = options.map((option) => option.trim()).filter(Boolean);

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin && (!user?.className || !user?.year)) {
      toast.error("Please set your Class and Year in your profile before publishing a poll.");
      return;
    }
    if (isAdmin && adminTargetScope === "class") {
      if (!adminTargetClass.trim()) {
        toast.error("Please enter the Target Class / Section (e.g. CSE-A).");
        return;
      }
      if (!adminTargetYear.trim()) {
        toast.error("Please select a Year of Study for the targeted class.");
        return;
      }
    }
    if (validation) {
      toast.error(validation);
      return;
    }
    create.mutate();
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Create a poll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One clear question beats five vague ones.
          </p>
        </div>
        {isAdmin ? (
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-semibold">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Admin Publishing
          </Badge>
        ) : null}
      </div>

      {/* Target Audience Scope / Notice */}
      {isAdmin ? (
        <div className="mt-6 space-y-3 rounded-lg border border-border/80 bg-secondary/30 p-4">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" />
            Target Audience
          </Label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Global Option */}
            <button
              type="button"
              onClick={() => setAdminTargetScope("global")}
              className={cn(
                "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all",
                adminTargetScope === "global"
                  ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                  : "border-border bg-card hover:bg-secondary/50"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-primary" />
                  Campus-Wide (Global)
                </span>
                {adminTargetScope === "global" ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Displayed to <strong>all students & all users</strong> across every department.
              </p>
            </button>

            {/* Specific Class Option */}
            <button
              type="button"
              onClick={() => setAdminTargetScope("class")}
              className={cn(
                "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all",
                adminTargetScope === "class"
                  ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                  : "border-border bg-card hover:bg-secondary/50"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  Specific Class
                </span>
                {adminTargetScope === "class" ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Target a <strong>specific class and year</strong> (e.g. CSE-A, 3rd Year).
              </p>
            </button>
          </div>

          {/* Class Specific Inputs for Admin */}
          {adminTargetScope === "class" ? (
            <div className="mt-3 space-y-4 rounded-md border border-border bg-card p-4 pt-3 transition-all">
              <div className="space-y-2">
                <Label htmlFor="admin-create-class" className="text-xs font-semibold">
                  Target Class / Course <span className="text-destructive">*</span>
                </Label>
                <select
                  id="admin-create-class"
                  value={adminTargetClass}
                  onChange={(e) => setAdminTargetClass(e.target.value)}
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
                  <p className="text-[11px] text-muted-foreground">Quick select:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VISTAS_CLASSES.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setAdminTargetClass(cls)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          adminTargetClass === cls
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

              {/* Year Selector */}
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
                      onClick={() => setAdminTargetYear(yr)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        adminTargetYear === yr
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
                <Label htmlFor="admin-create-dept" className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Department <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="admin-create-dept"
                  value={adminTargetDept}
                  onChange={(e) => setAdminTargetDept(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="h-10 text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : user?.className && user?.year ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <span>
            Target Audience:{" "}
            <strong className="font-semibold text-primary">
              {user.className} ({user.year})
            </strong>{" "}
            — only students in your same class and year will be able to access and vote on this
            poll.
          </span>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Your profile is missing your <strong>Class / Section</strong> or{" "}
              <strong>Year of Study</strong>.
            </span>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs border-amber-500/40">
            <Link to="/profile">Update Profile</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form className="space-y-8" onSubmit={handleSubmit}>
          <section className="space-y-2">
            <Label htmlFor="question">Your question</Label>
            <Textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Which band should headline the fest?"
              maxLength={200}
              rows={2}
            />
            <p className="text-xs text-muted-foreground tabular">{question.length}/200</p>
          </section>

          <section className="space-y-3">
            <Label>Options</Label>
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
                Add option
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                That&apos;s the maximum of eight options.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
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
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Label>Runs for</Label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((item) => (
                <button
                  key={item.minutes}
                  type="button"
                  aria-pressed={duration === item.minutes}
                  onClick={() => setDuration(item.minutes)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    duration === item.minutes
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-5">
            <ToggleRow
              id="multiple"
              title="Allow multiple selections"
              body="Voters can pick more than one option."
              checked={multiple}
              onChange={setMultiple}
            />
            <ToggleRow
              id="anonymous"
              title="Hide my name"
              body="The poll shows as created by Anonymous."
              checked={anonymous}
              onChange={setAnonymous}
            />
          </section>

          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={create.isPending}>
              {create.isPending ? "Publishing..." : "Publish poll"}
            </Button>
            {validation ? <p className="text-xs text-muted-foreground">{validation}</p> : null}
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{category}</Badge>
              {isAdmin && adminTargetScope === "global" ? (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-semibold">
                  Global
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
                  {isAdmin
                    ? adminTargetClass || "Target Class"
                    : user?.className || "Your Class"}
                  {isAdmin
                    ? ` • ${adminTargetYear}`
                    : user?.year
                    ? ` • ${user.year}`
                    : ""}
                </Badge>
              )}
            </div>
            <h2 className="mt-3 text-base font-semibold leading-snug">
              {question.trim() || "Your question will appear here"}
            </h2>
            <ul className="mt-4 space-y-2">
              {(filledOptions.length ? filledOptions : ["Option 1", "Option 2"]).map(
                (option, index) => (
                  <li
                    key={index}
                    className="rounded-md border border-border px-3.5 py-2.5 text-sm text-muted-foreground"
                  >
                    {option}
                  </li>
                ),
              )}
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              {anonymous ? "Anonymous" : (user?.name ?? "You")} ·{" "}
              {DURATIONS.find((item) => item.minutes === duration)?.label}
              {multiple ? " · multiple choice" : ""}
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  id,
  title,
  body,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  body: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
