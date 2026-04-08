import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Beaker, Plus, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  useEffect(() => {
    if (profile.data && !profile.data.hasCompletedOnboarding) {
      setLocation("/onboarding");
    }
  }, [profile.data, setLocation]);

  if (profile.isLoading || summary.isLoading) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-xl w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl" />)}
          </div>
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </Layout>
    );
  }

  const data = summary.data;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-1">
            Good brewing
          </h1>
          <p className="text-muted-foreground">Here is what is happening with your batches</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Active batches", value: data?.activeBatchCount ?? 0, testId: "stat-active-batches" },
            { label: "Total batches", value: data?.totalBatchCount ?? 0, testId: "stat-total-batches" },
            { label: "Total photos", value: data?.totalPhotoCount ?? 0, testId: "stat-total-photos" },
          ].map(({ label, value, testId }) => (
            <Card key={label} className="border-card-border">
              <CardContent className="p-4 text-center">
                <p data-testid={testId} className="text-2xl font-serif font-semibold text-primary">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active batches */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-semibold">Active batches</h2>
            <Link
              href="/batches"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {data?.activeBatches && data.activeBatches.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.activeBatches.map((batch: {id: number; name: string; daysSinceStart: number; teaType?: string | null; logCount: number}) => (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  data-testid={`card-batch-${batch.id}`}
                  className="block p-4 rounded-2xl border border-card-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Beaker size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{batch.name}</h3>
                        {batch.teaType && <p className="text-xs text-muted-foreground">{batch.teaType}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={12} />
                      Day {batch.daysSinceStart}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{batch.logCount} log{batch.logCount !== 1 ? "s" : ""}</span>
                    {batch.daysSinceStart >= 7 && (
                      <span className="text-secondary font-medium">Ready for F2?</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-2xl border border-dashed border-border">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Beaker size={24} className="text-primary" />
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2">No active batches</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Start your first batch and begin tracking your fermentation journey.
              </p>
              <Link href="/batches/new">
                <Button data-testid="button-new-batch-empty" size="sm">
                  <Plus size={16} className="mr-2" />
                  New batch
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Link href="/batches/new">
            <Button data-testid="button-quick-new-batch" size="sm" variant="outline" className="gap-2">
              <Plus size={16} />
              New batch
            </Button>
          </Link>
          <Link href="/advisor">
            <Button data-testid="button-quick-advisor" size="sm" variant="outline" className="gap-2">
              Ask advisor
            </Button>
          </Link>
        </div>

        {/* Recent logs */}
        {data?.recentLogs && data.recentLogs.length > 0 && (
          <div>
            <h2 className="text-lg font-serif font-semibold mb-4">Recent logs</h2>
            <div className="space-y-3">
              {data.recentLogs.map((log: {id: number; dayNumber: number; loggedAt: string; smell?: string | null; aiTip?: string | null; batchId: number}) => (
                <div
                  key={log.id}
                  data-testid={`log-item-${log.id}`}
                  className="p-4 rounded-xl border border-border bg-card"
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
                    <p className="text-xs text-primary/80 italic border-l-2 border-primary/30 pl-2">{log.aiTip}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
