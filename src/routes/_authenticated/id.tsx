import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Nfc, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, tapBuilding, parseTag, capacityLevel, type TapResult } from "@/lib/session";
import { useBuildings, CapacityBar, TapResultOverlay } from "@/components/Buildings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/id")({
  head: () => ({ meta: [{ title: "Student ID · Campus Connect" }] }),
  component: IdPage,
});

type NDEFReaderLike = {
  scan: (o?: { signal?: AbortSignal }) => Promise<void>;
  onreading: ((e: { message: { records: { recordType: string; data?: DataView; encoding?: string }[] } }) => void) | null;
  onreadingerror: (() => void) | null;
};

function IdPage() {
  const { data: me } = useMe();
  const { data } = useBuildings();
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<TapResult | null>(null);
  const [manual, setManual] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  useEffect(() => setNfcSupported("NDEFReader" in window), []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const history = useQuery({
    queryKey: ["my-logs"],
    queryFn: async () =>
      (await supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  async function doTap(tag: string) {
    try {
      const r = await tapBuilding(tag);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["my-logs"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if ("vibrate" in navigator) navigator.vibrate(r.granted ? 80 : [80, 60, 80]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tap failed");
    }
  }

  async function startScan() {
    if (!nfcSupported) return;
    try {
      const Reader = (window as unknown as { NDEFReader: new () => NDEFReaderLike }).NDEFReader;
      const reader = new Reader();
      abortRef.current = new AbortController();
      await reader.scan({ signal: abortRef.current.signal });
      setScanning(true);
      reader.onreading = (e) => {
        const rec = e.message.records[0];
        if (!rec?.data) return;
        const text = new TextDecoder(rec.encoding || "utf-8").decode(rec.data);
        abortRef.current?.abort();
        setScanning(false);
        doTap(parseTag(text));
      };
      reader.onreadingerror = () => toast.error("Couldn't read that tag. Try again.");
    } catch (e) {
      setScanning(false);
      toast.error(e instanceof Error ? e.message : "NFC permission denied");
    }
  }

  const near = (data?.buildings ?? []).filter(
    (b) => capacityLevel(b.occupancy, b.capacity, data?.settings?.near_capacity_pct).level !== "ok",
  );

  return (
    <div className="space-y-6">
      {result && <TapResultOverlay result={result} onClose={() => setResult(null)} />}

      <div className="relative overflow-hidden rounded-3xl bg-idcard p-6 text-primary-foreground shadow-card">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-gold/20" />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Campus Connect · Student</p>
        <div className="mt-6 flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-gold font-display text-2xl font-bold text-gold-foreground">
            {(me?.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-2xl font-semibold leading-tight">{me?.profile?.full_name ?? "…"}</p>
            <p className="font-mono text-sm tracking-widest text-primary-foreground/75">{me?.profile?.student_number}</p>
          </div>
        </div>
        <p className="mt-6 text-xs text-primary-foreground/60">{me?.user.email}</p>
      </div>

      <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
        <div className="relative mx-auto grid size-28 place-items-center">
          {scanning && <span className="absolute inset-0 rounded-full bg-gold/50 animate-nfc" />}
          <span className="relative grid size-20 place-items-center rounded-full bg-primary text-gold">
            <Nfc className="size-9" />
          </span>
        </div>
        {nfcSupported ? (
          <>
            <p className="mt-3 font-semibold">{scanning ? "Hold your phone near the door tag" : "Ready to tap in"}</p>
            <Button variant="gold" size="lg" className="mt-4 w-full" onClick={startScan} disabled={scanning}>
              {scanning ? "Scanning…" : "Tap in with NFC"}
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Hold your phone to a building's tag — it opens Campus Connect and checks you in. In-app scanning works on Android Chrome.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Select value={manual} onValueChange={setManual}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Or pick a building" />
            </SelectTrigger>
            <SelectContent>
              {(data?.buildings ?? []).map((b) => (
                <SelectItem key={b.id} value={b.tag_code}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!manual} onClick={() => doTap(manual)}>
            Tap
          </Button>
        </div>
      </div>

      {near.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <AlertTriangle className="size-4 text-warning" /> Busy right now
          </h2>
          <div className="space-y-3">
            {near.map((b) => (
              <div key={b.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <p className="mb-2 font-semibold">{b.name}</p>
                <CapacityBar occ={b.occupancy} cap={b.capacity} nearPct={data?.settings?.near_capacity_pct} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">All buildings</h2>
        <div className="space-y-3">
          {(data?.buildings ?? []).map((b) => (
            <div key={b.id} className="rounded-2xl bg-card p-4 shadow-sm">
              <p className="mb-2 font-semibold">{b.name}</p>
              <CapacityBar occ={b.occupancy} cap={b.capacity} nearPct={data?.settings?.near_capacity_pct} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">My recent taps</h2>
        <ul className="divide-y divide-border rounded-2xl bg-card shadow-sm">
          {(history.data ?? []).length === 0 && <li className="p-4 text-sm text-muted-foreground">No taps yet.</li>}
          {(history.data ?? []).map((l) => (
            <li key={l.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{l.building_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.granted ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {l.granted ? (l.direction === "out" ? "Out" : "In") : l.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
