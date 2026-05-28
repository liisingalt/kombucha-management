import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { GitBranch, Link2, Link2Off, ChevronDown, ChevronUp, Droplets, FlaskConical, Leaf, Package, Wheat } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function useAuthFetch() {
  const { getToken } = useAuth();
  return async (path: string, options?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
    });
    return res;
  };
}

type Vessel = { volumeL: number; vesselL: number; count: number; place: string; temp: number | null };
type EventBlock = { name: string; koguseL: number; vesselL: number; gramsUsed: number; coefficient: number };
type BrewInfo = { id: number; date: string; teaSort: string | null; teaG: number; sugarG: number; boiledL: number; coldWaterL: number; starterPct: number; starterG: number; steepMin: number | null };
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
  if (days === null) return null;
  const color = days > 14 ? "bg-red-100 text-red-700" : days > 10 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <div className="w-8 h-px bg-stone-300" />
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${color}`}>
        {label}: {days}p
      </span>
      <div className="w-8 h-px bg-stone-300" />
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
  const bg = status === "done" ? "bg-stone-50 border-stone-200" : status === "active" ? "bg-amber-50 border-amber-300" : "bg-stone-50 border-dashed border-stone-200 opacity-50";
  const iconColor = status === "done" ? "text-green-600" : status === "active" ? "text-amber-600" : "text-stone-400";

  return (
    <div className={`flex flex-col gap-1.5 border rounded-xl p-3 min-w-[130px] max-w-[175px] flex-1 ${bg}`}>
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={iconColor} />
        <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{title}</span>
      </div>
      <div className="text-xs text-stone-700 space-y-0.5">{children}</div>
    </div>
  );
}

function StarterLinkSelector({
  batchId,
  currentSourceId,
  allBatches,
  authFetch,
}: {
  batchId: number;
  currentSourceId: number | null;
  allBatches: LifecycleItem[];
  authFetch: ReturnType<typeof useAuthFetch>;
}) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
    },
  });

  const candidates = allBatches.filter((b) => b.id !== batchId);

  return (
    <div className="relative">
      {currentSourceId === null ? (
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 border border-dashed border-amber-300 rounded-lg px-2 py-1"
        >
          <Link2 size={11} />
          Lingi allikas
        </button>
      ) : (
        <button
          onClick={() => mut.mutate(null)}
          className="text-xs text-stone-500 hover:text-red-600 flex items-center gap-1"
          title="Eemalda juuretise link"
        >
          <Link2Off size={11} />
          Eemalda link
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-7 z-20 bg-white border border-stone-200 rounded-xl shadow-lg p-1 min-w-[200px]">
          {candidates.length === 0 && (
            <div className="text-xs text-stone-400 px-3 py-2">Teisi partii pole</div>
          )}
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => mut.mutate(c.id)}
              className="w-full text-left text-xs px-3 py-1.5 hover:bg-amber-50 rounded-lg"
            >
              #{c.id} — {c.teaSort || "Nimeta"} ({fmtDate(c.startDate)})
            </button>
          ))}
        </div>
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
}: {
  item: LifecycleItem;
  allBatches: LifecycleItem[];
  authFetch: ReturnType<typeof useAuthFetch>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isActive = !item.flavoringDate || !item.flavoringEvent?.bottlingDate;
  const isDone = !!item.flavoringEvent?.bottlingDate;

  const f1Status = item.flavoringDate ? "done" : "active";
  const f2Status = !item.flavoringDate ? "empty" : item.flavoringEvent?.bottlingDate ? "done" : "active";
  const bottlingStatus = isDone ? "done" : "empty";

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${isDone ? "border-stone-200 bg-white" : "border-amber-200 bg-amber-50/30"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isDone ? "bg-green-500" : "bg-amber-500"}`} />
          <div>
            <div className="font-semibold text-stone-800 text-sm">
              #{item.id} — {item.teaSort || "Nimeta tee"}
            </div>
            <div className="text-xs text-stone-500">
              Algus {fmtDate(item.startDate)}
              {item.totalVolumeL > 0 && ` · ${item.totalVolumeL.toFixed(1)} L`}
              {item.totalBottles > 0 && ` · ${item.totalBottles} pudelit`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Aktiivne</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Starter chain */}
          <div className="flex items-center gap-2">
            <GitBranch size={13} className="text-stone-400" />
            <span className="text-xs text-stone-500">Juuretis:</span>
            {item.starterSourceBatch ? (
              <span className="text-xs font-medium text-stone-700">
                Partii #{item.starterSourceBatch.id} — {item.starterSourceBatch.teaSort || "Nimeta"} ({fmtDate(item.starterSourceBatch.startDate)})
              </span>
            ) : (
              <span className="text-xs text-stone-400 italic">— linkimata</span>
            )}
            <StarterLinkSelector
              batchId={item.id}
              currentSourceId={item.starterSourceBatchId}
              allBatches={allBatches}
              authFetch={authFetch}
            />
          </div>

          {/* Timeline */}
          <div className="overflow-x-auto pb-1">
            <div className="flex items-stretch gap-0 min-w-max">
              {/* Pruulimine */}
              <StageBox icon={FlaskConical} title="Pruulimine" status={item.brew ? "done" : "empty"}>
                {item.brew ? (
                  <>
                    <div>{fmtDate(item.brew.date)}</div>
                    {item.brew.teaG > 0 && <div>{item.brew.teaG} g teed</div>}
                    {item.brew.sugarG > 0 && <div>{item.brew.sugarG} g suhkrut</div>}
                    <div>{(item.brew.boiledL + item.brew.coldWaterL).toFixed(1)} L vett</div>
                    {item.brew.steepMin && <div>Tõmbis {item.brew.steepMin} min</div>}
                    {item.brew.starterG > 0 && <div>Juuretis {item.brew.starterG} g ({item.brew.starterPct}%)</div>}
                  </>
                ) : (
                  <div className="text-stone-400">Puudub</div>
                )}
              </StageBox>

              <DurationBadge days={item.f1Days} label="F1" />

              {/* Käärimine */}
              <StageBox icon={Droplets} title="Käärimine F1" status={f1Status}>
                <div>Algus {fmtDate(item.startDate)}</div>
                {item.vessels.length > 0 && (
                  <div>{item.vessels.reduce((s, v) => s + v.count, 0)} anumad</div>
                )}
                {item.totalVolumeL > 0 && <div>{item.totalVolumeL.toFixed(1)} L kokku</div>}
                {item.flavoringDate ? (
                  <div>Lõpp {fmtDate(item.flavoringDate)}</div>
                ) : (
                  <div className="text-amber-600">Maitsestamata</div>
                )}
              </StageBox>

              <DurationBadge days={item.f2Days} label="F2" />

              {/* Maitsestamine */}
              <StageBox icon={Leaf} title="Maitsestamine F2" status={f2Status}>
                {item.flavoringEvent ? (
                  <>
                    <div>{fmtDate(item.flavoringEvent.date)}</div>
                    {item.flavoringEvent.blocks.map((bl, i) => (
                      <div key={i}>{bl.name || "Maitseaine"}: {bl.koguseL.toFixed(1)} L</div>
                    ))}
                    {!item.flavoringEvent.bottlingDate && (
                      <div className="text-amber-600">Pudeldamata</div>
                    )}
                  </>
                ) : (
                  <div className="text-stone-400">Ootel</div>
                )}
              </StageBox>

              {/* Connector */}
              <div className="flex flex-col items-center justify-center px-1">
                <div className="w-8 h-px bg-stone-300" />
              </div>

              {/* Pudeldamine */}
              <StageBox icon={Package} title="Pudeldamine" status={bottlingStatus}>
                {item.flavoringEvent?.bottlingDate ? (
                  <>
                    <div>{fmtDate(item.flavoringEvent.bottlingDate)}</div>
                    {item.totalBottles > 0 && <div>{item.totalBottles} pudelit</div>}
                  </>
                ) : (
                  <div className="text-stone-400">Ootel</div>
                )}
              </StageBox>
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="text-xs text-stone-500 border-t border-stone-100 pt-2">
              <span className="font-medium">Märkmed:</span> {item.notes}
            </div>
          )}

          {/* Flavor block detail */}
          {item.flavoringEvent?.blocks && item.flavoringEvent.blocks.length > 0 && (
            <div className="border-t border-stone-100 pt-2">
              <div className="text-xs font-semibold text-stone-600 mb-1.5">Maitseplokkide detail</div>
              <div className="space-y-1">
                {item.flavoringEvent.blocks.map((bl, i) => {
                  const bottles = bl.vesselL > 0 ? Math.floor(bl.koguseL / bl.vesselL) : 0;
                  return (
                    <div key={i} className="text-xs text-stone-600 flex gap-2">
                      <span className="font-medium">{bl.name || `Plokk ${i + 1}`}</span>
                      <span>{bl.koguseL.toFixed(1)} L</span>
                      {bl.gramsUsed > 0 && <span>{bl.gramsUsed.toFixed(0)} g</span>}
                      {bottles > 0 && <span>~ {bottles} pudelit</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EluigaPage() {
  const authFetch = useAuthFetch();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<LifecycleItem[]>({
    queryKey: ["lifecycle"],
    queryFn: async () => {
      const res = await authFetch("/fermentations/lifecycle");
      return res.json();
    },
  });

  const items = data ?? [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <GitBranch size={22} className="text-amber-600" />
          <div>
            <h1 className="text-2xl font-serif font-semibold text-stone-800">Tee eluiga</h1>
            <p className="text-sm text-stone-500">Iga partii täielik teekond pruulimisest pudeldamiseni</p>
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
          <div className="text-center py-16 text-stone-400">
            <Wheat size={40} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm">Käärimispartii pole veel lisatud.</div>
            <div className="text-xs mt-1">Lisa esimene partii Käärimine lehelt.</div>
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
          />
        ))}
      </div>
    </Layout>
  );
}
