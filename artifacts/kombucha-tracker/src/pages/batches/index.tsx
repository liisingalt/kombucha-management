import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useListBatches, getListBatchesQueryKey } from "@workspace/api-client-react";
import { Beaker, Plus, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  f1_complete: "bg-secondary/10 text-secondary",
  f2_complete: "bg-accent text-accent-foreground",
  archived: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  f1_complete: "F1 Complete",
  f2_complete: "F2 Complete",
  archived: "Archived",
};

export default function BatchesPage() {
  const batches = useListBatches({ query: { queryKey: getListBatchesQueryKey() } });

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold">Batches</h1>
            <p className="text-muted-foreground text-sm mt-1">All your fermentation runs</p>
          </div>
          <Link href="/batches/new">
            <Button data-testid="button-new-batch" size="sm" className="gap-2">
              <Plus size={16} />
              New batch
            </Button>
          </Link>
        </div>

        {batches.isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl" />)}
          </div>
        ) : batches.data && batches.data.length > 0 ? (
          <div className="space-y-3">
            {batches.data.map((batch) => (
              <Link key={batch.id} href={`/batches/${batch.id}`}>
                <a
                  data-testid={`card-batch-${batch.id}`}
                  className="block p-4 rounded-2xl border border-card-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Beaker size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{batch.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[batch.status] ?? "bg-muted text-muted-foreground"}`}>
                          {statusLabels[batch.status] ?? batch.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {batch.teaType && <span>{batch.teaType}</span>}
                        <span className="flex items-center gap-1"><Clock size={11} /> Day {batch.daysSinceStart}</span>
                        <span>{batch.logCount} log{batch.logCount !== 1 ? "s" : ""}</span>
                        <span>{batch.photoCount} photo{batch.photoCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </div>
                </a>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Beaker size={24} className="text-primary" />
            </div>
            <h3 className="font-serif font-semibold text-xl mb-2">No batches yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              Start your first fermentation batch and begin your brewing journey.
            </p>
            <Link href="/batches/new">
              <Button data-testid="button-new-batch-empty">
                <Plus size={16} className="mr-2" />
                New batch
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
