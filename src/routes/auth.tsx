import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in · Campus Connect" },
      { name: "description", content: "Sign in to your Campus Connect student ID." },
      { property: "og:title", content: "Sign in · Campus Connect" },
      { property: "og:description", content: "Sign in to your Campus Connect student ID." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/id";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/id";
  } catch {
    return "/id";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin + safePath(redirect) },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
        else navigate({ to: safePath(redirect) });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: safePath(redirect) });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    sessionStorage.setItem("cc_after_login", safePath(redirect));
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (r.redirected) return;
    navigate({ to: safePath(redirect) });
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy text-primary-foreground">
      <div className="mx-auto w-full max-w-md flex-1 px-6 pt-16">
        <h1 className="font-display text-4xl font-bold">
          Campus <span className="text-gold">Connect</span>
        </h1>
        <p className="mt-2 text-primary-foreground/70">Your student ID, right on your phone.</p>

        <div className="mt-10 rounded-3xl bg-card p-6 text-card-foreground shadow-card">
          {sent ? (
            <div className="space-y-2 text-center">
              <h2 className="font-display text-2xl font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">We sent a confirmation link to {email}.</p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold">{mode === "in" ? "Welcome back" : "Create your ID"}</h2>
              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">School email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Password</Label>
                  <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
                  {mode === "in" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <div className="my-4 text-center text-xs text-muted-foreground">or</div>
              <Button type="button" variant="google" size="lg" className="w-full" onClick={google}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
                Continue with Google
              </Button>
              <button
                type="button"
                className="mt-5 w-full text-center text-sm text-muted-foreground"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
