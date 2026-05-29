import React, { useState, useEffect } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Boxes, FlaskConical, Tags, History, Plus, RotateCcw, Trash2, AlertTriangle, Pencil, Check, X, PenLine, ShoppingBag, Leaf, Minus, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const SIZES = [330, 500, 750];
const CAP_TYPES = ["kroonkork", "punnkork"];
const LADU_QUERY_KEY = ["ladu"] as const;

const COLOR_HEX: Record<string, string> = {
  sinine: "#2563eb",
  punane: "#dc2626",
  kollane: "#eab308",
  roheline: "#16a34a",
  pruun: "#92400e",
  valge: "#f5f5f4",
  must: "#1c1917",
  läbipaistev: "#d6d3d1",
};

type Flavor = { id: number; name: string; defaultCapId: number | null };
type Bottle = { id: number; size: number; qty: number };
type BrewMin = { id: number; date: string; sessionId: number | null };
type FermMin = { id: number; brewId: number | null };
type EventMin = { id: number; date: string; bottlingDate: string | null; fermentationBatchId: number | null };
type Label = { id: number; flavorId: number; size: number; qty: number };
type Cap = { id: number; size: number; type: string; color: string; qty: number };
type CustomLabelBottle = { id: number; size: number; qty: number };
type Movement = { id: number; type: string; summary: string; deltas: unknown[]; createdAt: string };
type BlankLabelType = { id: number; userId: string; name: string };
type BlankLabel = { id: number; userId: string; blankLabelTypeId: number; size: number; qty: number };
type FinishedGoods = { id: number; flavorId: number; size: number; qty: number };
type Material = { id: number; userId: string; name: string; unit: string; qty: number; minStock: number | null };
type ReturnedBottle = { id: number; flavorId: number; size: number; qty: number };

type ReusableCap = { size: number; qty: number };

type LaduData = {
  flavors: Flavor[];
  bottles: Bottle[];
  labels: Label[];
  caps: Cap[];
  customLabelBottles: CustomLabelBottle[];
  wireCageQty: number;
  reusableCaps: ReusableCap[];
  movements: Movement[];
  blankLabelTypes: BlankLabelType[];
  blankLabels: BlankLabel[];
  finishedGoods: FinishedGoods[];
  materials: Material[];
  returnedBottles: ReturnedBottle[];
};

const EMPTY: LaduData = {
  flavors: [],
  bottles: [],
  labels: [],
  caps: [],
  customLabelBottles: [],
  wireCageQty: 0,
  reusableCaps: [],
  movements: [],
  blankLabelTypes: [],
  blankLabels: [],
  finishedGoods: [],
  materials: [],
  returnedBottles: [],
};

const capLabel = (c: Cap | undefined) =>
  c ? `${c.size} ml · ${c.type || "kork"}${c.color ? " · " + c.color : ""}` : "";

function ColorDot({ color }: { color: string }) {
  const hex = COLOR_HEX[(color || "").toLowerCase()];
  if (!hex) return null;
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-stone-300 align-middle mr-1"
      style={{ backgroundColor: hex }}
    />
  );
}

