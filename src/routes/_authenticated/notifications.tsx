import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBuildings } from "@/components/Buildings";
import { capacityLevel } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Campus Connect" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: b } = useBuildings();
  const busy = (b?.buildings ?? []).filter((x) => capacityLevel(x.occupancy, x.capacity, b?.settings?.near_capacity_pct).level !== "ok");

  useEffect(() => {
    if (data.some((n) => !n.read)) {
      supabase.from("notifications").update({ read: true }).eq("read", false).then(() => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      });
    }
  }, [data, qc]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Notifications</h1>
      {busy.map((x) => (
        <div key={x.id} className="rounded-2xl bg-warning/20 p-4">
          <p className="font-semibold">{x.name} is {x.occupancy >= x.capacity ? "at capacity" : "near capacity"}</p>
          <p className="text-sm text-muted-foreground">{x.occupancy} of {x.capacity} spots taken</p>
        </div>
      ))}
      <ul className="space-y-2">
        {data.map((n) => (
          <li key={n.id} className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <span className={`mt-1 grid size-8 shrink-0 place-items-center rounded-full ${n.read ? "bg-muted" : "bg-gold"}`}>
              <Bell className="size-4" />
            </span>
            <div>
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
