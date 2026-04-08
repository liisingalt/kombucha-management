import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { Plus, ArrowRight, CalendarDays, Beaker, Clock, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";

type BatchSummary = {
  id: number;
  name: string;
  daysSinceStart: number;
  teaType?: string | null;
  logCount: number;
  startedAt: string | Date;
};

type RecentLog = {
  id: number;
  dayNumber: number;
  loggedAt: string;
  smell?: string | null;
  aiTip?: string | null;
  batchId: number;
};

function WeekStrip({ activeBatch }: { activeBatch?: BatchSummary }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];

  const batchStart = activeBatch?.startedAt ? new Date(activeBatch.startedAt) : null;

  return (
    <div className="flex items-center justify-between px-1 py-2">
      {days.map((day, i) => {
        const todayDay = isToday(day);
        const fermentationDay = batchStart
          ? Math.floor((day.getTime() - batchStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          : null;
        const isBrewDay = fermentationDay !== null && fermentationDay > 0 && day <= today;

        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              {dayLetters[i]}
            </span>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                todayDay
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isBrewDay
                  ? "bg-primary/15 text-primary"
                  : "text-foreground/70"
              )}
            >
              {day.getDate()}
            </div>
            {/* Small dot if this was a brew day */}
            <div className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              isBrewDay && !todayDay ? "bg-primary/40" : "bg-transparent"
            )} />
          </div>
        );
      })}
    </div>
  );
}

