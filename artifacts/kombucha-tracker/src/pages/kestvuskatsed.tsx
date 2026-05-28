import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { format, differenceInDays } from "date-fns";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, FlaskConical, Trash2, CheckCircle, X, Download, Pencil, ChevronDown, ChevronUp, Sparkles, Loader2, GitBranch, BarChart2 } from "lucide-react";

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
  flavoringEventId: number | null;
};

type FlavEventBlock = { name: string; koguseL: number; vesselL: number; gramsUsed: number; coefficient: number };

type FlavEvent = {
  id: number;
  date: string;
  bottlingDate: string | null;
  fermentationBatchId: number | null;
  blocks: FlavEventBlock[];
  notes: string | null;
};

type StatsGroup = {
  label: string;
  count: number;
  avgDays: number;
  avgAllDays: number;
  minDays: number;
  maxDays: number;
  heaCount: number;
};

type AnalyticsData = {
  totalCompleted: number;
  heaCount: number;
  withJourney: number;
  avgShelfLifeDays: number;
  avgHeaShelfLifeDays: number;
  records: {
    testId: number;
    product: string;
    bottledDate: string;
    tastedDate: string;
    shelfLifeDays: number;
    isHea: boolean;
    result: string | null;
    conclusion: string | null;
    steepMin: number | null;
    temp: number | null;
    teaG: number | null;
    sugarG: number | null;
    avgCoeff: number | null;
    f1Days: number | null;
    f2Days: number | null;
  }[];
  bySteepping: StatsGroup[];
  byTemp: StatsGroup[];
  byCoeff: StatsGroup[];
};

