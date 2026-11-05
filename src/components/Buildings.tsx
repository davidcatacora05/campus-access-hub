import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { capacityLevel } from "@/lib/session";
import { CheckCircle2, XCircle, LogOut } from "lucide-react";
import type { TapResult } from "@/lib/session";

export function useBuildings() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`buildings-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buildings" }, () => {
        qc.invalidateQueries({ queryKey: ["buildings"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  return useQuery({
    queryKey: ["buildings"],
    queryFn: async () => {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from("buildings").select("*").order("name"),
        supabase.from("campus_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      return { buildings: b ?? [], settings: s };
    },
  });
}

const barColor = { ok: "bg-success", near: "bg-warning", full: "bg-destructive" } as const;
const pill = {
  ok: "bg-success/15 text-success",
  near: "bg-warning/20 text-foreground",
  full: "bg-destructive/15 text-destructive",
} as const;

export function CapacityBar({ occ, cap, nearPct }: { occ: number; cap: number; nearPct?: number | undefined }) {
  const c = capacityLevel(occ, cap, nearPct);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {occ} / {cap} inside
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${pill[c.level]}`}>{c.label}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${barColor[c.level]}`} style={{ width: `${Math.min(c.pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function TapResultOverlay({ result, onClose }: { result: TapResult; onClose: () => void }) {
  const time = result.at ? new Date(result.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const ok = result.granted;
  const Icon = !ok ? XCircle : result.direction === "out" ? LogOut : CheckCircle2;
  return (
    <button
      onClick={onClose}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-8 text-center ${ok ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
    >
      <Icon className="size-24" strokeWidth={1.5} />
      <h2 className="font-display text-4xl font-bold">
        {!ok ? "Access denied" : result.direction === "out" ? "Checked out" : "Access granted"}
      </h2>
      {!ok && <p className="rounded-full bg-background/20 px-5 py-2 text-xl font-semibold">{result.reason}</p>}
      <p className="text-lg opacity-90">
        {result.building}
        {time && ` · ${time}`}
      </p>
      {ok && result.name && <p className="opacity-80">{result.name}</p>}
      <p className="mt-8 text-sm opacity-70">Tap anywhere to close</p>
    </button>
  );
}
