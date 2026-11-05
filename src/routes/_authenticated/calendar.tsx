import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar · Campus Connect" }] }),
  component: CalendarPage,
});

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

function CalendarPage() {
  const [day, setDay] = useState<Date>(new Date());
  const { data } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => {
      const [c, e] = await Promise.all([
        supabase.from("classes").select("*").order("start_time"),
        supabase.from("events").select("*").order("starts_at"),
      ]);
      return { classes: c.data ?? [], events: e.data ?? [] };
    },
  });
  const classes = (data?.classes ?? []).filter((c) => c.days.includes(day.getDay()));
  const events = (data?.events ?? []).filter((e) => new Date(e.starts_at).toDateString() === day.toDateString());
  const eventDays = (data?.events ?? []).map((e) => new Date(e.starts_at));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Calendar</h1>
      <div className="flex justify-center rounded-3xl bg-card p-2 shadow-sm">
        <Calendar
          mode="single"
          selected={day}
          onSelect={(d) => d && setDay(d)}
          modifiers={{ event: eventDays }}
          modifiersClassNames={{ event: "font-bold underline decoration-gold decoration-2 underline-offset-4" }}
        />
      </div>
      <h2 className="font-display text-lg font-semibold">
        {day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </h2>
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-2xl border-l-4 border-gold bg-card p-4 shadow-sm">
            <p className="font-semibold">{e.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(e.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {e.location}
            </p>
          </li>
        ))}
        {classes.map((c) => (
          <li key={c.id} className="rounded-2xl border-l-4 border-secondary bg-card p-4 shadow-sm">
            <p className="font-semibold">{c.code} · {c.title}</p>
            <p className="text-sm text-muted-foreground">{fmt(c.start_time)}–{fmt(c.end_time)} · {c.room}</p>
          </li>
        ))}
        {events.length + classes.length === 0 && <li className="text-sm text-muted-foreground">Nothing scheduled.</li>}
      </ul>
    </div>
  );
}
