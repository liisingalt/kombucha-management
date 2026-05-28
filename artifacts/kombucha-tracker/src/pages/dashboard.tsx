import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  useGetProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRight, Beaker, Sparkles, FlaskConical, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

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

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });

  const fermsQ = useQuery<FermBatch[]>({
    queryKey: ["dashboard-fermentations"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/fermentations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const flavEventsQ = useQuery<FlavEventMin[]>({
    queryKey: ["dashboard-flavoring-events"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/flavoring/events`, {
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

  const today = new Date();
  const fermBatches = fermsQ.data ?? [];
  const flavEvents = flavEventsQ.data ?? [];

  const activeFerms = fermBatches.filter((batch) => {
    const linkedEvent = flavEvents.find((e) => e.fermentationBatchId === batch.id);
    if (!linkedEvent?.bottlingDate) return true;
    return new Date(linkedEvent.bottlingDate) > new Date();
  }).slice(0, 8);

  const primaryFerm = activeFerms[0];
  const primaryFermDays = primaryFerm
    ? Math.floor((Date.now() - new Date(primaryFerm.startDate).getTime()) / 86400000)
    : 0;

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

        {/* Sticky header — brand + date */}
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

        {/* Hero gradient section */}
        <div className="mx-5 mt-5 mb-1 rounded-3xl overflow-hidden">
          <div className={cn(
            "relative p-6",
            primaryFerm
              ? "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600"
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
                  <h2 className="text-white font-bold text-3xl font-serif mb-1">
                    Käärimise päev {primaryFermDays}
                  </h2>
                  <p className="text-white/70 text-sm mb-5">
                    Algus: {new Date(primaryFerm.startDate).toLocaleDateString("et-EE")}
                  </p>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20 rounded-xl"
                      >
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

        {/* Quick navigation links */}
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

        {/* Protsessi vaade */}
        {activeFerms.length > 0 && (
          <div className="px-5 mt-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Protsess</h2>
              <Link href="/kaarimine" className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline">
                Kõik <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-2">
              {activeFerms.map((batch) => {
                const linkedEvent = flavEvents.find((e) => e.fermentationBatchId === batch.id);
                const daysSince = Math.floor(
                  (Date.now() - new Date(batch.startDate).getTime()) / 86400000
                );
                const hasFlavoringDate = !!batch.flavoringDate;
                const hasBottlingDate = !!linkedEvent?.bottlingDate;

                const stageColor = hasBottlingDate
                  ? "bg-purple-100 text-purple-700"
                  : hasFlavoringDate
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700";
                const stageLabel = hasBottlingDate
                  ? "Villimiseks"
                  : hasFlavoringDate
                  ? "Maitsestatud"
                  : "Käärimas";

                return (
                  <Link
                    key={batch.id}
                    href="/kaarimine"
                    className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-primary/20 transition-all"
                  >
                    <div className={cn("shrink-0 rounded-xl px-2 py-1 text-[10px] font-semibold", stageColor)}>
                      {stageLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {batch.teaSort || "tee märkimata"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(batch.startDate).toLocaleDateString("et-EE")}
                        {!hasFlavoringDate && ` · ${daysSince} päeva`}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      {hasFlavoringDate && (
                        <div className="text-[11px] text-green-700">
                          🍵 {new Date(batch.flavoringDate!).toLocaleDateString("et-EE")}
                        </div>
                      )}
                      {hasBottlingDate && (
                        <div className="text-[11px] text-purple-700">
                          🍾 {new Date(linkedEvent!.bottlingDate!).toLocaleDateString("et-EE")}
                        </div>
                      )}
                      {!hasFlavoringDate && (
                        <div className="text-[11px] text-muted-foreground">maitsestamine ootel</div>
                      )}
                    </div>
                  </Link>
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