function Num({ value, onChange, onKeyDown, className = "" }: { value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; className?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 ${className}`}
    />
  );
}

function Seg({ options, value, onChange }: { options: { value: number | string; label: string }[]; value: number | string; onChange: (v: number | string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            value === o.value
              ? "bg-amber-700 text-white shadow-sm"
              : "text-stone-600 hover:bg-stone-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="font-serif text-lg text-stone-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res;
  };
}

export default function LaduPage() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  const [tab, setTab] = useState("valmistoodang");
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const flash = (msg: string) => {
    setToast({ msg, isError: false });
    setTimeout(() => setToast(null), 2600);
  };

  const flashError = (msg: string) => {
    setToast({ msg, isError: true });
    setTimeout(() => setToast(null), 3500);
  };

  const { data = EMPTY, isLoading, isError } = useQuery<LaduData>({
    queryKey: LADU_QUERY_KEY,
    queryFn: async () => {
      const res = await authFetch("/ladu");
      return res.json();
    },
  });

  const brewsTraceQ = useQuery<BrewMin[]>({
    queryKey: ["brews"],
    queryFn: async () => {
      const res = await authFetch("/brews");
      return res.json();
    },
  });
  const fermsTraceQ = useQuery<FermMin[]>({
    queryKey: ["fermentations"],
    queryFn: async () => {
      const res = await authFetch("/fermentations");
      return res.json();
    },
  });
  const eventsTraceQ = useQuery<EventMin[]>({
    queryKey: ["flavoring-events"],
    queryFn: async () => {
      const res = await authFetch("/flavoring/events");
      return res.json();
    },
  });

  const commitMutation = useMutation({
    mutationFn: async ({ deltas, type, summary, villimineGoods }: { deltas: unknown[]; type: string; summary: string; villimineGoods?: { flavorId: number; size: number; amount: number; flavoringEventId?: number } }) => {
      const res = await authFetch("/ladu/commit", {
        method: "POST",
        body: JSON.stringify({ type, summary, deltas, ...(villimineGoods ? { villimineGoods } : {}) }),
      });
      return res.json() as Promise<LaduData>;
    },
    onSuccess: (updated) => {
      qc.setQueryData(LADU_QUERY_KEY, updated);
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const undoMutation = useMutation({
    mutationFn: async (movId: number) => {
      await authFetch(`/ladu/movements/${movId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LADU_QUERY_KEY });
      flash("Kanne võetud tagasi");
    },
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  const addFlavorMutation = useMutation({
    mutationFn: async ({ name, defaultCapId }: { name: string; defaultCapId: number | null }) => {
      const res = await authFetch("/ladu/flavors", {
        method: "POST",
        body: JSON.stringify({ name, defaultCapId }),
      });
      return res.json() as Promise<Flavor>;
    },
    onSuccess: (flavor) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        flavors: [...old.flavors, flavor],
      }));
      flash("Maitse lisatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const removeFlavorMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/ladu/flavors/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        flavors: old.flavors.filter((f) => f.id !== id),
      }));
      flash("Maitse eemaldatud");
    },
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  const updateFlavorMutation = useMutation({
    mutationFn: async ({ id, name, defaultCapId }: { id: number; name: string; defaultCapId: number | null }) => {
      const res = await authFetch(`/ladu/flavors/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, defaultCapId }),
      });
      return res.json() as Promise<Flavor>;
    },
    onSuccess: (updated) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        flavors: old.flavors.map((f) => (f.id === updated.id ? updated : f)),
      }));
      flash("Maitse uuendatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const updateCapMutation = useMutation({
    mutationFn: async ({ id, size, type, color }: { id: number; size: number; type: string; color: string }) => {
      const res = await authFetch(`/ladu/caps/${id}`, {
        method: "PUT",
        body: JSON.stringify({ size, type, color }),
      });
      return res.json() as Promise<Cap>;
    },
    onSuccess: (updated) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        caps: old.caps.map((c) => (c.id === updated.id ? updated : c)),
      }));
      flash("Kork uuendatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const finishedGoodsCommitMutation = useMutation({
    mutationFn: async ({ flavorId, size, sold, given, note }: { flavorId: number; size: number; sold: number; given: number; note: string }) => {
      const res = await authFetch("/ladu/finished-goods/commit", {
        method: "POST",
        body: JSON.stringify({ flavorId, size, sold, given, note }),
      });
      return res.json() as Promise<LaduData>;
    },
    onSuccess: (updated) => {
      qc.setQueryData(LADU_QUERY_KEY, updated);
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const addMaterialMutation = useMutation<Material, Error, { name: string; unit: string; minStock?: number }>({
    mutationFn: async ({ name, unit, minStock }) => {
      const res = await authFetch("/ladu/materials", {
        method: "POST",
        body: JSON.stringify({ name, unit, ...(minStock != null ? { minStock } : {}) }),
      });
      return res.json() as Promise<Material>;
    },
    onSuccess: (m) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        materials: [...old.materials, m],
      }));
      flash("Tooraine lisatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const updateMaterialMutation = useMutation<Material, Error, { id: number; name: string; unit: string; minStock?: number | null }>({
    mutationFn: async ({ id, name, unit, minStock }) => {
      const res = await authFetch(`/ladu/materials/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, unit, minStock: minStock ?? null }),
      });
      return res.json() as Promise<Material>;
    },
    onSuccess: (m) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        materials: old.materials.map((x) => (x.id === m.id ? m : x)),
      }));
      flash("Tooraine uuendatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/ladu/materials/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        materials: old.materials.filter((m) => m.id !== id),
      }));
      flash("Tooraine eemaldatud");
    },
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await authFetch("/ladu/reset", { method: "DELETE" });
    },
    onSuccess: () => {
      qc.setQueryData(LADU_QUERY_KEY, EMPTY);
      flash("Andmed lähtestatud");
    },
    onError: (err: Error) => flashError(err.message || "Lähtestamine ebaõnnestus"),
  });

  const resetAll = () => {
    if (!confirm("Kustutan kõik andmed?")) return;
    resetMutation.mutate();
  };

  const flavorName = (id: number) => data.flavors.find((f) => f.id === id)?.name ?? "?";
  const bottleQty = (size: number) => data.bottles.find((b) => b.size === size)?.qty ?? 0;

  const tabs = [
    { id: "valmistoodang", label: "Valmistoodang", icon: ShoppingBag },
    { id: "ladu", label: "Ladu", icon: Boxes },
    { id: "villimine", label: "Villimine", icon: FlaskConical },
    { id: "varu", label: "Lisa varu", icon: Plus },
    { id: "toorained", label: "Toorained", icon: Leaf },
    { id: "maitsed", label: "Maitsed", icon: Tags },
    { id: "ajalugu", label: "Ajalugu", icon: History },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] text-stone-500">Laen ladu…</div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] text-red-500">Lao laadimine ebaõnnestus.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <header className="mb-5">
          <h1 className="font-serif text-2xl text-stone-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-700" /> Kombucha ladu
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Pudelid, sildid ja korgid ühes kohas. Villimine arvab varud ise maha.
          </p>
        </header>

        <nav className="flex flex-wrap gap-1 mb-6 border-b border-stone-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 transition ${
                  tab === t.id
                    ? "border-amber-700 text-amber-800 font-medium"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {tab === "valmistoodang" && (
          <ValmistoodangTab data={data} flavorName={flavorName} finishedGoodsCommitMutation={finishedGoodsCommitMutation} flash={flash} />
        )}
        {tab === "ladu" && <LaduTab data={data} flavorName={flavorName} bottleQty={bottleQty} updateCapMutation={updateCapMutation} flash={flash} />}
        {tab === "villimine" && (
          <VillimineTab
            data={data}
            flavorName={flavorName}
            commitMutation={commitMutation}
            flash={flash}
            flavEvents={eventsTraceQ.data ?? []}
            ferms={fermsTraceQ.data ?? []}
            brews={brewsTraceQ.data ?? []}
          />
        )}
        {tab === "varu" && (
          <LisaVaruTab data={data} commitMutation={commitMutation} flash={flash} />
        )}
        {tab === "toorained" && (
          <TooraineTab
            data={data}
            commitMutation={commitMutation}
            addMaterialMutation={addMaterialMutation}
            updateMaterialMutation={updateMaterialMutation}
            deleteMaterialMutation={deleteMaterialMutation}
            flash={flash}
          />
        )}
        {tab === "maitsed" && (
          <MaitsedTab
            data={data}
            addFlavorMutation={addFlavorMutation}
            removeFlavorMutation={removeFlavorMutation}
            updateFlavorMutation={updateFlavorMutation}
            resetAll={resetAll}
          />
        )}
        {tab === "ajalugu" && (
          <AjaluguTab
            data={data}
            undoMutation={undoMutation}
            brews={brewsTraceQ.data ?? []}
            ferms={fermsTraceQ.data ?? []}
            flavEvents={eventsTraceQ.data ?? []}
            flash={flash}
            flashError={flashError}
          />
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 ${toast.isError ? "bg-red-600" : "bg-stone-900"}`}>
          {toast.msg}
        </div>
      )}
    </Layout>
  );
}

type CommitMutation = ReturnType<typeof useMutation<LaduData, Error, { deltas: unknown[]; type: string; summary: string; villimineGoods?: { flavorId: number; size: number; amount: number; flavoringEventId?: number } }>>;

function LaduTab({ data, flavorName, bottleQty, updateCapMutation, flash }: { data: LaduData; flavorName: (id: number) => string; bottleQty: (size: number) => number; updateCapMutation: ReturnType<typeof useMutation<Cap, Error, { id: number; size: number; type: string; color: string }>>; flash: (msg: string) => void }) {
  const [editingCapId, setEditingCapId] = useState<number | null>(null);
  const [editSize, setEditSize] = useState(330);
  const [editType, setEditType] = useState("kroonkork");
  const [editColor, setEditColor] = useState("");
  const [editPunnkorkKat, setEditPunnkorkKat] = useState<"uus" | "taaskasutus">("uus");

  const startEditCap = (c: Cap) => {
    setEditingCapId(c.id);
    setEditSize(c.size);
    setEditType(c.type);
    if (c.type === "punnkork") {
      setEditPunnkorkKat((c.color === "taaskasutus" ? "taaskasutus" : "uus") as "uus" | "taaskasutus");
      setEditColor("");
    } else {
      setEditColor(c.color);
    }
  };

  const saveEditCap = (id: number) => {
    const color = editType === "punnkork" ? editPunnkorkKat : editColor.trim();
    updateCapMutation.mutate(
      { id, size: editSize, type: editType, color },
      { onSuccess: () => setEditingCapId(null) }
    );
  };
  const Low = ({ show }: { show: boolean }) =>
    show ? (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
        <AlertTriangle className="w-3 h-3" /> telli juurde
      </span>
    ) : null;

  const customLabelQty = (size: number) =>
    data.customLabelBottles.find((b) => b.size === size)?.qty ?? 0;

  return (
    <div className="space-y-7">
      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3">Pudelid</h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = bottleQty(s);
            return (
              <div key={s} className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <div className="text-xs text-stone-500">{s} ml</div>
                <div className={`text-2xl font-semibold ${n <= 0 ? "text-red-600" : "text-stone-900"}`}>{n}</div>
                <Low show={n <= 0} />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3">Kohandatud sildiga pudelid</h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = customLabelQty(s);
            return (
              <div key={s} className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <div className="text-xs text-stone-500">{s} ml</div>
                <div className={`text-2xl font-semibold ${n <= 0 ? "text-red-600" : "text-stone-900"}`}>{n}</div>
                <Low show={n <= 0} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Tühi kohandatud silt peal — maitsekleeps lisatakse villimise ajal.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3">Sildid</h2>
        {data.labels.length === 0 ? (
          <p className="text-sm text-stone-400">Veel ühtegi silti pole lisatud.</p>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-stone-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Maitse</th>
                  <th className="px-4 py-2 font-medium">Suurus</th>
                  <th className="px-4 py-2 font-medium text-right">Kogus</th>
                </tr>
              </thead>
              <tbody>
                {data.labels
                  .slice()
                  .sort((a, b) => flavorName(a.flavorId).localeCompare(flavorName(b.flavorId)))
                  .map((l) => (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-4 py-2">{flavorName(l.flavorId)}</td>
                      <td className="px-4 py-2 text-stone-500">{l.size} ml</td>
                      <td className={`px-4 py-2 text-right font-medium ${l.qty <= 0 ? "text-red-600" : ""}`}>{l.qty}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-700" /> Tagastatud pudelid
        </h2>
        {data.returnedBottles.filter((r) => r.qty > 0).length === 0 ? (
          <p className="text-sm text-stone-400">Tagastatud pudeleid pole laos. Lisa "Lisa varu" vahekaardil.</p>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-stone-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Maitse</th>
                  <th className="px-4 py-2 font-medium">Suurus</th>
                  <th className="px-4 py-2 font-medium text-right">Kogus</th>
                </tr>
              </thead>
              <tbody>
                {data.returnedBottles
                  .filter((r) => r.qty > 0)
                  .slice()
                  .sort((a, b) => flavorName(a.flavorId).localeCompare(flavorName(b.flavorId)))
                  .map((r) => (
                    <tr key={r.id} className="border-t border-stone-100">
                      <td className="px-4 py-2">{flavorName(r.flavorId)}</td>
                      <td className="px-4 py-2 text-stone-500">{r.size} ml</td>
                      <td className="px-4 py-2 text-right font-medium">{r.qty}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-stone-400 mt-2">
          Pudelid, mis on tagastatud klientide poolt ja valmis taaskasutusse.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3">Korduvkasutatavad punnkorgid</h2>
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-center max-w-[8rem]">
          <div className={`text-2xl font-semibold ${(data.reusableCaps.find((r) => r.size === 750)?.qty ?? 0) <= 0 ? "text-red-600" : "text-stone-900"}`}>
            {data.reusableCaps.find((r) => r.size === 750)?.qty ?? 0}
          </div>
          <Low show={(data.reusableCaps.find((r) => r.size === 750)?.qty ?? 0) <= 0} />
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Puhtad punnkorgid, mis on valmis taaskasutusse — villimise ajal arvatakse maha.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-amber-700" /> Vabalt kirjutatavad sildid
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = data.blankLabels.filter((l) => l.size === s).reduce((sum, l) => sum + l.qty, 0);
            return (
              <div key={s} className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <div className="text-xs text-stone-500">{s} ml</div>
                <div className={`text-2xl font-semibold ${n <= 0 ? "text-red-600" : "text-stone-900"}`}>{n}</div>
                <Low show={n <= 0} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Koguste muutmiseks mine "Lisa varu" vahekaardile.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3">Korgid</h2>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden mb-3">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <span className="text-sm font-medium text-stone-700">Traatkorgi (750 ml)</span>
            <span className={`text-lg font-semibold ${data.wireCageQty <= 0 ? "text-red-600" : "text-stone-900"}`}>{data.wireCageQty}</span>
          </div>
        </div>
        {data.caps.length === 0 ? (
          <p className="text-sm text-stone-400">Veel ühtegi korki pole lisatud.</p>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-stone-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Kork</th>
                  <th className="px-4 py-2 font-medium text-right">Kogus</th>
                </tr>
              </thead>
              <tbody>
                {data.caps.map((c) => {
                  if (editingCapId === c.id) {
                    return (
                      <tr key={c.id} className="border-t border-stone-100 bg-amber-50">
                        <td className="px-3 py-2" colSpan={2}>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <select value={editSize} onChange={(e) => setEditSize(parseInt(e.target.value))} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
                                {SIZES.map((s) => <option key={s} value={s}>{s} ml</option>)}
                              </select>
                              <select value={editType} onChange={(e) => { setEditType(e.target.value); setEditColor(""); }} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
                                {CAP_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                              </select>
                            </div>
                            {editType === "punnkork" ? (
                              <Seg
                                options={[{ value: "uus", label: "Uus" }, { value: "taaskasutus", label: "Taaskasutus" }]}
                                value={editPunnkorkKat}
                                onChange={(v) => setEditPunnkorkKat(v as "uus" | "taaskasutus")}
                              />
                            ) : (
                              <input
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                placeholder="värv (valikuline)"
                                className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                              />
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditCap(c.id)}
                                disabled={updateCapMutation.isPending}
                                className="flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-60"
                              >
                                <Check className="w-3 h-3" /> Salvesta
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCapId(null)}
                                className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
                              >
                                <X className="w-3 h-3" /> Tühista
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={c.id} className="border-t border-stone-100">
                      <td className="px-4 py-2">
                        <ColorDot color={c.color} />
                        {c.type === "punnkork"
                          ? `${c.size} ml · punnkork${c.color ? ` · ${c.color}` : ""}`
                          : capLabel(c)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-medium ${c.qty <= 0 ? "text-red-600" : ""}`}>{c.qty}</span>
                          <button
                            type="button"
                            onClick={() => startEditCap(c)}
                            className="text-stone-400 hover:text-amber-700"
                            title="Muuda"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-stone-400 mt-2">
          750 ml punnkorkide kasutamisel arvatakse traatkorgi automaatselt maha.
        </p>
      </section>
    </div>
  );
}

