import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Home, LayoutList, Plus, LogIn } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/my-polls", label: "My Polls", icon: LayoutList },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Wordmark to="/" />

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  pathname === to && "bg-secondary text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/create">
                <Plus className="h-4 w-4" aria-hidden />
                Create Poll
              </Link>
            </Button>
            {loading ? (
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" aria-hidden />
            ) : user ? (
              <UserMenu />
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/auth">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-16">
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  pathname === to && "text-primary",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <Link
              to="/create"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                pathname === "/create" && "text-primary",
              )}
            >
              <Plus className="h-5 w-5" aria-hidden />
              Create
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
