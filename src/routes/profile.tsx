import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SignInRequired } from "@/components/sign-in-required";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError, VISTAS_CLASSES } from "@/lib/polls";
import {
  CheckCircle2,
  KeyRound,
  GraduationCap,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Save,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — CampusPulse" },
      {
        name: "description",
        content:
          "Manage your CampusPulse student profile, class, department, and account security.",
      },
      { property: "og:title", content: "Your profile — CampusPulse" },
      { property: "og:description", content: "Manage your CampusPulse account and activity." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, updateProfile, signOut, forgotPassword, resetPassword } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.email === "admin@vistas.ac.in";

  // Form states for profile fields
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [className, setClassName] = useState("");

  // Password reset inside profile states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetStep, setResetStep] = useState<"initial" | "sent">("initial");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync form state whenever user object updates
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setDepartment(user.department || "");
      setYear(user.year || "");
      setClassName(user.className || "");
    }
  }, [user]);

  // Cooldown countdown for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const stats = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await fetch("/api/profile");
      const json = await res.json();
      if (json.user) {
        setName(json.user.name || "");
        setDepartment(json.user.department || "");
        setYear(json.user.year || "");
        setClassName(json.user.className || "");
      }
      return { polls: json.polls ?? 0, votes: json.votes ?? 0, profileUser: json.user };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      department: string;
      year: string;
      className: string;
    }) => {
      return await updateProfile(payload);
    },
    onSuccess: async () => {
      toast.success("Profile and class details updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const handleProfileSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanDept = department.trim();
    const cleanYear = year.trim();
    const cleanClass = className.trim();

    if (cleanName.length < 2) {
      toast.error("Please enter a valid full name with at least 2 characters.");
      return;
    }
    if (!cleanDept) {
      toast.error("Please enter your department.");
      return;
    }
    if (!cleanYear) {
      toast.error("Please enter your year of study.");
      return;
    }
    if (!cleanClass) {
      toast.error("Please enter your class / section.");
      return;
    }

    saveMutation.mutate({
      name: cleanName,
      department: cleanDept,
      year: cleanYear,
      className: cleanClass,
    });
  };

  // Password reset handlers
  const handleRequestReset = async () => {
    if (!user?.email) return;
    setResetBusy(true);
    try {
      const res = await forgotPassword(user.email);
      toast.success(res.message || "Reset verification code sent to your email!");
      setResetStep("sent");
      setResendCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send reset code.";
      toast.error(message);
    } finally {
      setResetBusy(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    const cleanCode = resetCode.trim();
    if (cleanCode.length !== 6) {
      toast.error("Please enter the 6-digit reset code sent to your email.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    setResetBusy(true);
    try {
      const res = await resetPassword(user.email, cleanCode, newPassword);
      toast.success(res.message || "Password updated successfully!");
      setShowPasswordReset(false);
      setResetStep("initial");
      setResetCode("");
      setNewPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password.";
      toast.error(message);
    } finally {
      setResetBusy(false);
    }
  };

  if (!loading && !user) {
    return (
      <AppShell>
        <SignInRequired
          title="Sign in to view your profile"
          description="Your name, polls, and voting history are tied to your account."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Manage your administrator account security and credentials."
              : "Manage your student details, academic batch, and account security."}
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl space-y-8">
        {/* User Identity Card */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-sm">
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-bold text-foreground">{user?.name}</p>
                {isAdmin ? (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Administrator
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Student
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              {isAdmin ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    Campus Administrator
                  </span>
                  <span>•</span>
                  <span>VISTAS Campus-Wide Access</span>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-primary" />
                    {user?.department || "No department set"}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" />
                    {user?.year || "Year not set"}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3 w-3 text-primary" />
                    Class: {user?.className || "Not set"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Edit Student Information Form (Students Only) */}
        {!isAdmin && (
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Edit Student Information
                </h2>
                <p className="text-xs text-muted-foreground">
                  These details determine which class polls you see on your dashboard.
                </p>
              </div>
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="display-name" className="text-sm font-medium">
                  Full Name / Display Name
                </Label>
                <Input
                  id="display-name"
                  value={name}
                  maxLength={80}
                  placeholder="e.g. Aditi Sharma"
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="h-10 bg-background"
                />
              </div>

              {/* Email (Read Only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-readonly" className="text-sm font-medium">
                    VISTAS Student Email
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Primary identifier (Read-only)
                  </span>
                </div>
                <Input
                  id="email-readonly"
                  value={user?.email || ""}
                  disabled
                  className="h-10 bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label htmlFor="department" className="text-sm font-medium">
                  Department
                </Label>
                <Input
                  id="department"
                  value={department}
                  maxLength={100}
                  placeholder="e.g. Computer Science and Engineering, Mechanical, Commerce"
                  onChange={(event) => setDepartment(event.target.value)}
                  required
                  className="h-10 bg-background"
                />
              </div>

              {/* Year and Class in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="year" className="text-sm font-medium">
                    Year of Study
                  </Label>
                  <select
                    id="year"
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <option value="" disabled>Select year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="className" className="text-sm font-medium">
                    Class / Course
                  </Label>
                  <select
                    id="className"
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <option value="" disabled>Select class</option>
                    {VISTAS_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 font-medium"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? "Saving changes..." : "Save Details"}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Password Reset & Security Section */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Account Security & Password
              </h2>
              <p className="text-xs text-muted-foreground">
                Reset your login password using email code verification.
              </p>
            </div>
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          </div>

          {!showPasswordReset ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Password Management</p>
                <p className="text-xs text-muted-foreground">
                  Forgot your password or want to set a new one? Verify your identity via email.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordReset(true);
                  setResetStep("initial");
                }}
                className="inline-flex items-center gap-1.5"
              >
                <KeyRound className="h-4 w-4" />
                Reset Password
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              {resetStep === "initial" ? (
                <div className="space-y-3">
                  <p className="text-sm text-foreground">
                    We will send a 6-digit verification code to your registered email:{" "}
                    <span className="font-semibold text-foreground">{user?.email}</span>.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleRequestReset}
                      disabled={resetBusy}
                      className="inline-flex items-center gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {resetBusy ? "Sending code..." : "Send Verification Code"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowPasswordReset(false)}
                      disabled={resetBusy}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-reset-code" className="text-sm font-medium">
                      6-Digit Verification Code
                    </Label>
                    <Input
                      id="profile-reset-code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      required
                      autoFocus
                      className="h-10 font-bold tracking-widest text-center max-w-xs bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      Check your inbox at {user?.email}. Code is valid for 10 minutes.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-new-password" className="text-sm font-medium">
                      New Password
                    </Label>
                    <Input
                      id="profile-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                      className="h-10 max-w-sm bg-background"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      type="submit"
                      disabled={resetBusy || resetCode.length < 6 || newPassword.length < 8}
                      className="inline-flex items-center gap-2"
                    >
                      {resetBusy ? "Updating password..." : "Set New Password"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRequestReset}
                      disabled={resetBusy || resendCooldown > 0}
                      className="text-xs"
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${resetBusy ? "animate-spin" : ""}`} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordReset(false);
                        setResetStep("initial");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>

        {/* Voting & Activity Stats */}
        <section className="grid grid-cols-2 gap-4">
          <StatCard label="Polls created" value={stats.data?.polls} loading={stats.isLoading} />
          <StatCard label="Votes cast" value={stats.data?.votes} loading={stats.isLoading} />
        </section>

        {/* Sign Out Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              await signOut();
              window.location.assign("/");
            }}
          >
            Sign out of CampusPulse
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      {loading ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <p className="text-3xl font-bold tabular text-foreground">{value ?? 0}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
