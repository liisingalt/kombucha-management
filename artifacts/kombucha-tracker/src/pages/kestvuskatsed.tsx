import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { format, differenceInDays } from "date-fns";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, FlaskConical, Trash2, CheckCircle, ChevronDown, ChevronUp, X } from "lucide-react";

type BottleTest = {
  id: number;
  product: string;
  bottleId: string;
  bottledDate: string;
  intervalMonths: number;
  nextTasting: string;
  status: "ootab" | "maitsitud";
  result: string | null;
  conclusion: string | null;
  tastedDate: string | null;
  createdAt: string;
};

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function urgencyClass(nextTasting: string) {
  const days = differenceInDays(new Date(nextTasting), new Date());
  if (days < 0) return "border-l-red-500 bg-red-50 dark:bg-red-950/20";
  if (days <= 7) return "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20";
  return "border-l-green-500 bg-green-50 dark:bg-green-950/20";
}

function urgencyBadge(nextTasting: string) {
  const days = differenceInDays(new Date(nextTasting), new Date());
  if (days < 0)
    return { label: `${Math.abs(days)}p hilinenud`, cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
  if (days === 0) return { label: "Täna!", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  if (days <= 7)
    return { label: `${days}p jäänud`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return { label: `${days}p jäänud`, cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function KestvuskatsedPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<BottleTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    product: "",
    bottleId: "",
    bottledDate: todayISO(),
    intervalMonths: 1,
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [tasteTarget, setTasteTarget] = useState<BottleTest | null>(null);
  const [tasteForm, setTasteForm] = useState({ result: "", conclusion: "" });
  const [tasteError, setTasteError] = useState<string | null>(null);
  const [tasteLoading, setTasteLoading] = useState(false);

  const [tastedOpen, setTastedOpen] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Laadimine ebaõnnestus");
      const data = await res.json();
      setItems(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Viga");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const waiting = items
    .filter((i) => i.status === "ootab")
    .sort((a, b) => new Date(a.nextTasting).getTime() - new Date(b.nextTasting).getTime());

  const tasted = items
    .filter((i) => i.status === "maitsitud")
    .sort((a, b) => new Date(b.tastedDate ?? 0).getTime() - new Date(a.tastedDate ?? 0).getTime());

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addForm.product.trim() || !addForm.bottleId.trim()) {
      setAddError("Toote nimi ja pudeli ID on kohustuslikud.");
      return;
    }
    setAddLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product: addForm.product.trim(),
          bottleId: addForm.bottleId.trim(),
          bottledDate: addForm.bottledDate,
          intervalMonths: Number(addForm.intervalMonths),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Viga");
      }
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setShowAddModal(false);
      setAddForm({ product: "", bottleId: "", bottledDate: todayISO(), intervalMonths: 1 });
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Viga");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleTaste(e: React.FormEvent) {
    e.preventDefault();
    if (!tasteTarget) return;
    setTasteError(null);
    if (!tasteForm.result.trim() || !tasteForm.conclusion.trim()) {
      setTasteError("Tulemus ja järeldus on kohustuslikud.");
      return;
    }
    setTasteLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests/${tasteTarget.id}/taste`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ result: tasteForm.result.trim(), conclusion: tasteForm.conclusion.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Viga");
      }
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setTasteTarget(null);
      setTasteForm({ result: "", conclusion: "" });
    } catch (e: unknown) {
      setTasteError(e instanceof Error ? e.message : "Viga");
    } finally {
      setTasteLoading(false);
    }
  }

  async function handleDelete(item: BottleTest) {
    if (!confirm(`Kustuta "${item.product} (${item.bottleId})"?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Viga");
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Kustutamine ebaõnnestus");
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-2">
          <FlaskConical size={20} className="text-primary" />
          <h1 className="font-serif font-semibold text-xl">Kestvuskatsed</h1>
        </div>
        <Button
          data-testid="button-add-test"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={15} />
          Lisa uus
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-8">
        {/* Loading / error */}
        {loading && (
          <p className="text-muted-foreground text-sm text-center py-12">Laadin...</p>
        )}
        {error && (
          <p className="text-red-600 text-sm text-center py-12">{error}</p>
        )}

        {!loading && !error && (
          <>
            {/* Waiting section */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                Ootavad ({waiting.length})
              </h2>

              {waiting.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                  Ühtegi ootavat katset ei ole.{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setShowAddModal(true)}
                  >
                    Lisa esimene
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {waiting.map((item) => {
                  const badge = urgencyBadge(item.nextTasting);
                  return (
                    <div
                      key={item.id}
                      data-testid={`card-test-${item.id}`}
                      className={cn(
                        "rounded-2xl border border-border border-l-4 p-4 transition-all",
                        urgencyClass(item.nextTasting)
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-base text-foreground">{item.product}</span>
                            <span className="text-xs text-muted-foreground font-mono bg-muted rounded px-1.5 py-0.5">
                              {item.bottleId}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Villitud: {format(new Date(item.bottledDate), "d. MMM yyyy")} · {item.intervalMonths} kuu intervall
                          </p>
                          <p className="text-xs text-foreground/80 mb-2">
                            Järgmine maitsmine:{" "}
                            <strong>{format(new Date(item.nextTasting), "d. MMM yyyy")}</strong>
                          </p>
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", badge.cls)}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Button
                            data-testid={`button-taste-${item.id}`}
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8"
                            onClick={() => {
                              setTasteTarget(item);
                              setTasteForm({ result: "", conclusion: "" });
                              setTasteError(null);
                            }}
                          >
                            <CheckCircle size={13} />
                            Maitsitud
                          </Button>
                          <Button
                            data-testid={`button-delete-${item.id}`}
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs h-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 size={13} />
                            Kustuta
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Tasted results section */}
            {tasted.length > 0 && (
              <section>
                <button
                  className="flex items-center gap-2 w-full text-left mb-3"
                  onClick={() => setTastedOpen((o) => !o)}
                >
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex-1">
                    Maitsitud tulemused ({tasted.length})
                  </h2>
                  {tastedOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>

                {tastedOpen && (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
                      <table className="w-full text-sm" data-testid="tasted-table">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Toode</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Pudeli ID</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Villitud</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Maitsitud</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Tulemus</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase">Järeldus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasted.map((item, idx) => (
                            <tr
                              key={item.id}
                              data-testid={`tasted-row-${item.id}`}
                              className={cn(
                                "border-b border-border last:border-0 transition-colors",
                                idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                              )}
                            >
                              <td className="px-4 py-3 font-medium">{item.product}</td>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.bottleId}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(item.bottledDate), "d. MMM yyyy")}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {item.tastedDate ? format(new Date(item.tastedDate), "d. MMM yyyy") : "—"}
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                <span className="text-xs line-clamp-2">{item.result ?? "—"}</span>
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                <span className="text-xs line-clamp-2 text-muted-foreground">{item.conclusion ?? "—"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3" data-testid="tasted-table">
                      {tasted.map((item) => (
                        <div
                          key={item.id}
                          data-testid={`tasted-row-${item.id}`}
                          className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{item.product}</span>
                            <span className="font-mono text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">{item.bottleId}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Villitud: </span>
                              {format(new Date(item.bottledDate), "d. MMM yyyy")}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Maitsitud: </span>
                              {item.tastedDate ? format(new Date(item.tastedDate), "d. MMM yyyy") : "—"}
                            </div>
                          </div>
                          {item.result && (
                            <div className="text-xs">
                              <span className="text-muted-foreground font-medium">Tulemus: </span>
                              {item.result}
                            </div>
                          )}
                          {item.conclusion && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Järeldus: </span>
                              {item.conclusion}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-semibold text-lg">Lisa kestvuskatse</h2>
              <button
                onClick={() => { setShowAddModal(false); setAddError(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Toote nimi</label>
                <input
                  data-testid="input-product"
                  type="text"
                  required
                  placeholder="nt. Maasika F2"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={addForm.product}
                  onChange={(e) => setAddForm((f) => ({ ...f, product: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Pudeli ID</label>
                <input
                  data-testid="input-bottle-id"
                  type="text"
                  required
                  placeholder="nt. P-01"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={addForm.bottleId}
                  onChange={(e) => setAddForm((f) => ({ ...f, bottleId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Villimise kuupäev</label>
                <input
                  data-testid="input-bottled-date"
                  type="date"
                  required
                  max={todayISO()}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={addForm.bottledDate}
                  onChange={(e) => setAddForm((f) => ({ ...f, bottledDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Maitsemisintervall (kuudes)</label>
                <input
                  data-testid="input-interval-months"
                  type="number"
                  required
                  min={1}
                  max={120}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={addForm.intervalMonths}
                  onChange={(e) => setAddForm((f) => ({ ...f, intervalMonths: Number(e.target.value) }))}
                />
              </div>
              {addError && <p className="text-red-600 text-sm">{addError}</p>}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowAddModal(false); setAddError(null); }}
                >
                  Tühista
                </Button>
                <Button
                  data-testid="button-submit-test"
                  type="submit"
                  className="flex-1"
                  disabled={addLoading}
                >
                  {addLoading ? "Salvestan..." : "Lisa katse"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Taste modal */}
      {tasteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-serif font-semibold text-lg">Maitsimise tulemus</h2>
              <button
                onClick={() => { setTasteTarget(null); setTasteError(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {tasteTarget.product} · {tasteTarget.bottleId}
            </p>
            <form onSubmit={handleTaste} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Tulemus</label>
                <textarea
                  data-testid="input-taste-result"
                  required
                  rows={3}
                  placeholder="Kirjelda maitset, lõhna, karbonisatsiooni..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={tasteForm.result}
                  onChange={(e) => setTasteForm((f) => ({ ...f, result: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Järeldus</label>
                <textarea
                  data-testid="input-taste-conclusion"
                  required
                  rows={3}
                  placeholder="Mida muudad järgmine kord? Kas jätkad?"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={tasteForm.conclusion}
                  onChange={(e) => setTasteForm((f) => ({ ...f, conclusion: e.target.value }))}
                />
              </div>
              {tasteError && <p className="text-red-600 text-sm">{tasteError}</p>}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setTasteTarget(null); setTasteError(null); }}
                >
                  Tühista
                </Button>
                <Button
                  data-testid="button-submit-taste"
                  type="submit"
                  className="flex-1"
                  disabled={tasteLoading}
                >
                  {tasteLoading ? "Salvestan..." : "Salvesta tulemus"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
