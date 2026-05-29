import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  useGetProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRight, Beaker, Sparkles, FlaskConical, Package, Pencil, Check, X as XIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { API_BASE } from "@/lib/apiBase";
const F2_EST_DAYS = 3;

type FermBatch = {
  id: number;
  teaSort: string;
  startDate: string;
  flavoringDate: string | null;
};

type FlavEventMin = {
  id: number;
  date: string;
  bottlingDate: string | null;
  fermentationBatchId: number | null;
};

function daysBetween(from: string, to?: string): number {
  const toTime = to ? new Date(to).getTime() : Date.now();
  return Math.floor((toTime - new Date(from).getTime()) / 86400000);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("et-EE", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const [editBottlingFor, setEditBottlingFor] = useState<number | null>(null);
  const [editBottlingDate, setEditBottlingDate] = useState("");
  const [savingBottling, setSavingBottling] = useState(false);

  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });

  const fermsQ = useQuery<FermBatch[]>({
    queryKey: ["dashboard-fermentations"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/fermentations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const flavEventsQ = useQuery<FlavEventMin[]>({
    queryKey: ["dashboard-flavoring-events"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/flavoring/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (profile.data && !profile.data.hasCompletedOnboarding) {
      setLocation("/onboarding");
    }
  }, [profile.data, setLocation]);

  async function saveBottlingDate(flavoringEventId: number, date: string) {
    setSavingBottling(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/api/flavoring/events/${flavoringEventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bottlingDate: date || null }),
      });
      await flavEventsQ.refetch();
      setEditBottlingFor(null);
    } finally {
      setSavingBottling(false);
    }
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const fermBatches = fermsQ.data ?? [];
  const flavEvents = flavEventsQ.data ?? [];

  const activeFerms = fermBatches.filter((batch) => {
    const linkedEvent = flavEvents.find((e) => e.fermentationBatchId === batch.id);
    if (!linkedEvent?.bottlingDate) return true;
    return linkedEvent.bottlingDate >= todayISO;
  }).slice(0, 8);

  const primaryFerm = activeFerms[0];
  const primaryLinkedEvent = primaryFerm
    ? flavEvents.find((e) => e.fermentationBatchId === primaryFerm.id)
    : undefined;

  const primaryHasF2 = !!primaryFerm?.flavoringDate;
  const f1Days = primaryFerm ? daysBetween(primaryFerm.startDate) : 0;
  const f2Days = primaryHasF2 ? daysBetween(primaryFerm!.flavoringDate!) : 0;
  const primaryBottlingDate = primaryLinkedEvent?.bottlingDate ?? null;
  const primaryEstBottling = primaryHasF2 && !primaryBottlingDate
    ? addDays(primaryFerm!.flavoringDate!, F2_EST_DAYS)
    : null;
  const effectiveBottling = primaryBottlingDate ?? primaryEstBottling;
  const daysToBottle = effectiveBottling
    ? daysBetween(todayISO, effectiveBottling)
    : null;

  if (profile.isLoading) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto animate-pulse">
          <div className="h-24 bg-muted/50 mx-5 mt-5 rounded-2xl" />
          <div className="h-48 bg-muted/50 mx-5 mt-3 rounded-3xl" />
          <div className="flex gap-3 px-5 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-none w-20 h-24 bg-muted/50 rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">

        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40 px-5 pb-3">
          <div className="flex items-center justify-between pt-4">
            <div>
              <Link href="/dashboard" className="font-serif text-base font-bold text-primary tracking-tight">
                Kombucha
              </Link>
              <p className="text-xs text-muted-foreground font-medium leading-tight">
                {format(today, "EEEE, MMMM d")}
              </p>
            </div>
          </div>
        </div>

        {/* Hero gradient */}
        <div className="mx-5 mt-5 mb-1 rounded-3xl overflow-hidden">
          <div className={cn(
            "relative p-6",
            primaryFerm
              ? primaryHasF2
                ? "bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600"
                : "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600"
              : "bg-gradient-to-br from-stone-300 via-stone-400 to-stone-500"
          )}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -mr-8 -mt-8" />
            <div className="absolute bottom-0 right-12 w-20 h-20 rounded-full bg-black/10 -mb-6" />

            <div className="relative z-10">
              {primaryFerm ? (
                <>
                  <div className="inline-flex items-center gap-1.5 text-white/80 text-xs font-semibold mb-3">
                    <Beaker size={13} />
                    {primaryFerm.teaSort || "Kombucha"}
                  </div>

                  {!primaryHasF2 ? (
                    <>
                      <h2 className="text-white font-bold text-3xl font-serif mb-1">
                        F1 · päev {f1Days}
                      </h2>
                      <p className="text-white/70 text-sm mb-5">
                        🍵 Algus {fmtShort(primaryFerm.startDate)}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-white font-bold text-3xl font-serif mb-1">
                        F2 · päev {f2Days}
                      </h2>
                      <p className="text-white/80 text-sm mb-1">
                        🍓 Maitsestamine {fmtShort(primaryFerm.flavoringDate)}
                      </p>
                      {daysToBottle !== null && (
                        <p className="text-white/70 text-xs mb-4">
                          {daysToBottle > 0
                            ? `🍾 Villimiseni ${daysToBottle} päeva`
                            : daysToBottle === 0
                            ? "🍾 Villimispäev täna!"
                            : `🍾 Villimispäev ${Math.abs(daysToBottle)}p tagasi`}
                          {primaryEstBottling && " (hinnang)"}
                        </p>
                      )}
                      {daysToBottle === null && <p className="text-white/70 text-xs mb-4">🍾 Villimiskuupäev määramata</p>}
                    </>
                  )}

                  <div className="flex gap-2">
                    <Link href="/kaarimine">
                      <Button
                        data-testid="button-log-today"
                        size="sm"
                        className="bg-white text-amber-700 hover:bg-white/90 font-semibold rounded-xl"
                      >
                        <Plus size={15} className="mr-1" />
                        Lisa märge
                      </Button>
                    </Link>
                    <Link href="/kaarimine">
                      <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 rounded-xl">
                        Vaata
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-white/80 text-xs font-semibold mb-3">Aktiivne partii puudub</div>
                  <h2 className="text-white font-bold text-2xl font-serif mb-2">
                    Alusta oma esimest pruulimist
                  </h2>
                  <p className="text-white/75 text-sm mb-5 leading-relaxed">
                    Jälgi oma kombucha teekonda algusest pudelini.
                  </p>
                  <Link href="/valmistamine">
                    <Button
                      data-testid="button-new-batch-hero"
                      size="sm"
                      className="bg-white text-stone-700 hover:bg-white/90 font-semibold rounded-xl"
                    >
                      <Plus size={15} className="mr-1" />
                      Uus partii
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick nav */}
        <div className="px-5 mt-4 mb-1">
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: "/ladu", label: "Ladu", icon: Package, color: "bg-stone-100 text-stone-700" },
              { href: "/valmistamine", label: "Valmist.", icon: FlaskConical, color: "bg-blue-100 text-blue-700" },
              { href: "/kaarimine", label: "Käärimine", icon: Beaker, color: "bg-amber-100 text-amber-700" },
              { href: "/maitsestamine", label: "Maitsest.", icon: Sparkles, color: "bg-green-100 text-green-700" },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                data-testid={`quick-link-${label.toLowerCase()}`}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-card hover:border-primary/20 transition-all"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}>
                  <Icon size={18} />
                </div>
                <span className="text-[11px] font-medium text-foreground">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Process view */}
        {activeFerms.length > 0 && (
          <div className="px-5 mt-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Protsess</h2>
              <Link href="/kaarimine" className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline">
                Kõik <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-3">
              {activeFerms.map((batch) => {
                const linkedEvent = flavEvents.find((e) => e.fermentationBatchId === batch.id);
                const hasF2 = !!batch.flavoringDate;
                const hasBottling = !!linkedEvent?.bottlingDate;
                const estBottling = hasF2 && !hasBottling
                  ? addDays(batch.flavoringDate!, F2_EST_DAYS)
                  : null;
                const bottlingToShow = linkedEvent?.bottlingDate ?? estBottling;
                const isBottlingFuture = bottlingToShow ? bottlingToShow >= todayISO : false;
                const canEditBottling = hasF2 && !!linkedEvent && (isBottlingFuture || !bottlingToShow);
                const isEditingThis = editBottlingFor === linkedEvent?.id;
                const f1d = daysBetween(batch.startDate);
                const f2d = hasF2 ? daysBetween(batch.flavoringDate!) : null;

                const stageColor = hasBottling
                  ? "bg-purple-100 text-purple-700"
                  : hasF2
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700";
                const stageLabel = hasBottling
                  ? "Villimiseks"
                  : hasF2 && f2d !== null
                  ? `F2 · ${f2d}p`
                  : `F1 · ${f1d}p`;

                return (
                  <div key={batch.id} className="rounded-2xl border border-border bg-card p-3 space-y-3">
                    {/* Top row: stage badge + name */}
                    <div className="flex items-center gap-2">
                      <div className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold", stageColor)}>
                        {stageLabel}
                      </div>
                      <Link href="/kaarimine" className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-foreground truncate block hover:underline">
                          {batch.teaSort || "tee märkimata"}
                        </span>
                      </Link>
                    </div>

                    {/* Milestone strip: 🍵 ── 🍓 ── 🍾 */}
                    <div className="flex items-start gap-0">

                      {/* 🍵 Pruulimine/start */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 w-14">
                        <span className="text-lg">🍵</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">
                          {fmtShort(batch.startDate)}
                        </span>
                      </div>

                      {/* Connector line F1→F2 */}
                      <div className="flex-1 pt-3 px-1">
                        <div className={cn("h-px w-full rounded", hasF2 ? "bg-green-400" : "bg-stone-200")} />
                      </div>

                      {/* 🍓 Maitsestamine */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 w-16">
                        <span className={cn("text-lg", !hasF2 && "opacity-25")}>🍓</span>
                        <span className={cn("text-[10px] text-center leading-tight", hasF2 ? "text-muted-foreground" : "text-muted-foreground/40")}>
                          {hasF2 ? fmtShort(batch.flavoringDate) : "ootel"}
                        </span>
                      </div>

                      {/* Connector line F2→villim */}
                      <div className="flex-1 pt-3 px-1">
                        <div className={cn(
                          "h-px w-full rounded",
                          hasBottling ? "bg-purple-400" : hasF2 ? "bg-stone-200 border-dashed" : "bg-stone-100"
                        )} />
                      </div>

                      {/* 🍾 Pudeldamine */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 w-20">
                        <span className={cn("text-lg", !hasF2 && "opacity-25")}>🍾</span>

                        {isEditingThis && linkedEvent ? (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="date"
                              value={editBottlingDate}
                              min={todayISO}
                              onChange={(e) => setEditBottlingDate(e.target.value)}
                              className="text-[10px] border rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => saveBottlingDate(linkedEvent.id, editBottlingDate)}
                                disabled={savingBottling || !editBottlingDate}
                                className="text-green-600 hover:text-green-800 disabled:opacity-40"
                              >
                                {savingBottling
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <Check size={11} />}
                              </button>
                              <button onClick={() => setEditBottlingFor(null)} className="text-muted-foreground hover:text-foreground">
                                <XIcon size={11} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={cn("text-[10px] text-center leading-tight", hasF2 ? "text-muted-foreground" : "text-muted-foreground/40")}>
                              {bottlingToShow ? fmtShort(bottlingToShow) : hasF2 ? "määramata" : "ootel"}
                              {estBottling && !hasBottling && hasF2 && (
                                <span className="text-muted-foreground/60"> (est.)</span>
                              )}
                            </span>
                            {canEditBottling && !isEditingThis && linkedEvent && (
                              <button
                                onClick={() => {
                                  setEditBottlingFor(linkedEvent.id);
                                  setEditBottlingDate(
                                    bottlingToShow && bottlingToShow >= todayISO
                                      ? bottlingToShow
                                      : addDays(batch.flavoringDate!, F2_EST_DAYS)
                                  );
                                }}
                                className="text-muted-foreground/60 hover:text-amber-700 transition-colors"
                                title="Muuda villimiskuupäeva"
                              >
                                <Pencil size={9} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeFerms.length === 0 && !fermsQ.isLoading && (
          <div className="px-5 mt-4 mb-6">
            <div className="text-center py-10 rounded-2xl border border-dashed border-border bg-card/50">
              <p className="text-sm text-muted-foreground mb-3">Aktiivseid käärimisi pole</p>
              <Link href="/kaarimine">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus size={14} />
                  Lisa käärimine
                </Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
