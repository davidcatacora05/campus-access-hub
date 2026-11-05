import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes · Campus Connect" }] }),
  component: ClassesPage,
});

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

function ClassesPage() {
  const { data = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("start_time")).data ?? [],
  });
  const today = new Date().getDay();
  const todays = data.filter((c) => c.days.includes(today));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Classes</h1>
        <p className="text-sm text-muted-foreground">{todays.length} today</p>
      </div>
      <div className="space-y-3">
        {data.map((c) => {
          const isToday = c.days.includes(today);
          return (
            <div key={c.id} className={`rounded-2xl p-4 shadow-sm ${isToday ? "bg-primary text-primary-foreground" : "bg-card"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-bold tracking-wider ${isToday ? "text-gold" : "text-secondary"}`}>{c.code}</p>
                  <p className="font-display text-lg font-semibold">{c.title}</p>
                </div>
                {isToday && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground">Today</span>}
              </div>
              <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm ${isToday ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                <span className="flex items-center gap-1"><Clock className="size-3.5" />{c.days.map((d) => DAYS[d]).join(" · ")} {fmtTime(c.start_time)}–{fmtTime(c.end_time)}</span>
                <span className="flex items-center gap-1"><MapPin className="size-3.5" />{c.room}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
