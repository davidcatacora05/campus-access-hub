import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Bell, IdCard, LayoutDashboard, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/session";

const tabs = [
  { to: "/classes", label: "Classes", icon: BookOpen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/id", label: "Student ID", icon: IdCard },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
        <Link to="/id" className="font-display text-xl font-bold tracking-tight">
          Campus <span className="text-gold">Connect</span>
        </Link>
        <div className="flex items-center gap-1">
          {me?.isSupervisor && (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
              activeProps={{ className: "bg-gold text-gold-foreground" }}
            >
              <LayoutDashboard className="size-3.5" /> Operations
            </Link>
          )}
          <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 hover:bg-secondary">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground"
                activeProps={{ className: "!text-primary" }}
              >
                {({ isActive }) => (
                  <>
                    <span className={`rounded-full px-4 py-1 transition-colors ${isActive ? "bg-gold" : ""}`}>
                      <Icon className="size-5" />
                    </span>
                    {label}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
