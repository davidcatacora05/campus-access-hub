import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { tapBuilding, parseTag, type TapResult } from "@/lib/session";
import { TapResultOverlay } from "@/components/Buildings";

// NFC tags can store a URL like https://<app>/tap/LIB-01 — tapping opens this page on any phone.
export const Route = createFileRoute("/_authenticated/tap/$code")({
  head: () => ({ meta: [{ title: "Tapping in · Campus Connect" }] }),
  component: TapPage,
});

function TapPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<TapResult | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    tapBuilding(parseTag(code))
      .then(setResult)
      .catch(() => setResult({ granted: false, reason: "Tap failed" }));
  }, [code]);

  if (!result) return <p className="py-20 text-center text-muted-foreground">Checking access…</p>;
  return <TapResultOverlay result={result} onClose={() => navigate({ to: "/id" })} />;
}
