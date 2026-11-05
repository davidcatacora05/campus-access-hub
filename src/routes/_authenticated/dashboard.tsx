import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, AlertTriangle, Building2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, capacityLevel } from "@/lib/session";
import { useBuildings, CapacityBar } from "@/components/Buildings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Operations · Campus Connect" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me, isLoading } = useMe();
  const { data } = useBuildings();
  const qc = useQueryClient();
  const logs = useQuery({
    queryKey: ["all-logs"],
    enabled: !!me?.isSupervisor,
    refetchInterval: 10000,
    queryFn: async () =>
      (await supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const [open, setOpen] = useState<string | null>(null);
  const [close, setClose] = useState<string | null>(null);

  if (isLoading) return null;
  if (!me?.isSupervisor)
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">Supervisors only</p>
        <Link to="/id" className="text-sm text-secondary underline">Back to my ID</Link>
      </div>
    );

  const bs = data?.buildings ?? [];
  const s = data?.settings;
  const total = bs.reduce((a, b) => a + b.occupancy, 0);
  const cap = bs.reduce((a, b) => a + b.capacity, 0);
  const alerts = bs.filter((b) => capacityLevel(b.occupancy, b.capacity, s?.near_capacity_pct).level !== "ok");
  const denied = (logs.data ?? []).filter((l) => !l.granted).length;

  async function saveCapacity(id: string, value: number) {
    const { error } = await supabase.from("buildings").update({ capacity: value }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Capacity updated"); qc.invalidateQueries({ queryKey: ["buildings"] }); }
  }
  async function resetOcc(id: string) {
    await supabase.from("buildings").update({ occupancy: 0 }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["buildings"] });
  }
  async function saveHours() {
    const { error } = await supabase
      .from("campus_settings")
      .update({ open_time: open ?? s?.open_time ?? "06:00", close_time: close ?? s?.close_time ?? "23:00" })
      .eq("id", 1);
    if (error) toast.error(error.message);
    else { toast.success("Campus hours saved"); qc.invalidateQueries({ queryKey: ["buildings"] }); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Facility operations</p>
        <h1 className="font-display text-3xl font-bold">Occupancy</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Inside", value: total },
          { icon: Building2, label: "Campus %", value: `${cap ? Math.round((total / cap) * 100) : 0}%` },
          { icon: AlertTriangle, label: "Denied", value: denied },
        ].map(({ icon: I, label, value }) => (
          <div key={label} className="rounded-2xl bg-primary p-3 text-primary-foreground">
            <I className="size-4 text-gold" />
            <p className="mt-2 font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-primary-foreground/70">{label}</p>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-warning bg-warning/15 p-4">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Capacity alerts</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.map((b) => (
              <li key={b.id}>{b.name}: {b.occupancy}/{b.capacity} ({capacityLevel(b.occupancy, b.capacity, s?.near_capacity_pct).label.toLowerCase()})</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Buildings</h2>
        {bs.map((b) => (
          <div key={b.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{b.name}</p>
              <span className="font-mono text-xs text-muted-foreground">{b.tag_code}{b.restricted && " · restricted"}</span>
            </div>
            <CapacityBar occ={b.occupancy} cap={b.capacity} nearPct={s?.near_capacity_pct} />
            <form
              className="mt-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(new FormData(e.currentTarget).get("cap"));
                if (v > 0) saveCapacity(b.id, v);
              }}
            >
              <div className="flex-1">
                <Label className="text-xs">Limit</Label>
                <Input name="cap" type="number" min={1} defaultValue={b.capacity} />
              </div>
              <Button type="submit" size="sm" variant="secondary">Save</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => resetOcc(b.id)}>Reset count</Button>
            </form>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Clock className="size-4" /> Campus hours</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Label className="text-xs">Opens</Label><Input type="time" defaultValue={s?.open_time?.slice(0, 5)} onChange={(e) => setOpen(e.target.value)} /></div>
          <div className="flex-1"><Label className="text-xs">Closes</Label><Input type="time" defaultValue={s?.close_time?.slice(0, 5)} onChange={(e) => setClose(e.target.value)} /></div>
          <Button size="sm" variant="gold" onClick={saveHours}>Save</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Taps outside these hours are denied as “After hours” ({s?.timezone}).</p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Live tap log</h2>
        <ul className="divide-y divide-border rounded-2xl bg-card shadow-sm">
          {(logs.data ?? []).length === 0 && <li className="p-4 text-sm text-muted-foreground">No taps yet.</li>}
          {(logs.data ?? []).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.student_name} <span className="font-mono text-xs text-muted-foreground">{l.student_number}</span></p>
                <p className="text-xs text-muted-foreground">{l.building_name} · {new Date(l.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${l.granted ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {l.granted ? (l.direction === "out" ? "Out" : "In") : l.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
