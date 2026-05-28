import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import {
  GitBranch, Link2, Link2Off, ChevronDown, ChevronUp,
  Droplets, FlaskConical, Leaf, Package, Wheat, Sprout,
  ArrowLeft, ArrowRight, Sparkles, Loader2,
} from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function useAuthFetch() {
  const { getToken } = useAuth();
  return async (path: string, options?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });
    return res;
  };
}

type Vessel = { volumeL: number; vesselL: number; count: number; place: string; temp: number | null };
type EventBlock = { name: string; koguseL: number; vesselL: number; gramsUsed: number; coefficient: number };
type BrewInfo = {
  id: number; date: string; teaSort: string | null; teaG: number; sugarG: number;
  boiledL: number; coldWaterL: number; starterPct: number; starterG: number; steepMin: number | null;
};
type FlavInfo = { id: number; date: string; bottlingDate: string | null; blocks: EventBlock[]; notes: string };
type StarterRef = { id: number; teaSort: string | null; startDate: string };

type LifecycleItem = {
  id: number;
  teaSort: string | null;
  startDate: string;
  flavoringDate: string | null;
  notes: string | null;
  vessels: Vessel[];
  starterSourceBatchId: number | null;
  starterSourceBatch: StarterRef | null;
  nextBatchId: number | null;
  outgoingStarterG: number | null;
  outgoingStarterPct: number | null;
  brew: BrewInfo | null;
  flavoringEvent: FlavInfo | null;
  totalVolumeL: number;
  f1Days: number | null;
  f2Days: number | null;
  totalBottles: number;
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("et-EE", { day: "numeric", month: "short", year: "numeric" });
}