function VillimineTab({ data, flavorName, commitMutation, flash, flavEvents, ferms, brews }: { data: LaduData; flavorName: (id: number) => string; commitMutation: CommitMutation; flash: (msg: string) => void; flavEvents: EventMin[]; ferms: FermMin[]; brews: BrewMin[] }) {
  const [flavorId, setFlavorId] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [size, setSize] = useState<number>(330);
  const [linkedEventId, setLinkedEventId] = useState<number | "">("");
  const [savedStarterG, setSavedStarterG] = useState("");
  const [total, setTotal] = useState("");
  const [returned, setReturned] = useState("");
  const [fromCustom, setFromCustom] = useState("");
  const [fromBlank, setFromBlank] = useState("0");
  const [capId, setCapId] = useState<number | "">(() => {
    const firstFlavor = data.flavors[0];
    if (!firstFlavor?.defaultCapId) return "";
    const defaultCap = data.caps.find((c) => c.id === firstFlavor.defaultCapId);
    if (defaultCap && defaultCap.size === 330) return defaultCap.id;
    return "";
  });
  const [oldCaps, setOldCaps] = useState("");

  useEffect(() => {
    const capsForSize = data.caps.filter((c) => c.size === size);
    if (!flavorId) { setCapId(capsForSize.length > 0 ? capsForSize[0].id : ""); return; }
    const flavor = data.flavors.find((f) => f.id === flavorId);
    const defaultCap = flavor?.defaultCapId ? data.caps.find((c) => c.id === flavor.defaultCapId) : null;
    if (defaultCap && defaultCap.size === size) {
      setCapId(defaultCap.id);
    } else if (capsForSize.length > 0) {
      setCapId(capsForSize[0].id);
    } else {
      setCapId("");
    }
  }, [flavorId, size]);

  const isDirtyVillimine =
    total !== "" ||
    returned !== "" ||
    fromCustom !== "" ||
    fromBlank !== "0" ||
    savedStarterG !== "" ||
    linkedEventId !== "" ||
    oldCaps !== "";
  useUnsavedChanges(isDirtyVillimine);

  const sizeCaps = data.caps.filter((c) => c.size === size);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const newCount = t - ret;
  const fromCust = Math.min(newCount, Math.max(0, parseInt(fromCustom) || 0));
  const fromBlankRaw = Math.max(0, parseInt(fromBlank) || 0);
  const fromBlankUsed = Math.min(fromBlankRaw, newCount - fromCust);
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));

  const selectedCap = data.caps.find((c) => c.id === capId);
  const isPunnkork = selectedCap?.type === "punnkork";
  const reusableStock = data.reusableCaps.find((r) => r.size === size)?.qty ?? 0;
  const blankLabelStock = data.blankLabels.filter((l) => l.size === size).reduce((sum, l) => sum + l.qty, 0);
  const bottleStock = data.bottles.find((b) => b.size === size)?.qty ?? 0;
  const customLabelBottleStock = data.customLabelBottles.find((b) => b.size === size)?.qty ?? 0;
  const labelStock = flavorId !== "" ? (data.labels.find((l) => l.flavorId === (flavorId as number) && l.size === size)?.qty ?? 0) : null;
  const returnedStock = flavorId !== ""
    ? (data.returnedBottles.find((r) => r.flavorId === (flavorId as number) && r.size === size)?.qty ?? 0)
    : 0;
  const bottleDeduct = newCount - fromCust;
  const customLabelBottleDeduct = fromCust;
  const labelDeduct = newCount - fromCust - fromBlankUsed;
  const blankLabelDeduct = fromBlankUsed;
  const capDeduct = capId !== "" ? t - old : 0;
  const wireCageDeduct = size === 750 && isPunnkork ? t : 0;
  const reusableCapDeduct = isPunnkork ? old : 0;

  const villi = () => {
    if (!flavorId) return flash("Vali maitse");
    if (t <= 0) return flash("Sisesta pudelite arv");
    if (ret > returnedStock) return flash(`Tagastatud pudeleid on laos ainult ${returnedStock} tk (${size} ml)`);

    const deltas: unknown[] = [];
    if (bottleDeduct > 0) deltas.push({ kind: "bottle", key: size, amount: -bottleDeduct });
    if (customLabelBottleDeduct > 0) deltas.push({ kind: "custom_label_bottle", size, amount: -customLabelBottleDeduct });
    if (labelDeduct > 0) deltas.push({ kind: "label", flavorId, size, amount: -labelDeduct });
    if (blankLabelDeduct > 0) deltas.push({ kind: "blank_label", blankLabelTypeId: 0, size, amount: -blankLabelDeduct });
    if (capId !== "" && capDeduct > 0) deltas.push({ kind: "cap", key: capId, amount: -capDeduct });
    if (wireCageDeduct > 0) deltas.push({ kind: "wire_cage", amount: -wireCageDeduct });
    if (reusableCapDeduct > 0) deltas.push({ kind: "reusable_cap", size, amount: -reusableCapDeduct });
    if (ret > 0) deltas.push({ kind: "returned_bottle", flavorId, size, amount: -ret });

    const cap = selectedCap;
    const parts = [`Villisin ${t} × ${flavorName(flavorId as number)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud pudelit`);
    if (fromCust) parts.push(`${fromCust} kohandatud sildiga pudelit`);
    if (fromBlankUsed > 0) parts.push(`${fromBlankUsed} vabalt kirjutatava sildiga pudelit`);
    if (reusableCapDeduct > 0) parts.push(`${reusableCapDeduct} korduvkasutatavat punnkorki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);
    if (wireCageDeduct > 0) parts.push(`${wireCageDeduct} traatkorki`);

    const savedG = parseInt(savedStarterG) || 0;
    commitMutation.mutate(
      {
        deltas,
        type: "villimine",
        summary: parts.join(" · "),
        villimineGoods: {
          flavorId: flavorId as number,
          size,
          amount: t,
          ...(linkedEventId !== "" ? { flavoringEventId: linkedEventId as number } : {}),
          ...(linkedEventId !== "" && savedG > 0 ? { savedStarterG: savedG } : {}),
        },
      },
      {
        onSuccess: () => {
          flash("Villimine kirja pandud");
          setTotal(""); setReturned(""); setFromCustom(""); setFromBlank("0"); setOldCaps(""); setLinkedEventId(""); setSavedStarterG("");
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Maitse</label>
          {data.flavors.length === 0 ? (
            <p className="text-sm text-stone-400">Lisa esmalt maitsed "Maitsed" vahekaardil.</p>
          ) : (
            <select
              value={flavorId}
              onChange={(e) => setFlavorId(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
            >
              {data.flavors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>

        {(() => {
          const linkableEvents = flavEvents
            .filter((e) => e.fermentationBatchId != null)
            .sort((a, b) => b.id - a.id)
            .slice(0, 20);
          if (linkableEvents.length === 0) return null;
          const selectedEvent = linkableEvents.find((e) => e.id === linkedEventId);
          const selectedFerm = selectedEvent?.fermentationBatchId != null ? ferms.find((f) => f.id === selectedEvent.fermentationBatchId) : null;
          const selectedBrew = selectedFerm?.brewId != null ? brews.find((b) => b.id === selectedFerm.brewId) : null;
          let brewLabel: string | null = null;
          if (selectedBrew) {
            if (selectedBrew.sessionId != null) {
              const sessionBrews = brews.filter((b) => b.sessionId === selectedBrew.sessionId).sort((a, b) => a.id - b.id);
              const idx = sessionBrews.findIndex((b) => b.id === selectedBrew.id) + 1;
              brewLabel = `Pruulimine: ${new Date(selectedBrew.date).toLocaleDateString("et-EE")} · Ports ${idx}/${sessionBrews.length}`;
            } else {
              brewLabel = `Pruulimine: ${new Date(selectedBrew.date).toLocaleDateString("et-EE")}`;
            }
          }
          return (
            <div>
              <label className="block text-sm text-stone-600 mb-1">Seo maitsestamise kirjega <span className="text-stone-400">(jälgitavus, valikuline)</span></label>
              <select
                value={linkedEventId}
                onChange={(e) => setLinkedEventId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
              >
                <option value="">— ei seo —</option>
                {linkableEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.date).toLocaleDateString("et-EE")}{e.bottlingDate ? ` → villimine ${new Date(e.bottlingDate).toLocaleDateString("et-EE")}` : ""}
                  </option>
                ))}
              </select>
              {brewLabel && (
                <p className="text-xs text-amber-700 mt-1">{brewLabel}</p>
              )}
            </div>
          );
        })()}

        {linkedEventId !== "" && (
          <div>
            <label className="block text-sm text-stone-600 mb-1">
              Juuretis järgmisele (g) <span className="text-stone-400">(valikuline)</span>
            </label>
            <Num value={savedStarterG} onChange={setSavedStarterG} />
            <p className="text-xs text-stone-400 mt-1">Kui jätsid osa kombuchast järgmise partii juuretiseks, sisesta kogus grammides.</p>
          </div>
        )}

        <div>
          <label className="block text-sm text-stone-600 mb-1">Suurus</label>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={size} onChange={(v) => setSize(v as number)} />
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Mitu pudelit kokku tegid?</label>
          <Num value={total} onChange={setTotal} />
          <p className="text-xs text-stone-400 mt-1">Laos: {bottleStock} tk tühjad pudelid ({size} ml)</p>
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Tagasi tulnud pudelid</label>
          <Num value={returned} onChange={setReturned} />
          {returnedStock > 0 && ret <= returnedStock && (
            <p className="text-xs text-stone-400 mt-1">Laos: {returnedStock} tk</p>
          )}
          {ret > returnedStock && returnedStock === 0 && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Tagastatud pudeleid pole selle maitse laos
            </p>
          )}
          {ret > returnedStock && returnedStock > 0 && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Laos on ainult {returnedStock} tk
            </p>
          )}
          {returnedStock === 0 && ret === 0 && (
            <p className="text-xs text-stone-400 mt-1">Pudel + silt koos. Lisa tagastused "Lisa varu" vahekaardil.</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Kohandatud sildiga pudelid</label>
          <Num value={fromCustom} onChange={setFromCustom} />
          <p className="text-xs text-stone-400 mt-1">Laos: {customLabelBottleStock} tk · arvatakse vastavast varust maha</p>
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Vabalt kirjutatavad sildid</label>
          <Num value={fromBlank} onChange={setFromBlank} />
          {fromBlankRaw <= blankLabelStock && (
            <p className="text-xs text-stone-400 mt-1">Laos: {blankLabelStock} tk ({size} ml)</p>
          )}
          {fromBlankRaw > blankLabelStock && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Laos on ainult {blankLabelStock} tk ({size} ml)
            </p>
          )}
          <p className="text-xs text-stone-400 mt-1">
            Arvatakse vabalt kirjutatavate siltide varust maha. Tagasi tulnud pudel märgi "Tagasi tulnud pudelid" alla — sildi varu ei muutu.
          </p>
        </div>

        <div className={isPunnkork ? "grid grid-cols-2 gap-3" : ""}>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Kork</label>
            <select
              value={capId}
              onChange={(e) => { setCapId(e.target.value ? Number(e.target.value) : ""); setOldCaps(""); }}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
            >
              {sizeCaps.length === 0
                ? <option value="">— korki pole —</option>
                : <>
                    {capId === "" && <option value="" disabled>— vali kork —</option>}
                    {sizeCaps.map((c) => {
                      const flavor = flavorId !== "" ? data.flavors.find((f) => f.id === flavorId) : null;
                      const isDefault = flavor?.defaultCapId === c.id;
                      return (
                        <option key={c.id} value={c.id}>
                          {capLabel(c)}{isDefault ? " (vaikimisi)" : ""}
                        </option>
                      );
                    })}
                  </>
              }
            </select>
            {selectedCap && (
              <p className="text-xs text-stone-400 mt-1">Laos: {selectedCap.qty} tk</p>
            )}
          </div>
          {isPunnkork && (
            <div>
              <label className="block text-sm text-stone-600 mb-1">Korduvkasutatavaid korke kasutatud</label>
              <Num value={oldCaps} onChange={setOldCaps} />
              <p className="text-xs text-stone-400 mt-1">Laos: {reusableStock} tk</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-stone-700">
        <p className="font-medium text-amber-900 mb-2">Laost arvatakse maha:</p>
        <ul className="space-y-1">
          <li>Tühjad pudelid {size} ml: <b>{bottleDeduct}</b></li>
          <li>Kohandatud sildiga pudelid {size} ml: <b>{customLabelBottleDeduct}</b></li>
          <li>Sildid {flavorId ? flavorName(flavorId as number) : "—"} {size} ml: <b>{labelDeduct}</b>{labelStock != null ? <span className="text-stone-400 font-normal"> (laos: {labelStock} tk)</span> : null}</li>
          <li>Vabalt kirjutatavad sildid {size} ml: <b>{blankLabelDeduct}</b></li>
          <li>
            Korgid: <b>{capId !== "" ? capDeduct : 0}</b>
            {capId !== "" && <span className="text-stone-500"> ({capLabel(selectedCap)})</span>}
          </li>
          {wireCageDeduct > 0 && <li>Traatkorgi: <b>{wireCageDeduct}</b></li>}
          {reusableCapDeduct > 0 && <li>Korduvkasutatavad punnkorgid {size} ml: <b>{reusableCapDeduct}</b></li>}
          <li className="text-amber-800 font-medium">Valmistoodang + <b>{t}</b></li>
        </ul>
      </div>

      <button
        onClick={villi}
        disabled={commitMutation.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 transition disabled:opacity-60"
      >
        {commitMutation.isPending ? "Salvestan…" : "Pane villimine kirja"}
      </button>
    </div>
  );
}

function ValmistoodangTab({ data, flavorName, finishedGoodsCommitMutation, flash }: { data: LaduData; flavorName: (id: number) => string; finishedGoodsCommitMutation: ReturnType<typeof useMutation<LaduData, Error, { flavorId: number; size: number; sold: number; given: number; note: string }>>; flash: (msg: string) => void }) {
  const [fgFlavorId, setFgFlavorId] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [fgSize, setFgSize] = useState<number>(330);
  const [sold, setSold] = useState("");
  const [given, setGiven] = useState("");
  const [note, setNote] = useState("");

  const isDirtyValmistoodang = sold !== "" || given !== "" || note !== "";
  useUnsavedChanges(isDirtyValmistoodang);

  const fgQty = (flavorId: number, size: number) =>
    data.finishedGoods.find((g) => g.flavorId === flavorId && g.size === size)?.qty ?? 0;

  const availableSizes = fgFlavorId !== "" ? SIZES.filter((s) => fgQty(fgFlavorId as number, s) > 0) : [];
  const effectiveSize = availableSizes.includes(fgSize) ? fgSize : (availableSizes[0] ?? 330);
  const available = fgFlavorId !== "" ? fgQty(fgFlavorId as number, effectiveSize) : 0;

  const soldAmt = Math.max(0, parseInt(sold) || 0);
  const givenAmt = Math.max(0, parseInt(given) || 0);
  const totalOut = soldAmt + givenAmt;
  const overStock = totalOut > available;

  const submit = () => {
    if (!fgFlavorId) return flash("Vali maitse");
    if (availableSizes.length === 0) return flash("Valitud maitse pole laos");
    if (totalOut <= 0) return flash("Sisesta müüdud või ära antud kogus");
    if (overStock) return flash(`Laos on ainult ${available} pudelit`);

    finishedGoodsCommitMutation.mutate(
      { flavorId: fgFlavorId as number, size: effectiveSize, sold: soldAmt, given: givenAmt, note: note.trim() },
      {
        onSuccess: () => {
          flash("Väljastamine kirja pandud");
          setSold(""); setGiven(""); setNote("");
        },
      }
    );
  };

  const hasFlavors = data.flavors.length > 0;
  const totalFinished = data.finishedGoods.reduce((s, g) => s + Math.max(0, g.qty), 0);

  return (
    <div className="space-y-7">
      <section>
        {!hasFlavors ? (
          <p className="text-sm text-stone-400">Lisa esmalt maitsed "Maitsed" vahekaardil.</p>
        ) : data.finishedGoods.filter((g) => g.qty > 0).length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">Valmistoodangut pole veel laos.</p>
            <p className="text-stone-400 text-xs mt-1">Villimine lisab pudelid automaatselt siia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.flavors.map((flavor) => {
              const sizes = SIZES.map((s) => ({ size: s, qty: fgQty(flavor.id, s) }));
              const totalForFlavor = sizes.reduce((s, x) => s + Math.max(0, x.qty), 0);
              const isEmpty = totalForFlavor === 0;
              return (
                <div
                  key={flavor.id}
                  className={`rounded-xl border bg-white overflow-hidden transition ${isEmpty ? "border-stone-100 opacity-50" : "border-stone-200"}`}
                >
                  <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                    <span className="font-serif text-stone-900 font-medium">{flavor.name}</span>
                    <span className="text-xs text-stone-400">{totalForFlavor} tk kokku</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-stone-100">
                    {sizes.map(({ size, qty }) => (
                      <div key={size} className="p-4 text-center">
                        <div className="text-xs text-stone-500 mb-1">{size} ml</div>
                        <div className={`text-3xl font-semibold ${qty <= 0 ? "text-stone-300" : "text-stone-900"}`}>{qty}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {totalFinished > 0 && (
          <p className="text-xs text-stone-400 mt-2 text-right">{totalFinished} pudelit kokku laos</p>
        )}
      </section>

      {hasFlavors && (
        <section>
          <h2 className="font-serif text-lg text-stone-900 mb-3">Väljasta pudeleid</h2>
          <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-stone-600 mb-1">Maitse</label>
                <select
                  value={fgFlavorId}
                  onChange={(e) => { setFgFlavorId(Number(e.target.value)); setSold(""); setGiven(""); }}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
                >
                  {data.flavors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">Suurus</label>
                {availableSizes.length === 0 ? (
                  <p className="text-sm text-stone-400 py-2">Pole laos</p>
                ) : (
                  <Seg
                    options={availableSizes.map((s) => ({ value: s, label: `${s}` }))}
                    value={effectiveSize}
                    onChange={(v) => setFgSize(v as number)}
                  />
                )}
              </div>
            </div>

            {fgFlavorId !== "" && availableSizes.length > 0 && (
              <p className="text-xs text-stone-500">
                Saadaval: <span className={`font-semibold ${available <= 0 ? "text-red-600" : "text-amber-800"}`}>{available} tk</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-stone-600 mb-1">Müüdud</label>
                <Num value={sold} onChange={setSold} />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">Ära antud</label>
                <Num value={given} onChange={setGiven} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-stone-600 mb-1">Märkus (valikuline)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="nt Turu laupäev"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-600 focus:outline-none"
              />
            </div>

            {overStock && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Kogus ({totalOut}) ületab laovaru ({available}).
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={finishedGoodsCommitMutation.isPending || availableSizes.length === 0}
              className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 transition disabled:opacity-60"
            >
              {finishedGoodsCommitMutation.isPending ? "Salvestan…" : "Pane kirja"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function BlankLabelsCard({
  data,
  commitMutation,
  flash,
}: {
  data: LaduData;
  commitMutation: CommitMutation;
  flash: (msg: string) => void;
}) {
  const [qtys, setQtys] = useState<Record<number, string>>({});

  const totalBlankLabelQty = (size: number) =>
    data.blankLabels.filter((l) => l.size === size).reduce((sum, l) => sum + l.qty, 0);

  const commit = (size: number) => {
    const raw = qtys[size] ?? "";
    const amount = parseInt(raw) || 0;
    if (amount === 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      {
        deltas: [{ kind: "blank_label", blankLabelTypeId: 0, size, amount }],
        type: amount > 0 ? "ost" : "korrigeerimine",
        summary: `${amount > 0 ? "Lisasin" : "Eemaldasin"} ${Math.abs(amount)} × vabalt kirjutatav silt ${size} ml`,
      },
      {
        onSuccess: () => {
          setQtys((prev) => ({ ...prev, [size]: "" }));
          flash("Saldeeritud");
        },
      }
    );
  };

  return (
    <Card title="Vabalt kirjutatavad sildid">
      <p className="text-xs text-stone-400 mb-4">
        Tühjad sildid, kuhu nimi kirjutatakse käsitsi. Positiivne arv lisab, negatiivne eemaldab.
      </p>
      <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 overflow-hidden">
        {SIZES.map((s) => {
          const current = totalBlankLabelQty(s);
          const inputVal = qtys[s] ?? "";
          return (
            <div key={s} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-sm text-stone-500 w-14 shrink-0">{s} ml</span>
              <span className={`text-sm font-semibold w-8 text-right shrink-0 ${current <= 0 ? "text-red-600" : "text-stone-900"}`}>
                {current}
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={inputVal}
                onChange={(e) => setQtys((prev) => ({ ...prev, [s]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") commit(s); }}
                placeholder="±"
                className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-center focus:border-amber-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => commit(s)}
                disabled={commitMutation.isPending}
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-60"
              >
                Salvesta
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LisaVaruTab({
  data,
  commitMutation,
  flash,
}: {
  data: LaduData;
  commitMutation: CommitMutation;
  flash: (msg: string) => void;
}) {
  const [bSize, setBSize] = useState<number>(330);
  const [bQty, setBQty] = useState("");
  const [clbSize, setClbSize] = useState<number>(330);
  const [clbQty, setClbQty] = useState("");
  const [lFlavor, setLFlavor] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [lSize, setLSize] = useState<number>(330);
  const [lQty, setLQty] = useState("");
  const [wcQty, setWcQty] = useState("");
  const [rcSize] = useState<number>(750);
  const [rcQty, setRcQty] = useState("");
  const [cMode, setCMode] = useState<"olemasolev" | "uus">("olemasolev");
  const [cExisting, setCExisting] = useState<number | "">(data.caps[0]?.id ?? "");
  const [cSize, setCSize] = useState<number>(330);
  const [cType, setCType] = useState("kroonkork");
  const [cColor, setCColor] = useState("");
  const [cPunnkorkKat, setCPunnkorkKat] = useState<"uus" | "taaskasutus">("uus");
  const [cQty, setCQty] = useState("");

  const isDirtyLisaVaru = bQty !== "" || clbQty !== "" || lQty !== "" || wcQty !== "" || rcQty !== "" || cQty !== "";
  useUnsavedChanges(isDirtyLisaVaru);

  const flavorN = (id: number | "") => (id !== "" ? (data.flavors.find((f) => f.id === id)?.name ?? "?") : "—");

  const addBottles = () => {
    const q = parseInt(bQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      { deltas: [{ kind: "bottle", key: bSize, amount: q }], type: "ost", summary: `Ostsin ${q} × pudel ${bSize} ml` },
      { onSuccess: () => { flash("Pudelid lisatud"); setBQty(""); } }
    );
  };

  const addCustomLabelBottles = () => {
    const q = parseInt(clbQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      {
        deltas: [{ kind: "custom_label_bottle", size: clbSize, amount: q }],
        type: "ost",
        summary: `Lisasin ${q} × kohandatud sildiga pudel ${clbSize} ml`,
      },
      { onSuccess: () => { flash("Kohandatud sildiga pudelid lisatud"); setClbQty(""); } }
    );
  };

  const addLabels = () => {
    const q = parseInt(lQty) || 0;
    if (!lFlavor) return flash("Vali maitse");
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      { deltas: [{ kind: "label", flavorId: lFlavor, size: lSize, amount: q }], type: "ost", summary: `Ostsin ${q} × silt ${flavorN(lFlavor)} ${lSize} ml` },
      { onSuccess: () => { flash("Sildid lisatud"); setLQty(""); } }
    );
  };

  const addWireCages = () => {
    const q = parseInt(wcQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      { deltas: [{ kind: "wire_cage", amount: q }], type: "ost", summary: `Ostsin ${q} × traatkorgi` },
      { onSuccess: () => { flash("Traatkorgi lisatud"); setWcQty(""); } }
    );
  };

  const addReusableCaps = () => {
    const q = parseInt(rcQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      { deltas: [{ kind: "reusable_cap", size: rcSize, amount: q }], type: "ost", summary: `Lisasin ${q} × korduvkasutatav punnkork ${rcSize} ml` },
      { onSuccess: () => { flash("Korduvkasutatavad punnkorgid lisatud"); setRcQty(""); } }
    );
  };

  const addCaps = () => {
    const q = parseInt(cQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    if (cMode === "olemasolev") {
      if (!cExisting) return flash("Vali kork");
      const cap = data.caps.find((c) => c.id === cExisting);
      commitMutation.mutate(
        { deltas: [{ kind: "cap", key: cExisting, amount: q }], type: "ost", summary: `Ostsin ${q} × ${capLabel(cap)}` },
        { onSuccess: () => { flash("Korgid lisatud"); setCQty(""); } }
      );
    } else {
      const color = cType === "punnkork" ? cPunnkorkKat : cColor.trim();
      commitMutation.mutate(
        {
          deltas: [{ kind: "cap", key: 0, amount: q, create: { size: cSize, type: cType, color } }],
          type: "ost",
          summary: `Ostsin ${q} × ${cSize} ml ${cType}${color ? " " + color : ""}`,
        },
        { onSuccess: () => { flash("Korgid lisatud"); setCQty(""); } }
      );
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Pudelid">
        <label className="block text-sm text-stone-600 mb-1">Suurus</label>
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={bSize} onChange={(v) => setBSize(v as number)} />
        {(() => { const n = data.bottles.find((b) => b.size === bSize)?.qty ?? 0; return <p className={`text-xs mt-1 ${n === 0 ? "text-amber-600" : "text-stone-400"}`}>Laos: {n} tk</p>; })()}
        <div className="mt-3 flex gap-2">
          <Num value={bQty} onChange={setBQty} onKeyDown={(e) => { if (e.key === "Enter") addBottles(); }} className="flex-1" />
          <button type="button" onClick={addBottles} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Kohandatud sildiga pudelid">
        <p className="text-xs text-stone-400 mb-3">Tühi kohandatud silt peal — maitsekleeps lisatakse villimise ajal.</p>
        <label className="block text-sm text-stone-600 mb-1">Suurus</label>
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={clbSize} onChange={(v) => setClbSize(v as number)} />
        {(() => { const n = data.customLabelBottles.find((b) => b.size === clbSize)?.qty ?? 0; return <p className={`text-xs mt-1 ${n === 0 ? "text-amber-600" : "text-stone-400"}`}>Laos: {n} tk</p>; })()}
        <div className="mt-3 flex gap-2">
          <Num value={clbQty} onChange={setClbQty} onKeyDown={(e) => { if (e.key === "Enter") addCustomLabelBottles(); }} className="flex-1" />
          <button type="button" onClick={addCustomLabelBottles} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Sildid">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitse</label>
            {data.flavors.length === 0 ? (
              <p className="text-xs text-stone-400">Lisa maitsed esmalt.</p>
            ) : (
              <select value={lFlavor} onChange={(e) => setLFlavor(Number(e.target.value))} className="w-full rounded-lg border border-stone-300 px-3 py-2">
                {data.flavors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Suurus</label>
            <Seg options={SIZES.map((s) => ({ value: s, label: `${s}` }))} value={lSize} onChange={(v) => setLSize(v as number)} />
          </div>
        </div>
        {(() => { const n = lFlavor !== "" ? (data.labels.find((l) => l.flavorId === lFlavor && l.size === lSize)?.qty ?? 0) : null; return n !== null ? <p className={`text-xs mt-2 ${n === 0 ? "text-amber-600" : "text-stone-400"}`}>Laos: {n} tk</p> : null; })()}
        <div className="mt-3 flex gap-2">
          <Num value={lQty} onChange={setLQty} onKeyDown={(e) => { if (e.key === "Enter") addLabels(); }} className="flex-1" />
          <button type="button" onClick={addLabels} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Traatkorgi">
        <p className="text-xs text-stone-400 mb-3">750 ml punnkorkide jaoks — üks traatkork ühe pudeli kohta.</p>
        {(() => { const n = data.wireCageQty; return <p className={`text-xs mb-2 ${n === 0 ? "text-amber-600" : "text-stone-400"}`}>Laos: {n} tk</p>; })()}
        <div className="flex gap-2">
          <Num value={wcQty} onChange={setWcQty} onKeyDown={(e) => { if (e.key === "Enter") addWireCages(); }} className="flex-1" />
          <button type="button" onClick={addWireCages} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Korduvkasutatavad punnkorgid">
        <p className="text-xs text-stone-400 mb-3">Puhtad punnkorgid, valmis taaskasutusse — villimise ajal arvatakse laost maha.</p>
        {(() => { const n = data.reusableCaps.find((r) => r.size === 750)?.qty ?? 0; return <p className={`text-xs mb-2 ${n === 0 ? "text-amber-600" : "text-stone-400"}`}>Laos: {n} tk</p>; })()}
        <div className="flex gap-2">
          <Num value={rcQty} onChange={setRcQty} onKeyDown={(e) => { if (e.key === "Enter") addReusableCaps(); }} className="flex-1" />
          <button type="button" onClick={addReusableCaps} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Korgid">
        <Seg
          options={[
            { value: "olemasolev", label: "Olemasolev kork" },
            { value: "uus", label: "Uus kork" },
          ]}
          value={cMode}
          onChange={(v) => setCMode(v as "olemasolev" | "uus")}
        />
        {cMode === "olemasolev" ? (
          <div className="mt-3">
            {data.caps.length === 0 ? (
              <p className="text-xs text-stone-400">Pole korke. Lisa "Uus kork" alt.</p>
            ) : (
              <>
                <select value={cExisting} onChange={(e) => setCExisting(Number(e.target.value))} className="w-full rounded-lg border border-stone-300 px-3 py-2">
                  {data.caps.map((c) => <option key={c.id} value={c.id}>{capLabel(c)}</option>)}
                </select>
                {cExisting !== "" && (() => { const n = data.caps.find((c) => c.id === cExisting)?.qty ?? 0; return <p className={`text-xs mt-1 ${n === 0 ? "text-amber-600" : "text-stone-400"}`}>Laos: {n} tk</p>; })()}
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={cSize} onChange={(e) => setCSize(parseInt(e.target.value))} className="rounded-lg border border-stone-300 px-2 py-2">
                {SIZES.map((s) => <option key={s} value={s}>{s} ml</option>)}
              </select>
              <select value={cType} onChange={(e) => { setCType(e.target.value); setCColor(""); }} className="rounded-lg border border-stone-300 px-2 py-2">
                {CAP_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>
            {cType === "punnkork" ? (
              <div>
                <label className="block text-xs text-stone-500 mb-1">Kategooria</label>
                <Seg
                  options={[
                    { value: "uus", label: "Uus" },
                    { value: "taaskasutus", label: "Taaskasutus" },
                  ]}
                  value={cPunnkorkKat}
                  onChange={(v) => setCPunnkorkKat(v as "uus" | "taaskasutus")}
                />
              </div>
            ) : (
              <input
                value={cColor}
                onChange={(e) => setCColor(e.target.value)}
                placeholder="värv (valikuline)"
                className="w-full rounded-lg border border-stone-300 px-2 py-2"
              />
            )}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Num value={cQty} onChange={setCQty} onKeyDown={(e) => { if (e.key === "Enter") addCaps(); }} className="flex-1" />
          <button type="button" onClick={addCaps} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <BlankLabelsCard
        data={data}
        commitMutation={commitMutation}
        flash={flash}
      />

      <TagastusCard
        data={data}
        commitMutation={commitMutation}
        flash={flash}
      />
    </div>
  );
}

function TagastusCard({ data, commitMutation, flash }: { data: LaduData; commitMutation: CommitMutation; flash: (msg: string) => void }) {
  const [tFlavor, setTFlavor] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [tSize, setTSize] = useState<number>(330);
  const [tQty, setTQty] = useState("");

  const flavorN = (id: number | "") => (id !== "" ? (data.flavors.find((f) => f.id === id)?.name ?? "?") : "—");

  const addReturned = () => {
    const q = parseInt(tQty) || 0;
    if (!tFlavor) return flash("Vali maitse");
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      {
        deltas: [{ kind: "returned_bottle", flavorId: tFlavor, size: tSize, amount: q }],
        type: "tagastus",
        summary: `Tagastati ${q} × ${flavorN(tFlavor)} ${tSize} ml pudel`,
      },
      { onSuccess: () => { flash("Tagastatud pudelid lisatud"); setTQty(""); } }
    );
  };

  return (
    <Card title="Tagastatud pudelid">
      <p className="text-xs text-stone-400 mb-3">Klientide poolt tagastatud pudelid — arvestatakse villimise ajal.</p>
      {data.flavors.length === 0 ? (
        <p className="text-xs text-stone-400">Lisa maitsed esmalt.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm text-stone-600 mb-1">Maitse</label>
              <select value={tFlavor} onChange={(e) => setTFlavor(Number(e.target.value))} className="w-full rounded-lg border border-stone-300 px-3 py-2">
                {data.flavors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-stone-600 mb-1">Suurus</label>
              <Seg options={SIZES.map((s) => ({ value: s, label: `${s}` }))} value={tSize} onChange={(v) => setTSize(v as number)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Num value={tQty} onChange={setTQty} onKeyDown={(e) => { if (e.key === "Enter") addReturned(); }} className="flex-1" />
            <button type="button" onClick={addReturned} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
          </div>
        </>
      )}
    </Card>
  );
}

function MaitsedTab({
  data,
  addFlavorMutation,
  removeFlavorMutation,
  updateFlavorMutation,
  resetAll,
}: {
  data: LaduData;
  addFlavorMutation: ReturnType<typeof useMutation<Flavor, Error, { name: string; defaultCapId: number | null }>>;
  removeFlavorMutation: ReturnType<typeof useMutation<number, Error, number>>;
  updateFlavorMutation: ReturnType<typeof useMutation<Flavor, Error, { id: number; name: string; defaultCapId: number | null }>>;
  resetAll: () => void;
}) {
  const [name, setName] = useState("");
  const [capId, setCapId] = useState<number | "">("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCapId, setEditCapId] = useState<number | "">("");

  const add = () => {
    if (!name.trim()) return;
    addFlavorMutation.mutate(
      { name: name.trim(), defaultCapId: capId !== "" ? (capId as number) : null },
      { onSuccess: () => { setName(""); setCapId(""); } }
    );
  };

  const startEdit = (f: Flavor) => {
    setEditingId(f.id);
    setEditName(f.name);
    setEditCapId(f.defaultCapId ?? "");
  };

  const saveEdit = (id: number) => {
    if (!editName.trim()) return;
    updateFlavorMutation.mutate(
      { id, name: editName.trim(), defaultCapId: editCapId !== "" ? (editCapId as number) : null },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <div className="space-y-5">
      <Card title="Lisa maitse">
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nt Kadakamari"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <div>
            <label className="block text-sm text-stone-600 mb-1">Vaikekork (valikuline)</label>
            <select value={capId} onChange={(e) => setCapId(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">— vali hiljem —</option>
              {data.caps.map((c) => <option key={c.id} value={c.id}>{capLabel(c)}</option>)}
            </select>
            <p className="text-xs text-stone-400 mt-1">Villimisel pakutakse seda korki automaatselt.</p>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={addFlavorMutation.isPending}
            className="rounded-lg bg-amber-700 px-4 py-2 text-white hover:bg-amber-800 disabled:opacity-60"
          >
            Lisa maitse
          </button>
        </div>
      </Card>

      {data.flavors.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {data.flavors.map((f) => {
            const defCap = data.caps.find((c) => c.id === f.defaultCapId);
            if (editingId === f.id) {
              return (
                <div key={f.id} className="px-4 py-3 border-b border-stone-100 last:border-0 bg-amber-50 space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(f.id); if (e.key === "Escape") setEditingId(null); }}
                    autoFocus
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-600 focus:outline-none"
                  />
                  <select
                    value={editCapId}
                    onChange={(e) => setEditCapId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">— vaikekork pole —</option>
                    {data.caps.map((c) => <option key={c.id} value={c.id}>{capLabel(c)}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(f.id)}
                      disabled={updateFlavorMutation.isPending}
                      className="flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-60"
                    >
                      <Check className="w-3 h-3" /> Salvesta
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
                    >
                      <X className="w-3 h-3" /> Tühista
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-stone-400">
                    {defCap ? capLabel(defCap) : "vaikekork määramata"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(f)}
                    className="text-stone-400 hover:text-amber-700"
                    title="Muuda"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFlavorMutation.mutate(f.id)}
                    disabled={removeFlavorMutation.isPending}
                    className="text-stone-400 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={resetAll} className="text-sm text-stone-400 hover:text-red-600 flex items-center gap-1">
        <RotateCcw className="w-4 h-4" /> Lähtesta kõik andmed
      </button>
    </div>
  );
}

const PRESET_UNITS = ["tk", "pakk", "kg", "g", "liiter", "ml"];

function TooraineTab({
  data,
  commitMutation,
  addMaterialMutation,
  updateMaterialMutation,
  deleteMaterialMutation,
  flash,
}: {
  data: LaduData;
  commitMutation: CommitMutation;
  addMaterialMutation: ReturnType<typeof useMutation<Material, Error, { name: string; unit: string; minStock?: number }>>;
  updateMaterialMutation: ReturnType<typeof useMutation<Material, Error, { id: number; name: string; unit: string; minStock?: number | null }>>;
  deleteMaterialMutation: ReturnType<typeof useMutation<number, Error, number>>;
  flash: (msg: string) => void;
}) {
  const [addName, setAddName] = useState("");
  const [addUnit, setAddUnit] = useState("kg");
  const [addCustomUnit, setAddCustomUnit] = useState("");
  const [showAdjustBlock, setShowAdjustBlock] = useState(false);
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustMode, setAdjustMode] = useState<"suurenda" | "vähenda">("vähenda");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("kg");
  const [editCustomUnit, setEditCustomUnit] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [addMinStock, setAddMinStock] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const resolvedAddUnit = addUnit === "__custom__" ? addCustomUnit.trim() : addUnit;
  const resolvedEditUnit = editUnit === "__custom__" ? editCustomUnit.trim() : editUnit;

  const isDirtyTooraine =
    addName !== "" ||
    addUnit !== "kg" ||
    addCustomUnit !== "" ||
    addMinStock !== "" ||
    editingId !== null ||
    (adjustingId !== null && adjustQty !== "");
  useUnsavedChanges(isDirtyTooraine);

  const handleAdd = () => {
    const name = addName.trim();
    const unit = resolvedAddUnit;
    if (!name) return flash("Sisesta tooraine nimi");
    if (!unit) return flash("Sisesta ühik");
    const minStock = addMinStock !== "" ? parseFloat(addMinStock.replace(",", ".")) : null;
    addMaterialMutation.mutate(
      { name, unit, ...(minStock != null && !isNaN(minStock) ? { minStock } : {}) },
      {
        onSuccess: () => {
          setAddName("");
          setAddUnit("kg");
          setAddCustomUnit("");
          setAddMinStock("");
        },
      }
    );
  };

  const startEdit = (m: Material) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditMinStock(m.minStock != null ? String(m.minStock) : "");
    if (PRESET_UNITS.includes(m.unit)) {
      setEditUnit(m.unit);
      setEditCustomUnit("");
    } else {
      setEditUnit("__custom__");
      setEditCustomUnit(m.unit);
    }
  };

  const saveEdit = (m: Material) => {
    const name = editName.trim();
    const unit = resolvedEditUnit;
    if (!name) return flash("Sisesta nimi");
    if (!unit) return flash("Sisesta ühik");
    const minStock = editMinStock !== "" ? parseFloat(editMinStock.replace(",", ".")) : null;
    updateMaterialMutation.mutate(
      { id: m.id, name, unit, ...(minStock != null && !isNaN(minStock) ? { minStock } : { minStock: null }) },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const openAdjust = (m: Material, mode: "suurenda" | "vähenda") => {
    setShowAdjustBlock(true);
    setAdjustingId(m.id);
    setAdjustMode(mode);
    setAdjustQty("");
  };

  const closeAdjustBlock = () => {
    setShowAdjustBlock(false);
    setAdjustingId(null);
    setAdjustQty("");
    setAdjustMode("vähenda");
  };

  const handleStockChange = () => {
    const m = data.materials.find((mat) => mat.id === adjustingId);
    if (!m) return flash("Vali tooraine");
    const raw = parseFloat(adjustQty.replace(",", "."));
    if (isNaN(raw) || raw <= 0) return flash("Sisesta kehtiv kogus");
    const delta = adjustMode === "suurenda" ? raw : -raw;
    const newQty = (m.qty ?? 0) + delta;
    if (newQty < 0) return flash("Laoseis ei saa minna miinusesse");
    commitMutation.mutate(
      {
        deltas: [{ kind: "material", materialId: m.id, amount: delta }],
        type: adjustMode === "suurenda" ? "ost" : "kasutatud",
        summary: `${m.name}: ${formatQty(m.qty)} → ${formatQty(newQty)} ${m.unit}`,
      },
      {
        onSuccess: () => {
          flash(adjustMode === "suurenda" ? "Laoseis suurendatud" : "Laoseis vähendatud");
          closeAdjustBlock();
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Muuda laoseisu — collapsible block above the list */}
      {data.materials.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (showAdjustBlock) {
                closeAdjustBlock();
              } else {
                setShowAdjustBlock(true);
                if (!adjustingId && data.materials.length > 0) {
                  setAdjustingId(data.materials[0].id);
                }
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition"
          >
            <span className="font-medium text-stone-800 text-sm flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-stone-400" />
              Muuda laoseisu
            </span>
            {showAdjustBlock ? (
              <ChevronUp className="w-4 h-4 text-stone-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-stone-400" />
            )}
          </button>
          {showAdjustBlock && (
            <div className="border-t border-stone-100 px-4 pb-4 pt-3 space-y-3">
              {/* Material picker */}
              <div>
                <label className="block text-xs text-stone-500 mb-1">Tooraine</label>
                <select
                  value={adjustingId ?? ""}
                  onChange={(e) => setAdjustingId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                >
                  <option value="">Vali tooraine…</option>
                  {data.materials.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} ({formatQty(mat.qty)} {mat.unit})
                    </option>
                  ))}
                </select>
              </div>
              {/* Direction toggle */}
              <div>
                <label className="block text-xs text-stone-500 mb-1">Suund</label>
                <div className="flex rounded-lg border border-stone-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setAdjustMode("suurenda")}
                    className={`flex-1 py-2 font-medium transition ${adjustMode === "suurenda" ? "bg-amber-700 text-white" : "bg-stone-50 text-stone-600 hover:bg-stone-100"}`}
                  >
                    + Suurenda
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode("vähenda")}
                    className={`flex-1 py-2 font-medium transition ${adjustMode === "vähenda" ? "bg-red-600 text-white" : "bg-stone-50 text-stone-600 hover:bg-stone-100"}`}
                  >
                    − Vähenda
                  </button>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {adjustMode === "suurenda" ? "Ostsin juurde / lisandus" : "Kasutasin / müüsin / andsin ära"}
                </p>
              </div>
              {/* Amount */}
              <div>
                <label className="block text-xs text-stone-500 mb-1">
                  Kogus{adjustingId ? ` (${data.materials.find((m) => m.id === adjustingId)?.unit ?? ""})` : ""}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleStockChange(); if (e.key === "Escape") closeAdjustBlock(); }}
                  placeholder="0"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                  autoFocus
                />
              </div>
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStockChange}
                  disabled={commitMutation.isPending}
                  className={`flex items-center gap-2 flex-1 justify-center rounded-lg px-4 py-2 text-sm text-white disabled:opacity-60 ${adjustMode === "suurenda" ? "bg-amber-700 hover:bg-amber-800" : "bg-red-600 hover:bg-red-700"}`}
                >
                  <Check className="w-4 h-4" />
                  {adjustMode === "suurenda" ? "Lisa varudesse" : "Vähenda varudest"}
                </button>
                <button
                  type="button"
                  onClick={closeAdjustBlock}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
                >
                  Tühista
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {data.materials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
          <Leaf className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-sm text-stone-500 mb-1">Toorained puuduvad</p>
          <p className="text-xs text-stone-400">Lisa esmalt tooraine allpool</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.materials.map((m) => {
            if (editingId === m.id) {
              return (
                <div key={m.id} className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Nimi</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Ühik</label>
                    <div className="flex gap-2">
                      <select
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                      >
                        {PRESET_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        <option value="__custom__">muu…</option>
                      </select>
                      {editUnit === "__custom__" && (
                        <input
                          value={editCustomUnit}
                          onChange={(e) => setEditCustomUnit(e.target.value)}
                          placeholder="ühik"
                          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Miinimumvaru ({resolvedEditUnit || m.unit}) <span className="text-stone-400">— hoiatuse piir</span></label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(e.target.value)}
                      placeholder="nt 0.5"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(m)}
                      disabled={updateMaterialMutation.isPending}
                      className="flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-60"
                    >
                      <Check className="w-3 h-3" /> Salvesta
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
                    >
                      <X className="w-3 h-3" /> Tühista
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className={`rounded-xl border p-4 ${m.minStock != null && m.qty < m.minStock ? "border-red-300 bg-red-50" : "border-stone-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-stone-900">{m.name}</div>
                    <div className="text-2xl font-semibold text-stone-800 mt-1">
                      {formatQty(m.qty)}{" "}
                      <span className="text-base font-normal text-stone-500">{m.unit}</span>
                    </div>
                    {m.minStock != null && m.qty < m.minStock && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-red-600 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Varu on alla miinimumi ({formatQty(m.minStock)} {m.unit})
                      </div>
                    )}
                    {m.minStock != null && m.qty >= m.minStock && (
                      <div className="mt-1 text-xs text-stone-400">Min: {formatQty(m.minStock)} {m.unit}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openAdjust(m, "suurenda")}
                      className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 transition"
                      title="Suurenda laoseisu"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openAdjust(m, "vähenda")}
                      className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition"
                      title="Vähenda laoseisu"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="text-stone-300 hover:text-amber-700 ml-1"
                      title="Muuda nime/ühikut"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`Kustutan "${m.name}"?`)) return;
                        deleteMaterialMutation.mutate(m.id);
                      }}
                      disabled={deleteMaterialMutation.isPending}
                      className="text-stone-300 hover:text-red-600 disabled:opacity-40"
                      title="Kustuta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}


      {(() => {
        const matMovements = data.movements
          .filter((m) =>
            (m.deltas as Array<{ kind: string }>).some((d) => d.kind === "material")
          )
          .slice(0, 50);
        return (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition"
            >
              <span className="font-medium text-stone-800 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-stone-400" />
                Tooraine liikumised
                {matMovements.length > 0 && (
                  <span className="text-xs text-stone-400 font-normal">({matMovements.length})</span>
                )}
              </span>
              {showHistory
                ? <ChevronUp className="w-4 h-4 text-stone-400" />
                : <ChevronDown className="w-4 h-4 text-stone-400" />}
            </button>
            {showHistory && (
              matMovements.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-stone-400">Ühtegi toorainekanne pole.</p>
              ) : (
                <div className="border-t border-stone-100 divide-y divide-stone-100">
                  {matMovements.map((m) => {
                    const matDeltas = (m.deltas as Array<{ kind: string; materialId?: number; amount?: number }>)
                      .filter((d) => d.kind === "material");
                    return (
                      <div key={m.id} className="px-4 py-2.5">
                        <div className="text-xs text-stone-400 mb-1">
                          {new Date(m.createdAt).toLocaleString("et-EE")}
                        </div>
                        {matDeltas.map((d, i) => {
                          const mat = data.materials.find((mat) => mat.id === d.materialId);
                          const amt = d.amount ?? 0;
                          return (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-stone-700">{mat?.name ?? `#${d.materialId}`}</span>
                              <span className={`font-medium tabular-nums ${amt >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {amt >= 0 ? "+" : ""}{formatQty(amt)} {mat?.unit ?? ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        );
      })()}

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="font-serif text-base text-stone-900 mb-3">Lisa tooraine</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Nimi</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="nt suhkur, ingver, must tee"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Ühik</label>
            <div className="flex gap-2">
              <select
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                {PRESET_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value="__custom__">muu…</option>
              </select>
              {addUnit === "__custom__" && (
                <input
                  value={addCustomUnit}
                  onChange={(e) => setAddCustomUnit(e.target.value)}
                  placeholder="ühik"
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Miinimumvaru <span className="text-stone-400">(valikuline — hoiatuse piir)</span></label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={addMinStock}
              onChange={(e) => setAddMinStock(e.target.value)}
              placeholder="nt 0.5"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={addMaterialMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Lisa tooraine
          </button>
        </div>
      </div>
    </div>
  );
}

function formatQty(n: number | null | undefined): string {
  if (n == null) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  return rounded % 1 === 0 ? String(rounded) : rounded.toLocaleString("et-EE");
}

function AjaluguTab({
  data,
  undoMutation,
  brews,
  ferms,
  flavEvents,
  flash,
  flashError,
}: {
  data: LaduData;
  undoMutation: ReturnType<typeof useMutation<void, Error, number>>;
  brews: BrewMin[];
  ferms: FermMin[];
  flavEvents: EventMin[];
  flash: (msg: string) => void;
  flashError: (msg: string) => void;
}) {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  const [editingMovId, setEditingMovId] = useState<number | null>(null);
  const [editCapId, setEditCapId] = useState<number | "">("");
  const [editQty, setEditQty] = useState<string>("");

  const updateMovMutation = useMutation({
    mutationFn: async ({ id, capId, quantity }: { id: number; capId: number | null; quantity?: number }) => {
      const res = await authFetch(`/ladu/movements/${id}`, {
        method: "PUT",
        body: JSON.stringify({ capId, quantity }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LADU_QUERY_KEY });
      setEditingMovId(null);
      flash("Kanne uuendatud");
    },
    onError: (err: Error) => flashError(err.message),
  });

  if (data.movements.length === 0)
    return <p className="text-sm text-stone-400">Veel ühtegi kannet pole.</p>;

  const brewLabelForMovement = (m: Movement): string | null => {
    if (m.type !== "villimine") return null;
    const traceDelta = (m.deltas as Array<{ kind: string; flavoringEventId?: number }>).find((d) => d.kind === "trace");
    if (!traceDelta?.flavoringEventId) return null;
    const event = flavEvents.find((e) => e.id === traceDelta.flavoringEventId);
    if (!event?.fermentationBatchId) return null;
    const ferm = ferms.find((f) => f.id === event.fermentationBatchId);
    const brew = ferm?.brewId != null ? brews.find((b) => b.id === ferm.brewId) : null;
    if (!brew) return null;
    const dateStr = new Date(brew.date).toLocaleDateString("et-EE");
    if (brew.sessionId != null) {
      const sessionBrews = brews.filter((b) => b.sessionId === brew.sessionId).sort((a, b) => a.id - b.id);
      const idx = sessionBrews.findIndex((b) => b.id === brew.id) + 1;
      return `${dateStr} · Ports ${idx}/${sessionBrews.length}`;
    }
    return dateStr;
  };

  function startEdit(m: Movement) {
    const capDelta = (m.deltas as Array<{ kind: string; key?: number }>).find((d) => d.kind === "cap");
    const fgDelta = (m.deltas as Array<{ kind: string; amount?: number }>).find((d) => d.kind === "finished_goods");
    setEditCapId(capDelta?.key ?? "");
    setEditQty(fgDelta?.amount != null ? String(fgDelta.amount) : "");
    setEditingMovId(m.id);
  }

  return (
    <div className="space-y-2">
      {data.movements.map((m) => {
        const brewDateLabel = brewLabelForMovement(m);
        const capDelta = (m.deltas as Array<{ kind: string; key?: number; amount?: number }>).find((d) => d.kind === "cap");
        const currentCap = capDelta?.key ? data.caps.find((c) => c.id === capDelta.key) : undefined;
        const isEditing = editingMovId === m.id;
        const blankLabelCount = m.type === "villimine"
          ? (m.deltas as Array<{ kind: string; amount?: number }>)
              .filter((d) => d.kind === "blank_label")
              .reduce((sum, d) => sum + Math.abs(d.amount ?? 0), 0)
          : 0;

        return (
          <div key={m.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between">
              <div className="pr-3 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.type === "villimine" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                    {m.type}
                  </span>
                  <span className="text-xs text-stone-400">
                    {new Date(m.createdAt).toLocaleString("et-EE")}
                  </span>
                </div>
                <div className="text-sm text-stone-700">{m.summary}</div>
                {currentCap && !isEditing && (
                  <div className="text-xs text-stone-400 mt-0.5 flex items-center">
                    <ColorDot color={currentCap.color} />
                    {capLabel(currentCap)}
                  </div>
                )}
                {blankLabelCount > 0 && (
                  <div className="text-xs text-teal-700 mt-0.5 flex items-center gap-1">
                    <span className="inline-block w-3.5 h-3.5 shrink-0 text-center leading-none font-bold">✎</span>
                    {blankLabelCount} vabalt kirjutatava sildiga pudelit
                  </div>
                )}
                {brewDateLabel && (
                  <div className="text-xs text-stone-400 mt-0.5">Pruulimine: {brewDateLabel}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {m.type === "villimine" && !isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="text-stone-400 hover:text-amber-700 flex items-center gap-1 text-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" /> muuda
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => undoMutation.mutate(m.id)}
                  disabled={undoMutation.isPending}
                  className="text-stone-400 hover:text-amber-700 flex items-center gap-1 text-xs shrink-0 disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> tagasi
                </button>
              </div>
            </div>

            {isEditing && (() => {
              const parsedQty = parseInt(editQty);
              const qtyValid = !isNaN(parsedQty) && parsedQty > 0;
              const fgAmt = (m.deltas as Array<{ kind: string; amount?: number }>).find((d) => d.kind === "finished_goods")?.amount;
              const qtyChanged = qtyValid && parsedQty !== fgAmt;
              return (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="text-xs font-medium text-stone-500 mb-2">Korrigeeri kannet (laoseis uueneb koguse muutumisel)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editQty !== "" && (
                      <>
                        <label className="text-xs text-stone-500 shrink-0">Kogus:</label>
                        <input
                          type="number"
                          min={1}
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-800 focus:border-amber-600 focus:outline-none"
                        />
                        {qtyChanged && (
                          <span className="text-xs text-amber-600">laoseis uueneb</span>
                        )}
                      </>
                    )}
                    <label className="text-xs text-stone-500 shrink-0">Kork:</label>
                    <select
                      value={editCapId}
                      onChange={(e) => setEditCapId(e.target.value ? Number(e.target.value) : "")}
                      className="flex-1 min-w-[180px] rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-800 focus:border-amber-600 focus:outline-none"
                    >
                      <option value="">— kork valimata —</option>
                      {data.caps.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.size}ml · {c.type}{c.color ? ` · ${c.color}` : ""} ({c.qty} tk laos)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (editQty !== "" && !qtyValid) return flashError("Kogus peab olema positiivne arv");
                        updateMovMutation.mutate({
                          id: m.id,
                          capId: editCapId ? Number(editCapId) : null,
                          quantity: editQty !== "" && qtyValid ? parsedQty : undefined,
                        });
                      }}
                      disabled={updateMovMutation.isPending}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {updateMovMutation.isPending ? "Salvestan…" : "Salvesta"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMovId(null)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border border-stone-300 rounded-lg hover:bg-stone-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Tühista
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