type JourneyData = {
  flavoringEvent: { id: number; date: string; bottlingDate: string | null; blocks: unknown[]; notes: string } | null;
  fermentation: { id: number; teaSort: string | null; startDate: string; flavoringDate: string | null; notes: string | null; f1Days: number | null } | null;
  brew: { id: number; date: string; teaSort: string | null; teaG: number; sugarG: number; boiledL: number; coldWaterL: number; steepMin: number | null; temp: number | null; starterPct: number; starterG: number } | null;
  f2Days: number | null;
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

function fmtD(d: string | Date | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "d. MMM yyyy");
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
    flavoringEventId: null as number | null,
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [tasteTarget, setTasteTarget] = useState<BottleTest | null>(null);
  const [tasteForm, setTasteForm] = useState({ result: "", conclusion: "", tastedDate: todayISO() });
  const [tasteError, setTasteError] = useState<string | null>(null);
  const [tasteLoading, setTasteLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<BottleTest | null>(null);
  const [editForm, setEditForm] = useState({
    product: "",
    bottleId: "",
    bottledDate: todayISO(),
    intervalMonths: 1,
    result: "",
    conclusion: "",
    tastedDate: todayISO(),
    flavoringEventId: null as number | null,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [filterProduct, setFilterProduct] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterBottledFrom, setFilterBottledFrom] = useState("");
  const [filterBottledTo, setFilterBottledTo] = useState("");

  const [activeTab, setActiveTab] = useState<"katsed" | "statistika">("katsed");

  const [flavEvents, setFlavEvents] = useState<FlavEvent[]>([]);
  const [expandedJourneyId, setExpandedJourneyId] = useState<number | null>(null);
  const [journeyMap, setJourneyMap] = useState<Record<number, JourneyData | null>>({});
  const [journeyLoading, setJourneyLoading] = useState<number | null>(null);
  const [aiInsightMap, setAiInsightMap] = useState<Record<number, string>>({});
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

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

  const fetchFlavEvents = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/flavoring/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFlavEvents(data);
      }
    } catch {
    }
  }, [getToken]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Statistika laadimine ebaõnnestus");
      const data = await res.json();
      setAnalytics(data);
    } catch (e: unknown) {
      setAnalyticsError(e instanceof Error ? e.message : "Viga");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [getToken]);

  async function loadAiSummary() {
    if (aiSummary || aiSummaryLoading) return;
    setAiSummaryLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests/analytics/ai-summary`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setAiSummary(data.summary ?? "Analüüsi ei saanud koostada.");
    } catch {
      setAiSummary("Analüüsi ei saanud koostada.");
    } finally {
      setAiSummaryLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    fetchFlavEvents();
  }, [fetchItems, fetchFlavEvents]);

  useEffect(() => {
    if (activeTab === "statistika" && !analytics && !analyticsLoading) {
      fetchAnalytics();
    }
  }, [activeTab, analytics, analyticsLoading, fetchAnalytics]);

  const waiting = items
    .filter((i) => i.status === "ootab")
    .sort((a, b) => new Date(a.nextTasting).getTime() - new Date(b.nextTasting).getTime());

  const tasted = items
    .filter((i) => i.status === "maitsitud")
    .sort((a, b) => new Date(b.tastedDate ?? 0).getTime() - new Date(a.tastedDate ?? 0).getTime());

  const filteredTasted = tasted.filter((i) => {
    if (filterProduct && !i.product.toLowerCase().includes(filterProduct.toLowerCase())) return false;
    if (filterDateFrom && i.tastedDate && i.tastedDate.slice(0, 10) < filterDateFrom) return false;
    if (filterDateTo && i.tastedDate && i.tastedDate.slice(0, 10) > filterDateTo) return false;
    const bottledISO = i.bottledDate.slice(0, 10);
    if (filterBottledFrom && bottledISO < filterBottledFrom) return false;
    if (filterBottledTo && bottledISO > filterBottledTo) return false;
    return true;
  });

  function relevantFlavEvents(bottledDate: string, productName?: string) {
    let candidates = flavEvents;
    if (bottledDate) {
      const base = new Date(bottledDate).getTime();
      candidates = candidates.filter((ev) => {
        const d = new Date(ev.bottlingDate ?? ev.date).getTime();
        return Math.abs(d - base) <= 7 * 86400000;
      });
    }
    if (productName && productName.trim().length > 0) {
      const nameLower = productName.trim().toLowerCase();
      const nameMatched = candidates.filter((ev) => {
        const blockNames = (ev.blocks ?? []).map((b) => b.name.toLowerCase()).filter(Boolean);
        return blockNames.some(
          (bn) => nameLower.includes(bn) || bn.includes(nameLower)
        ) || (ev.notes && ev.notes.toLowerCase().includes(nameLower));
      });
      if (nameMatched.length > 0) return nameMatched;
    }
    return candidates;
  }

  async function toggleJourney(item: BottleTest) {
    if (expandedJourneyId === item.id) {
      setExpandedJourneyId(null);
      return;
    }
    setExpandedJourneyId(item.id);
    if (journeyMap[item.id] !== undefined) return;
    if (!item.flavoringEventId) {
      setJourneyMap((m) => ({ ...m, [item.id]: null }));
      return;
    }
    setJourneyLoading(item.id);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests/${item.id}/journey`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setJourneyMap((m) => ({ ...m, [item.id]: data.journey }));
    } catch {
      setJourneyMap((m) => ({ ...m, [item.id]: null }));
    } finally {
      setJourneyLoading(null);
    }
  }

  async function loadAiInsight(item: BottleTest) {
    if (aiInsightMap[item.id] || aiLoadingId === item.id) return;
    setAiLoadingId(item.id);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/bottle-tests/${item.id}/ai-insight`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setAiInsightMap((m) => ({ ...m, [item.id]: data.insight ?? "Analüüsi ei saanud koostada." }));
    } catch {
      setAiInsightMap((m) => ({ ...m, [item.id]: "Analüüsi ei saanud koostada." }));
    } finally {
      setAiLoadingId(null);
    }
  }

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
          flavoringEventId: addForm.flavoringEventId ?? undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Viga");
      }
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setShowAddModal(false);
      setAddForm({ product: "", bottleId: "", bottledDate: todayISO(), intervalMonths: 1, flavoringEventId: null });
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
        body: JSON.stringify({
          result: tasteForm.result.trim(),
          conclusion: tasteForm.conclusion.trim(),
          tastedDate: tasteForm.tastedDate,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Viga");
      }
      await res.json();
      await fetchItems();
      setTasteTarget(null);
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

  function openEdit(item: BottleTest) {
    setEditTarget(item);
    setEditForm({
      product: item.product,
      bottleId: item.bottleId,
      bottledDate: new Date(item.bottledDate).toISOString().slice(0, 10),
      intervalMonths: item.intervalMonths,
      result: item.result ?? "",
      conclusion: item.conclusion ?? "",
      tastedDate: item.tastedDate ? new Date(item.tastedDate).toISOString().slice(0, 10) : todayISO(),
      flavoringEventId: item.flavoringEventId ?? null,
    });
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    if (!editForm.product.trim() || !editForm.bottleId.trim()) {
      setEditError("Toote nimi ja pudeli ID on kohustuslikud.");
      return;
    }
    setEditLoading(true);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        product: editForm.product.trim(),
        bottleId: editForm.bottleId.trim(),
        bottledDate: editForm.bottledDate,
        intervalMonths: Number(editForm.intervalMonths),
        flavoringEventId: editForm.flavoringEventId,
      };
      if (editTarget.status === "maitsitud") {
        body.result = editForm.result.trim();
        body.conclusion = editForm.conclusion.trim();
        body.tastedDate = editForm.tastedDate;
      }
      const res = await fetch(`${BASE_URL}/api/bottle-tests/${editTarget.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Viga");
      }
      await res.json();
      await fetchItems();
      setEditTarget(null);
      setJourneyMap((m) => { const n = { ...m }; delete n[editTarget.id]; return n; });
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Viga");
    } finally {
      setEditLoading(false);
    }
  }

  function handleExportCSV() {
    const headers = ["Toode", "Pudeli ID", "Villitud", "Maitsitud", "Tulemus", "Järeldus"];
    const escape = (val: string | null) => {
      let s = val ?? "";
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = filteredTasted.map((item) => [
      escape(item.product),
      escape(item.bottleId),
      escape(format(new Date(item.bottledDate), "d. MMM yyyy")),
      escape(item.tastedDate ? format(new Date(item.tastedDate), "d. MMM yyyy") : ""),
      escape(item.result),
      escape(item.conclusion),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kestvuskatsed.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function FlavEventDropdown({
    value,
    onChange,
    bottledDate,
    productName,
  }: {
    value: number | null;
    onChange: (id: number | null) => void;
    bottledDate: string;
    productName?: string;
  }) {
    const candidates = relevantFlavEvents(bottledDate, productName);

    useEffect(() => {
      if (candidates.length === 1 && value !== candidates[0].id) {
        onChange(candidates[0].id);
      }
    }, [candidates.length, candidates[0]?.id]);

    const autoSelected = candidates.length === 1 && value === candidates[0].id;

    return (
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Seotud maitsestamine / villimissündmus{" "}
          <span className="text-muted-foreground font-normal text-xs">(valikuline)</span>
        </label>
        <select
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Vali (valikuline) —</option>
          {candidates.map((ev) => (
            <option key={ev.id} value={ev.id}>
              Maitsestamine {ev.date}
              {ev.bottlingDate ? ` → villitud ${ev.bottlingDate}` : ""}
              {ev.blocks?.length > 0 ? ` (${ev.blocks.map((b) => b.name).filter(Boolean).join(", ")})` : ""}
            </option>
          ))}
          {candidates.length === 0 && flavEvents.length > 0 && (
            <option disabled>Valitud kuupäeva lähedal sündmusi ei leitud</option>
          )}
        </select>
        {autoSelected && (
          <p className="text-xs text-green-700 mt-1">Automaatselt valitud — ainuke sobiv sündmus</p>
        )}
        {candidates.length === 0 && flavEvents.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">Lisa kõigepealt maitsestamissündmused Maitsestamine lehelt.</p>
        )}
      </div>
    );
  }

  function JourneySection({ item }: { item: BottleTest }) {
    const j = journeyMap[item.id];
    const isLoading = journeyLoading === item.id;
    const aiInsight = aiInsightMap[item.id];
    const aiIsLoading = aiLoadingId === item.id;

    if (isLoading) {
      return (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          Laadin teekonda...
        </div>
      );
    }

    if (!j) {
      return (
        <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
          {item.flavoringEventId
            ? "Teekonnaandmed puuduvad."
            : "Seosta katse maitsestamissündmusega, et teekond kuvataks. Kasuta redigeeri nuppu."}
        </div>
      );
    }

    return (
      <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <GitBranch size={12} />
          Pruulimise teekond
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {j.brew && (
            <div className="bg-muted/40 rounded-xl p-2.5 space-y-0.5">
              <div className="font-semibold text-foreground/80 mb-1">Pruulimine</div>
              <div>{fmtD(j.brew.date)}</div>
              {j.brew.teaG > 0 && <div>{j.brew.teaG}g teed</div>}
              {j.brew.sugarG > 0 && <div>{j.brew.sugarG}g suhkrut</div>}
              {j.brew.steepMin && <div>Tõmbis {j.brew.steepMin}min</div>}
              {j.brew.temp && <div>Temp {j.brew.temp}°C</div>}
            </div>
          )}
          {j.fermentation && (
            <div className="bg-muted/40 rounded-xl p-2.5 space-y-0.5">
              <div className="font-semibold text-foreground/80 mb-1">Käärimine</div>
              <div>Algus {fmtD(j.fermentation.startDate)}</div>
              {j.fermentation.teaSort && <div>{j.fermentation.teaSort}</div>}
              {j.fermentation.f1Days != null && (
                <div className="font-medium text-amber-700">F1: {j.fermentation.f1Days} päeva</div>
              )}
            </div>
          )}
          {j.flavoringEvent && (
            <div className="bg-muted/40 rounded-xl p-2.5 space-y-0.5">
              <div className="font-semibold text-foreground/80 mb-1">Maitsestamine → Villimine</div>
              <div>Maitsestatud {fmtD(j.flavoringEvent.date)}</div>
              {j.flavoringEvent.bottlingDate && <div>Villitud {fmtD(j.flavoringEvent.bottlingDate)}</div>}
              {j.f2Days != null && (
                <div className="font-medium text-amber-700">F2: {j.f2Days} päeva</div>
              )}
            </div>
          )}
        </div>

        {aiInsight && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            <div className="font-semibold mb-1 flex items-center gap-1">
              <Sparkles size={11} />
              AI tähelepanekud
            </div>
            {aiInsight}
          </div>
        )}

        {!aiInsight && (
          <button
            onClick={() => loadAiInsight(item)}
            disabled={aiIsLoading}
            className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 border border-amber-200 hover:border-amber-400 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {aiIsLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {aiIsLoading ? "Analysin..." : "AI tähelepanekud"}
          </button>
        )}
      </div>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={20} className="text-primary" />
            <h1 className="font-serif font-semibold text-xl">Kestvuskatsed</h1>
          </div>
          {activeTab === "katsed" && (
            <Button
              data-testid="button-add-test"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={15} />
              Lisa uus
            </Button>
          )}
        </div>
        <div className="flex border-t border-border">
          <button
            onClick={() => setActiveTab("katsed")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
              activeTab === "katsed"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FlaskConical size={14} />
            Katsed
          </button>
          <button
            onClick={() => setActiveTab("statistika")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
              activeTab === "statistika"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 size={14} />
            Statistika
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-8">

        {/* Analytics tab */}
        {activeTab === "statistika" && (
          <section className="space-y-5">
            {analyticsLoading && (
              <p className="text-muted-foreground text-sm text-center py-12">Laadin statistikat...</p>
            )}
            {analyticsError && (
              <p className="text-red-600 text-sm text-center py-6">{analyticsError}</p>
            )}
            {!analyticsLoading && !analyticsError && analytics && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-border bg-muted/30 p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{analytics.totalCompleted}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Lõpetatud katset</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-3 text-center">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{analytics.heaCount}</div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">"Hea" tulemus</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {analytics.avgShelfLifeDays > 0 ? `${Math.round(analytics.avgShelfLifeDays / 30.5)}k` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Kesk. säilivus (kõik)</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 text-center">
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {analytics.avgHeaShelfLifeDays > 0 ? `${Math.round(analytics.avgHeaShelfLifeDays / 30.5)}k` : "—"}
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Kesk. säilivus ("hea")</div>
                  </div>
                </div>

                {/* By steep time */}
                {analytics.bySteepping.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      Tõmbeaja järgi
                    </h3>
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Tõmbeaeg</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Katseid</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">"Hea"</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Kesk. säilivus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.bySteepping
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((g, i) => (
                              <tr key={g.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                                <td className="px-4 py-2.5 font-medium">{g.label}</td>
                                <td className="px-3 py-2.5 text-center text-muted-foreground">{g.count}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-green-700 dark:text-green-400 font-medium">{g.heaCount}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold">
                                  {Math.round(g.avgDays / 30.5)}k ({g.avgDays}p)
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* By temperature */}
                {analytics.byTemp.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Temperatuuri järgi
                    </h3>
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Temperatuur</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Katseid</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">"Hea"</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Kesk. säilivus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.byTemp
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((g, i) => (
                              <tr key={g.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                                <td className="px-4 py-2.5 font-medium">{g.label}</td>
                                <td className="px-3 py-2.5 text-center text-muted-foreground">{g.count}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-green-700 dark:text-green-400 font-medium">{g.heaCount}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold">
                                  {Math.round(g.avgDays / 30.5)}k ({g.avgDays}p)
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* By flavoring coefficient */}
                {analytics.byCoeff.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Maitsestuskoefitsiendi järgi
                    </h3>
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Koefitsient</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Katseid</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">"Hea"</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Kesk. säilivus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.byCoeff
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((g, i) => (
                              <tr key={g.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                                <td className="px-4 py-2.5 font-medium">{g.label}</td>
                                <td className="px-3 py-2.5 text-center text-muted-foreground">{g.count}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-green-700 dark:text-green-400 font-medium">{g.heaCount}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold">
                                  {Math.round(g.avgDays / 30.5)}k ({g.avgDays}p)
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {analytics.bySteepping.length === 0 && analytics.byTemp.length === 0 && analytics.byCoeff.length === 0 && analytics.totalCompleted > 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
                    Seosta kestvuskatseid maitsestamissündmustega, et pruulimisparameetrite statistika ilmuks siia.
                  </div>
                )}

                {analytics.totalCompleted === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                    Statistika ilmub, kui oled mõne katse maitsituks märkinud.
                  </div>
                )}

                {/* AI Summary */}
                {analytics.totalCompleted > 0 && (
                  <div>
                    {aiSummary ? (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                          <Sparkles size={13} />
                          AI kokkuvõte
                        </div>
                        <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{aiSummary}</p>
                        <button
                          onClick={() => { setAiSummary(null); }}
                          className="mt-2 text-xs text-amber-600 hover:text-amber-800 underline"
                        >
                          Küsi uuesti
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={loadAiSummary}
                        disabled={aiSummaryLoading}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-200 hover:border-amber-400 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300 transition-colors disabled:opacity-50"
                      >
                        {aiSummaryLoading ? (
                          <><Loader2 size={15} className="animate-spin" /> Analüüsin andmeid...</>
                        ) : (
                          <><Sparkles size={15} /> Genereeri AI kokkuvõte</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === "katsed" && loading && (
          <p className="text-muted-foreground text-sm text-center py-12">Laadin...</p>
        )}
        {activeTab === "katsed" && error && (
          <p className="text-red-600 text-sm text-center py-12">{error}</p>
        )}

        {activeTab === "katsed" && !loading && !error && (
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
                  const isJourneyOpen = expandedJourneyId === item.id;
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
                            {item.flavoringEventId && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                Seotud
                              </span>
                            )}
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
                              setTasteForm({ result: "", conclusion: "", tastedDate: todayISO() });
                              setTasteError(null);
                            }}
                          >
                            <CheckCircle size={13} />
                            Maitsitud
                          </Button>
                          <Button
                            data-testid={`button-edit-${item.id}`}
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs h-8"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil size={13} />
                            Muuda
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
                          <button
                            onClick={() => toggleJourney(item)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <GitBranch size={12} />
                            {isJourneyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      </div>
                      {isJourneyOpen && <JourneySection item={item} />}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Tasted results section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Maitsitud tulemused ({filteredTasted.length}{filteredTasted.length !== tasted.length ? `/${tasted.length}` : ""})
                </h2>
                {tasted.length > 0 && (
                  <Button
                    data-testid="button-export-csv"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={handleExportCSV}
                    disabled={filteredTasted.length === 0}
                  >
                    <Download size={13} />
                    Ekspordi CSV
                  </Button>
                )}
              </div>

              {tasted.length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  <input
                    data-testid="filter-product"
                    type="text"
                    placeholder="Otsi toote nime järgi..."
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={filterProduct}
                    onChange={(e) => setFilterProduct(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap w-36">Maitsmise kuupäev</span>
                    <input
                      data-testid="filter-date-from"
                      type="date"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      title="Maitsitud alates"
                    />
                    <input
                      data-testid="filter-date-to"
                      type="date"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      title="Maitsitud kuni"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap w-36">Villimise kuupäev</span>
                    <input
                      data-testid="filter-bottled-from"
                      type="date"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={filterBottledFrom}
                      onChange={(e) => setFilterBottledFrom(e.target.value)}
                      title="Villitud alates"
                    />
                    <input
                      data-testid="filter-bottled-to"
                      type="date"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={filterBottledTo}
                      onChange={(e) => setFilterBottledTo(e.target.value)}
                      title="Villitud kuni"
                    />
                  </div>
                  {(filterProduct || filterDateFrom || filterDateTo || filterBottledFrom || filterBottledTo) && (
                    <button
                      data-testid="filter-clear"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 self-start whitespace-nowrap"
                      onClick={() => {
                        setFilterProduct("");
                        setFilterDateFrom("");
                        setFilterDateTo("");
                        setFilterBottledFrom("");
                        setFilterBottledTo("");
                      }}
                    >
                      Tühista filtrid
                    </button>
                  )}
                </div>
              )}

              {tasted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
                  Maitsitud tulemusi pole veel. Märgi ootav katse maitsituks, et tulemused siia ilmuksid.
                </div>
              ) : filteredTasted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
                  Ükski kirje ei vasta filtritingimustele.
                </div>
              ) : (
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
                              <th className="px-4 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasted.map((item, idx) => (
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
                                <td className="px-4 py-3">
                                  <button
                                    data-testid={`button-edit-${item.id}`}
                                    onClick={() => openEdit(item)}
                                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                                    title="Muuda"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3" data-testid="tasted-table">
                        {filteredTasted.map((item) => (
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
                            <div className="pt-1">
                              <button
                                data-testid={`button-edit-${item.id}`}
                                onClick={() => openEdit(item)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil size={12} />
                                Muuda
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
            </section>
          </>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6 max-h-[85dvh] overflow-y-auto">
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
              <FlavEventDropdown
                value={addForm.flavoringEventId}
                onChange={(id) => setAddForm((f) => ({ ...f, flavoringEventId: id }))}
                bottledDate={addForm.bottledDate}
                productName={addForm.product}
              />
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

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-semibold text-lg">Muuda kirjet</h2>
              <button
                onClick={() => { setEditTarget(null); setEditError(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Toote nimi</label>
                <input
                  data-testid="edit-input-product"
                  type="text"
                  required
                  placeholder="nt. Maasika F2"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={editForm.product}
                  onChange={(e) => setEditForm((f) => ({ ...f, product: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Pudeli ID</label>
                <input
                  data-testid="edit-input-bottle-id"
                  type="text"
                  required
                  placeholder="nt. P-01"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={editForm.bottleId}
                  onChange={(e) => setEditForm((f) => ({ ...f, bottleId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Villimise kuupäev</label>
                <input
                  data-testid="edit-input-bottled-date"
                  type="date"
                  required
                  max={todayISO()}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={editForm.bottledDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, bottledDate: e.target.value }))}
                />
              </div>
              <FlavEventDropdown
                value={editForm.flavoringEventId}
                onChange={(id) => setEditForm((f) => ({ ...f, flavoringEventId: id }))}
                bottledDate={editForm.bottledDate}
                productName={editForm.product}
              />
              <div>
                <label className="block text-sm font-medium mb-1.5">Maitsemisintervall (kuudes)</label>
                <input
                  data-testid="edit-input-interval-months"
                  type="number"
                  required
                  min={1}
                  max={120}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={editForm.intervalMonths}
                  onChange={(e) => setEditForm((f) => ({ ...f, intervalMonths: Number(e.target.value) }))}
                />
              </div>
              {editTarget.status === "maitsitud" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Maitsimise kuupäev</label>
                    <input
                      data-testid="edit-input-tasted-date"
                      type="date"
                      required
                      max={todayISO()}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={editForm.tastedDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, tastedDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Tulemus</label>
                    <textarea
                      data-testid="edit-input-result"
                      required
                      rows={3}
                      placeholder="Kirjelda maitset, lõhna, karbonisatsiooni..."
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      value={editForm.result}
                      onChange={(e) => setEditForm((f) => ({ ...f, result: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Järeldus</label>
                    <textarea
                      data-testid="edit-input-conclusion"
                      required
                      rows={3}
                      placeholder="Mida muudad järgmine kord? Kas jätkad?"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      value={editForm.conclusion}
                      onChange={(e) => setEditForm((f) => ({ ...f, conclusion: e.target.value }))}
                    />
                  </div>
                </>
              )}
              {editError && <p className="text-red-600 text-sm">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setEditTarget(null); setEditError(null); }}
                >
                  Tühista
                </Button>
                <Button
                  data-testid="button-submit-edit"
                  type="submit"
                  className="flex-1"
                  disabled={editLoading}
                >
                  {editLoading ? "Salvestan..." : "Salvesta muudatused"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Taste modal */}
      {tasteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6 max-h-[85dvh] overflow-y-auto">
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
                <label className="block text-sm font-medium mb-1.5">Maitsimise kuupäev</label>
                <input
                  data-testid="input-taste-date"
                  type="date"
                  required
                  max={todayISO()}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={tasteForm.tastedDate}
                  onChange={(e) => setTasteForm((f) => ({ ...f, tastedDate: e.target.value }))}
                />
              </div>
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
