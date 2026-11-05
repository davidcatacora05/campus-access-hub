import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      return {
        user: u.user,
        profile,
        isSupervisor: (roles ?? []).some((r) => r.role === "supervisor"),
      };
    },
  });
}

export type TapResult = {
  granted: boolean;
  reason?: string;
  direction?: "in" | "out";
  building?: string;
  name?: string;
  at?: string;
};

export async function tapBuilding(tag: string): Promise<TapResult> {
  const { data, error } = await supabase.rpc("tap_building", { _tag: tag });
  if (error) throw error;
  return data as unknown as TapResult;
}

export function capacityLevel(occ: number, cap: number, nearPct = 80) {
  const pct = Math.round((occ / cap) * 100);
  if (occ >= cap) return { pct, level: "full" as const, label: "At capacity" };
  if (pct >= nearPct) return { pct, level: "near" as const, label: "Near capacity" };
  return { pct, level: "ok" as const, label: "Open" };
}

/** Extract building tag code from an NFC record payload (plain text or /tap/CODE URL). */
export function parseTag(raw: string): string {
  const t = raw.trim();
  const m = t.match(/\/tap\/([^/?#]+)/);
  return decodeURIComponent(m?.[1] ?? t).toUpperCase();
}