function InsightCards({ activeBatch, recentLog }: {
  activeBatch?: BatchSummary;
  recentLog?: RecentLog;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto px-5 pb-2 pt-1 scrollbar-hide snap-x snap-mandatory">
      {/* Card 1: Add a log */}
      <Link
        href={activeBatch ? `/batches/${activeBatch.id}/log` : "/batches/new"}
        data-testid="insight-card-add-log"
        className="flex-none w-40 rounded-2xl bg-foreground p-4 flex flex-col justify-between min-h-[140px] snap-start hover:opacity-90 transition-opacity cursor-pointer"
      >
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
          <Plus size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide mb-0.5">
            {activeBatch ? "Daily log" : "Get started"}
          </p>
          <p className="text-white font-semibold text-sm leading-tight">
            {activeBatch ? "Log today's observations" : "Start your first batch"}
          </p>
        </div>
      </Link>

      {/* Card 2: Brew status */}
      <Link
        href={activeBatch ? `/batches/${activeBatch.id}` : "/batches"}
        data-testid="insight-card-brew-status"
        className="flex-none w-40 rounded-2xl bg-primary p-4 flex flex-col justify-between min-h-[140px] snap-start hover:opacity-90 transition-opacity cursor-pointer"
      >
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <Beaker size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide mb-0.5">
            Brew status
          </p>
          <p className="text-white font-semibold text-sm leading-tight">
            {activeBatch
              ? `Day ${activeBatch.daysSinceStart} · ${activeBatch.daysSinceStart >= 7 ? "Ready for F2?" : "Fermenting"}`
              : "No active batch"}
          </p>
        </div>
      </Link>

      {/* Card 3: SCOBY health */}
      <div
        data-testid="insight-card-scoby"
        className="flex-none w-40 rounded-2xl bg-amber-50 border border-amber-100 p-4 flex flex-col justify-between min-h-[140px] snap-start"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <span className="text-lg">🫙</span>
        </div>
        <div>
          <p className="text-amber-700/70 text-[10px] uppercase font-semibold tracking-wide mb-0.5">
            SCOBY health
          </p>
          <p className="text-amber-900 font-semibold text-sm leading-tight">
            {recentLog?.smell
              ? recentLog.smell === "good"
                ? "Smelling great"
                : recentLog.smell === "sour"
                ? "Nicely sour"
                : recentLog.smell === "vinegary"
                ? "Very acidic"
                : "Check needed"
              : "Log to track"}
          </p>
        </div>
      </div>

      {/* Card 4: AI tip */}
      {recentLog?.aiTip && (
        <div
          data-testid="insight-card-ai-tip"
          className="flex-none w-48 rounded-2xl bg-stone-900 p-4 flex flex-col justify-between min-h-[140px] snap-start"
        >
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="text-base">✨</span>
          </div>
          <div>
            <p className="text-white/50 text-[10px] uppercase font-semibold tracking-wide mb-0.5">
              AI tip
            </p>
            <p className="text-white/90 text-xs leading-relaxed line-clamp-4">
              {recentLog.aiTip}
            </p>
          </div>
        </div>
      )}

      {/* Spacer card to peek next */}
      <div className="flex-none w-2" />
    </div>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  useEffect(() => {
    if (profile.data && !profile.data.hasCompletedOnboarding) {
      setLocation("/onboarding");
    }
  }, [profile.data, setLocation]);

  const today = new Date();
  const data = summary.data;

  const primaryBatch: BatchSummary | undefined = data?.activeBatches?.[0] as BatchSummary | undefined;
  const recentLog: RecentLog | undefined = data?.recentLogs?.[0] as RecentLog | undefined;

  if (profile.isLoading || summary.isLoading) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto animate-pulse">
          <div className="h-24 bg-muted/50 mx-5 mt-5 rounded-2xl" />
          <div className="h-48 bg-muted/50 mx-5 mt-3 rounded-3xl" />
          <div className="flex gap-3 px-5 mt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-none w-40 h-36 bg-muted/50 rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">

        {/* Sticky top: date + week strip */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40 px-5 pb-1">
          <div className="flex items-center justify-between pt-4 pb-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {format(today, "EEEE")}
              </p>
              <h1 className="font-serif font-bold text-xl text-foreground">
                {format(today, "MMMM d")}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/batches" className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <CalendarDays size={20} />
              </Link>
            </div>
          </div>
          <WeekStrip activeBatch={primaryBatch} />
        </div>

        {/* Hero gradient section */}
        <div className="mx-5 mt-5 mb-1 rounded-3xl overflow-hidden">
          <div className={cn(
            "relative p-6",
            primaryBatch
              ? "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600"
              : "bg-gradient-to-br from-stone-300 via-stone-400 to-stone-500"
          )}>
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -mr-8 -mt-8" />
            <div className="absolute bottom-0 right-12 w-20 h-20 rounded-full bg-black/10 -mb-6" />

            <div className="relative z-10">
              {primaryBatch ? (
                <>
                  <div className="inline-flex items-center gap-1.5 text-white/80 text-xs font-semibold mb-3">
                    <Beaker size={13} />
                    {primaryBatch.teaType ?? "Kombucha"}
                  </div>
                  <h2 className="text-white font-bold text-3xl font-serif mb-1">
                    Fermentation day {primaryBatch.daysSinceStart}
                  </h2>
                  <button className="text-white/80 text-sm mb-5 flex items-center gap-1 hover:text-white transition-colors">
                    {primaryBatch.name}
                    <ChevronRight size={14} />
                  </button>
                  <div className="flex gap-2">
                    <Link href={`/batches/${primaryBatch.id}/log`}>
                      <Button
                        data-testid="button-log-today"
                        size="sm"
                        className="bg-white text-amber-700 hover:bg-white/90 font-semibold rounded-xl"
                      >
                        <Plus size={15} className="mr-1" />
                        Log today
                      </Button>
                    </Link>
                    <Link href={`/batches/${primaryBatch.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20 rounded-xl"
                      >
                        View batch
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-white/80 text-xs font-semibold mb-3">No active batch</div>
                  <h2 className="text-white font-bold text-2xl font-serif mb-2">
                    Start your first brew
                  </h2>
                  <p className="text-white/75 text-sm mb-5 leading-relaxed">
                    Begin tracking your fermentation journey today.
                  </p>
                  <Link href="/batches/new">
                    <Button
                      data-testid="button-new-batch-hero"
                      size="sm"
                      className="bg-white text-stone-700 hover:bg-white/90 font-semibold rounded-xl"
                    >
                      <Plus size={15} className="mr-1" />
                      New batch
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Today's insights */}
        <div className="mt-5 mb-1">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Today's insights <span className="text-muted-foreground font-normal">· {format(today, "MMM d")}</span>
            </h2>
          </div>
          <InsightCards activeBatch={primaryBatch} recentLog={recentLog} />
        </div>

        {/* All batches section */}
        {data?.activeBatches && data.activeBatches.length > 0 && (
          <div className="px-5 mt-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">My batches</h2>
              <Link
                href="/batches"
                className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
              >
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-2">
              {(data.activeBatches as BatchSummary[]).map((batch) => (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  data-testid={`card-batch-${batch.id}`}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Beaker size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">{batch.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {batch.teaType && `${batch.teaType} · `}
                      {batch.logCount} log{batch.logCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      Day {batch.daysSinceStart}
                    </div>
                    {batch.daysSinceStart >= 7 && (
                      <span className="text-[10px] text-amber-600 font-semibold">F2 ready?</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions when no batches */}
        {(!data?.activeBatches || data.activeBatches.length === 0) && (
          <div className="px-5 mt-4 mb-4 flex gap-2">
            <Link href="/batches/new" className="flex-1">
              <Button
                data-testid="button-quick-new-batch"
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
              >
                <Plus size={14} />
                New batch
              </Button>
            </Link>
            <Link href="/advisor" className="flex-1">
              <Button
                data-testid="button-quick-advisor"
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
              >
                Ask advisor
              </Button>
            </Link>
          </div>
        )}

        {/* Recent logs */}
        {data?.recentLogs && data.recentLogs.length > 0 && (
          <div className="px-5 mt-2 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">Recent logs</h2>
            <div className="space-y-2">
              {(data.recentLogs as RecentLog[]).map((log) => (
                <div
                  key={log.id}
                  data-testid={`log-item-${log.id}`}
                  className="p-3.5 rounded-xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Day {log.dayNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.loggedAt), "MMM d")}
                    </span>
                  </div>
                  {log.smell && (
                    <p className="text-xs text-muted-foreground mb-1">Smell: {log.smell}</p>
                  )}
                  {log.aiTip && (
                    <p className="text-xs text-primary/80 italic border-l-2 border-primary/30 pl-2 leading-relaxed">
                      {log.aiTip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row at bottom */}
        <div className="px-5 mb-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Active", value: data?.activeBatchCount ?? 0, testId: "stat-active-batches" },
              { label: "Total", value: data?.totalBatchCount ?? 0, testId: "stat-total-batches" },
              { label: "Photos", value: data?.totalPhotoCount ?? 0, testId: "stat-total-photos" },
            ].map(({ label, value, testId }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-2xl p-3 text-center"
              >
                <p data-testid={testId} className="text-xl font-serif font-bold text-primary">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