function DurationBadge({ days, label }: { days: number | null; label: string }) {
  if (days === null) {
    return (
      <div className="flex items-center self-center px-0.5">
        <div className="w-4 h-px bg-stone-200" />
      </div>
    );
  }
  const color =
    days > 14 ? "bg-red-100 text-red-700 border border-red-200" :
    days > 10 ? "bg-amber-100 text-amber-700 border border-amber-200" :
    "bg-green-100 text-green-700 border border-green-200";
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-0.5 self-center">
      <div className="w-4 h-px bg-stone-300" />
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${color}`}>
        {label}: {days}p
      </span>
      <div className="w-4 h-px bg-stone-300" />
    </div>
  );
}

function StageBox({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: React.ElementType;
  title: string;
  status: "done" | "active" | "empty";
  children: React.ReactNode;
}) {
  const bg =
    status === "done" ? "bg-white border-stone-200" :
    status === "active" ? "bg-amber-50 border-amber-300" :
    "bg-stone-50 border-dashed border-stone-200 opacity-50";
  const iconColor =
    status === "done" ? "text-green-600" :
    status === "active" ? "text-amber-600" :
    "text-stone-400";

  return (
    <div className={`flex flex-col gap-1.5 border rounded-xl p-3 min-w-[120px] max-w-[160px] flex-1 ${bg}`}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={iconColor} />
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide leading-tight">{title}</span>
      </div>
      <div className="text-xs text-stone-700 space-y-0.5 leading-snug">{children}</div>
    </div>
  );
}

function StarterLinkDropdown({
  batchId,
  currentSourceId,
  allBatches,
  authFetch,
  onClose,
}: {
  batchId: number;
  currentSourceId: number | null;
  allBatches: LifecycleItem[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (srcId: number | null) => {
      const res = await authFetch(`/fermentations/${batchId}/starter-source`, {
        method: "PATCH",
        body: JSON.stringify({ starterSourceBatchId: srcId }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lifecycle"] });
      onClose();
    },
  });

  const candidates = allBatches.filter((b) => b.id !== batchId);

  return (
    <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-stone-200 rounded-xl shadow-xl p-1 min-w-[220px]">
      <div className="text-[10px] text-stone-400 px-3 py-1 font-medium uppercase tracking-wide">
        Vali juuretise allikas
      </div>
      {candidates.length === 0 && (
        <div className="text-xs text-stone-400 px-3 py-2">Teisi partiisid pole</div>
      )}
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => mut.mutate(c.id)}
          disabled={mut.isPending}
          className="w-full text-left text-xs px-3 py-1.5 hover:bg-amber-50 rounded-lg flex items-center gap-2"
        >
          <span className="font-medium text-stone-700">#{c.id}</span>
          <span className="text-stone-500">{c.teaSort || "Nimeta"} · {fmtDate(c.startDate)}</span>
          {c.id === currentSourceId && <span className="ml-auto text-amber-600">✓</span>}
        </button>
      ))}
      {currentSourceId !== null && (
        <>
          <div className="border-t border-stone-100 my-1" />
          <button
            onClick={() => mut.mutate(null)}
            disabled={mut.isPending}
            className="w-full text-left text-xs px-3 py-1.5 hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-1.5"
          >
            <Link2Off size={11} /> Eemalda link
          </button>
        </>
      )}
    </div>
  );
}

function LifecycleCard({
  item,
  allBatches,
  authFetch,
  expanded,
  onToggle,
  onNavigateTo,
}: {
  item: LifecycleItem;
  allBatches: LifecycleItem[];
  authFetch: ReturnType<typeof useAuthFetch>;
  expanded: boolean;
  onToggle: () => void;
  onNavigateTo: (id: number) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [aiRec, setAiRec] = useState<string | null>(null);
  const [aiRecLoading, setAiRecLoading] = useState(false);

  async function fetchAiRec() {
    if (!item.flavoringEvent?.id) return;
    setAiRecLoading(true);
    try {
      const res = await authFetch("/bottle-tests/analytics/ai-recommendation", {
        method: "POST",
        body: JSON.stringify({ flavoringEventId: item.flavoringEvent.id }),
      });
      const data = await res.json();
      setAiRec(data.recommendation ?? null);
    } catch {
      setAiRec("Soovituse laadimine ebaõnnestus.");
    } finally {
      setAiRecLoading(false);
    }
  }

  const isDone = !!item.flavoringEvent?.bottlingDate;
  const isActive = !isDone;

  const juuretisStatus: "done" | "active" | "empty" =
    item.starterSourceBatch ? "done" : "active";
  const f1Status: "done" | "active" | "empty" =
    item.flavoringDate ? "done" : "active";
  const f2Status: "done" | "active" | "empty" =
    !item.flavoringDate ? "empty" :
    item.flavoringEvent?.bottlingDate ? "done" : "active";
  const bottlingStatus: "done" | "active" | "empty" =
    isDone ? "done" : "empty";

  // Look up prev (source) and next batch summaries for chain nav
  const prevBatch = item.starterSourceBatch;
  const nextBatch = item.nextBatchId != null
    ? allBatches.find((b) => b.id === item.nextBatchId) ?? null
    : null;

  return (
    <div
      id={`batch-${item.id}`}
      className={`border rounded-2xl overflow-hidden transition-all ${
        isDone ? "border-stone-200 bg-white" : "border-amber-200 bg-amber-50/20"
      }`}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50/60 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              isDone ? "bg-green-500" : "bg-amber-500 animate-pulse"
            }`}
          />
          <div>
            <div className="font-semibold text-stone-800 text-sm">
              #{item.id} — {item.teaSort || "Nimeta tee"}
            </div>
            <div className="text-xs text-stone-500 flex flex-wrap gap-x-2">
              <span>Algus {fmtDate(item.startDate)}</span>
              {item.totalVolumeL > 0 && <span>{item.totalVolumeL.toFixed(1)} L</span>}
              {item.totalBottles > 0 && <span>{item.totalBottles} pudelit</span>}
              {item.f1Days !== null && <span>F1: {item.f1Days}p</span>}
              {item.f2Days !== null && <span>F2: {item.f2Days}p</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {isActive && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
              Aktiivne
            </span>
          )}
          {expanded
            ? <ChevronUp size={15} className="text-stone-400" />
            : <ChevronDown size={15} className="text-stone-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-4 pb-5 pt-4 space-y-4">

          {/* ── Chain navigation: prev / next ── */}
          {(prevBatch || nextBatch) && (
            <div className="flex items-center gap-2 flex-wrap">
              {prevBatch && (
                <button
                  onClick={() => onNavigateTo(prevBatch.id)}
                  className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-700 border border-stone-200 hover:border-amber-300 rounded-lg px-2.5 py-1 transition"
                >
                  <ArrowLeft size={11} />
                  Eelmine: #{prevBatch.id} {prevBatch.teaSort || "Nimeta"}
                </button>
              )}
              {nextBatch && (
                <button
                  onClick={() => onNavigateTo(nextBatch.id)}
                  className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-700 border border-stone-200 hover:border-amber-300 rounded-lg px-2.5 py-1 transition"
                >
                  Järgmine: #{nextBatch.id} {nextBatch.teaSort || "Nimeta"}
                  <ArrowRight size={11} />
                </button>
              )}
            </div>
          )}

          {/* ── Timeline — horizontal, scrollable ── */}
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex items-stretch gap-0 min-w-max">

              {/* Stage 1: Juuretis */}
              <StageBox icon={Sprout} title="Juuretis" status={juuretisStatus}>
                {item.starterSourceBatch ? (
                  <>
                    {/* Clickable source batch link */}
                    <button
                      onClick={() => onNavigateTo(item.starterSourceBatch!.id)}
                      className="text-left font-medium text-amber-700 hover:text-amber-900 hover:underline"
                    >
                      #{item.starterSourceBatch.id} — {item.starterSourceBatch.teaSort || "Nimeta"}
                    </button>
                    <div className="text-stone-500">{fmtDate(item.starterSourceBatch.startDate)}</div>
                    {item.brew && item.brew.starterG > 0 && (
                      <div className="text-amber-700 font-medium">
                        {item.brew.starterG} g ({item.brew.starterPct}%)
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {item.brew && item.brew.starterG > 0 && (
                      <div className="text-stone-600">{item.brew.starterG} g ({item.brew.starterPct}%)</div>
                    )}
                    <div className="text-amber-600">— linkimata</div>
                  </>
                )}
                {/* Link/unlink button */}
                <div className="relative mt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setLinkOpen(!linkOpen); }}
                    className={`text-[10px] flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                      item.starterSourceBatch
                        ? "text-stone-400 hover:text-amber-700"
                        : "text-amber-700 border border-dashed border-amber-300 hover:bg-amber-50"
                    }`}
                  >
                    <Link2 size={9} />
                    {item.starterSourceBatch ? "Muuda" : "Lingi allikas"}
                  </button>
                  {linkOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setLinkOpen(false)} />
                      <StarterLinkDropdown
                        batchId={item.id}
                        currentSourceId={item.starterSourceBatchId}
                        allBatches={allBatches}
                        authFetch={authFetch}
                        onClose={() => setLinkOpen(false)}
                      />
                    </>
                  )}
                </div>
              </StageBox>

              {/* Connector */}
              <div className="flex items-center self-center px-0.5">
                <div className="w-4 h-px bg-stone-300" />
              </div>

              {/* Stage 2: Pruulimine */}
              <StageBox icon={FlaskConical} title="Pruulimine" status={item.brew ? "done" : "empty"}>
                {item.brew ? (
                  <>
                    <div>{fmtDate(item.brew.date)}</div>
                    {item.brew.teaSort && <div className="text-stone-500">{item.brew.teaSort}</div>}
                    {item.brew.teaG > 0 && <div>{item.brew.teaG} g teed</div>}
                    {item.brew.sugarG > 0 && <div>{item.brew.sugarG} g suhkrut</div>}
                    <div>{(item.brew.boiledL + item.brew.coldWaterL).toFixed(1)} L vett</div>
                    {item.brew.steepMin != null && item.brew.steepMin > 0 && (
                      <div>Tõmbis {item.brew.steepMin} min</div>
                    )}
                  </>
                ) : (
                  <div className="text-stone-400 italic">Puudub</div>
                )}
              </StageBox>

              {/* F1 duration badge */}
              <DurationBadge days={item.f1Days} label="F1" />

              {/* Stage 3: Käärimine F1 */}
              <StageBox icon={Droplets} title="Käärimine F1" status={f1Status}>
                <div>Algus {fmtDate(item.startDate)}</div>
                {item.vessels.length > 0 && (
                  <div>{item.vessels.reduce((s, v) => s + (v.count ?? 1), 0)} nõud</div>
                )}
                {item.totalVolumeL > 0 && <div>{item.totalVolumeL.toFixed(1)} L</div>}
                {item.flavoringDate ? (
                  <div className="text-green-700">Lõpp {fmtDate(item.flavoringDate)}</div>
                ) : (
                  <div className="text-amber-600">Käib…</div>
                )}
              </StageBox>

              {/* F2 duration badge */}
              <DurationBadge days={item.f2Days} label="F2" />

              {/* Stage 4: Maitsestamine F2 */}
              <StageBox icon={Leaf} title="Maitsestamine F2" status={f2Status}>
                {item.flavoringEvent ? (
                  <>
                    <div>{fmtDate(item.flavoringEvent.date)}</div>
                    {item.flavoringEvent.blocks.map((bl, i) => (
                      <div key={i} className="text-stone-600">
                        {bl.name || `Plokk ${i + 1}`}: {bl.koguseL.toFixed(1)} L
                      </div>
                    ))}
                    {!item.flavoringEvent.bottlingDate && (
                      <div className="text-amber-600">Pudeldamata</div>
                    )}
                  </>
                ) : (
                  <div className="text-stone-400 italic">Ootel</div>
                )}
              </StageBox>

              {/* Connector */}
              <div className="flex items-center self-center px-0.5">
                <div className="w-4 h-px bg-stone-300" />
              </div>

              {/* Stage 5: Pudeldamine */}
              <StageBox icon={Package} title="Pudeldamine" status={bottlingStatus}>
                {item.flavoringEvent?.bottlingDate ? (
                  <>
                    <div>{fmtDate(item.flavoringEvent.bottlingDate)}</div>
                    {item.totalBottles > 0 && (
                      <div className="font-medium text-stone-800">{item.totalBottles} pudelit</div>
                    )}
                    {/* Outgoing starter — derived from the next batch's brew */}
                    {item.outgoingStarterG != null && item.outgoingStarterG > 0 ? (
                      <div className="text-amber-700 font-medium mt-0.5 pt-0.5 border-t border-stone-100">
                        Juuretis edasi: {item.outgoingStarterG} g ({item.outgoingStarterPct ?? "?"}%)
                      </div>
                    ) : (
                      <div className="text-stone-400 italic mt-0.5">Juuretis edasi: —</div>
                    )}
                  </>
                ) : (
                  <div className="text-stone-400 italic">Ootel</div>
                )}
              </StageBox>

            </div>
          </div>

          {/* ── Flavor block detail ── */}
          {item.flavoringEvent?.blocks && item.flavoringEvent.blocks.length > 0 && (
            <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                Maitseploki detail
              </div>
              <div className="space-y-1.5">
                {item.flavoringEvent.blocks.map((bl, i) => {
                  const bottles = bl.vesselL > 0 ? Math.floor(bl.koguseL / bl.vesselL) : 0;
                  return (
                    <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-600">
                      <span className="font-semibold text-stone-800">{bl.name || `Plokk ${i + 1}`}</span>
                      <span>{bl.koguseL.toFixed(1)} L</span>
                      {bl.gramsUsed > 0 && <span>{bl.gramsUsed.toFixed(0)} g maitseainet</span>}
                      {bottles > 0 && <span className="text-amber-700 font-medium">~ {bottles} pudelit</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── AI soovitus villimise korral ── */}
          {item.flavoringEvent && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                  <Sparkles size={12} />
                  AI soovitus sarnaste parameetrite põhjal
                </div>
                {aiRec && (
                  <button
                    onClick={() => { setAiRec(null); fetchAiRec(); }}
                    className="text-[10px] text-violet-500 hover:text-violet-700 transition"
                  >
                    Küsi uuesti
                  </button>
                )}
              </div>
              {aiRec ? (
                <p className="text-xs text-violet-900 leading-relaxed">{aiRec}</p>
              ) : (
                <button
                  onClick={fetchAiRec}
                  disabled={aiRecLoading}
                  className="flex items-center gap-1.5 text-xs text-violet-700 hover:text-violet-900 border border-violet-200 hover:border-violet-400 bg-white rounded-lg px-3 py-1.5 transition disabled:opacity-60"
                >
                  {aiRecLoading ? (
                    <><Loader2 size={11} className="animate-spin" /> Laen soovitust…</>
                  ) : (
                    <><Sparkles size={11} /> Küsi soovitust</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {item.notes && (
            <div className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2">
              <span className="font-medium text-stone-600">Märkmed: </span>{item.notes}
            </div>
          )}

          {/* ── Links to editing pages ── */}
          <div className="flex gap-2 pt-1">
            <a
              href={`${BASE_URL}/kaarimine`}
              className="text-xs text-amber-700 hover:text-amber-900 border border-stone-200 hover:border-amber-300 rounded-lg px-3 py-1.5 transition"
            >
              Käärimine →
            </a>
            <a
              href={`${BASE_URL}/maitsestamine`}
              className="text-xs text-amber-700 hover:text-amber-900 border border-stone-200 hover:border-amber-300 rounded-lg px-3 py-1.5 transition"
            >
              Maitsestamine →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EluigaPage() {
  const authFetch = useAuthFetch();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { data, isLoading } = useQuery<LifecycleItem[]>({
    queryKey: ["lifecycle"],
    queryFn: async () => {
      const res = await authFetch("/fermentations/lifecycle");
      return res.json();
    },
  });

  const items = data ?? [];

  // Navigate to a batch: expand it and scroll to its card
  const navigateTo = useCallback((id: number) => {
    setExpandedId(id);
    // Small delay so the card expands first
    setTimeout(() => {
      const el = document.getElementById(`batch-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <GitBranch size={22} className="text-amber-600" />
          <div>
            <h1 className="text-2xl font-serif font-semibold text-stone-800">Tee eluiga</h1>
            <p className="text-sm text-stone-500">
              Iga partii täielik teekond pruulimisest pudeldamiseni
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-20 text-stone-400">
            <Wheat size={44} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm font-medium text-stone-500">Käärimispartii pole veel lisatud</div>
            <div className="text-xs mt-1 mb-4">Lisa esimene partii Käärimine lehelt.</div>
            <a
              href={`${BASE_URL}/kaarimine`}
              className="inline-flex items-center gap-2 text-sm text-amber-700 border border-amber-300 rounded-lg px-4 py-2 hover:bg-amber-50 transition"
            >
              Mine Käärimine lehele →
            </a>
          </div>
        )}

        {items.map((item) => (
          <LifecycleCard
            key={item.id}
            item={item}
            allBatches={items}
            authFetch={authFetch}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onNavigateTo={navigateTo}
          />
        ))}
      </div>
    </Layout>
  );
}
