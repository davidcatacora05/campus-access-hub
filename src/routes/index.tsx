import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Nfc } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Connect — Your student ID on your phone" },
      { name: "description", content: "Tap into campus buildings with your phone, see live occupancy, classes and alerts." },
      { property: "og:title", content: "Campus Connect — Your student ID on your phone" },
      { property: "og:description", content: "Tap into campus buildings with your phone, see live occupancy, classes and alerts." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const next = sessionStorage.getItem("cc_after_login") || "/id";
        sessionStorage.removeItem("cc_after_login");
        navigate({ to: next.startsWith("/") ? next : "/id" });
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-navy text-primary-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 py-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Student ID</p>
          <h1 className="mt-3 font-display text-5xl font-bold leading-tight">
            Campus <span className="text-gold">Connect</span>
          </h1>
          <p className="mt-4 text-lg text-primary-foreground/75">
            Tap your phone at any building door. See how busy it is before you go.
          </p>
        </div>
        <div className="relative mx-auto my-12 grid size-40 place-items-center">
          <span className="absolute inset-0 rounded-full bg-gold/40 animate-nfc" />
          <span className="relative grid size-28 place-items-center rounded-full bg-gold text-gold-foreground shadow-gold">
            <Nfc className="size-12" />
          </span>
        </div>
        <Button asChild variant="gold" size="lg" className="h-12 w-full text-base">
          <Link to="/auth">Get started</Link>
        </Button>
      </div>
    </div>
  );
}
