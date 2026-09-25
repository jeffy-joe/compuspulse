import { Link, useLocation } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignInRequired({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const location = useLocation();

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center shadow-card">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
        <LogIn className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-6">
        <Link to="/auth" search={{ redirect: location.pathname }}>
          Sign in to continue
        </Link>
      </Button>
    </div>
  );
}
