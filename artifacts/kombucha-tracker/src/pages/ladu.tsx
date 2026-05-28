import React, { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Boxes, FlaskConical, Tags, History, Plus, RotateCcw, Trash2, AlertTriangle, Pencil, Check, X, PenLine, ShoppingBag } from "lucide-react";
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
type Label = { id: number; flavorId: number; size: number; qty: number };
type Cap = { id: number; size: number; type: string; color: string; qty: number };
type CustomLabelBottle = { id: number; size: number; qty: number };
type Movement = { id: number; type: string; summary: string; deltas: unknown[]; createdAt: string };
type BlankLabelType = { id: number; userId: string; name: string };
type BlankLabel = { id: number; userId: string; blankLabelTypeId: number; size: number; qty: number };
type FinishedGoods = { id: number; flavorId: number; size: number; qty: number };

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

function Num({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const { data = EMPTY, isLoading, isError } = useQuery<LaduData>({
    queryKey: LADU_QUERY_KEY,
    queryFn: async () => {
      const res = await authFetch("/ladu");
      return res.json();
    },
  });

  const commitMutation = useMutation({
    mutationFn: async ({ deltas, type, summary, villimineGoods }: { deltas: unknown[]; type: string; summary: string; villimineGoods?: { flavorId: number; size: number; amount: number } }) => {
      const res = await authFetch("/ladu/commit", {
        method: "POST",
        body: JSON.stringify({ type, summary, deltas, ...(villimineGoods ? { villimineGoods } : {}) }),
      });
      return res.json() as Promise<LaduData>;
    },
    onSuccess: (updated) => {
      qc.setQueryData(LADU_QUERY_KEY, updated);
    },
    onError: (err: Error) => flash(err.message),
  });

  const undoMutation = useMutation({
    mutationFn: async (movId: number) => {
      await authFetch(`/ladu/movements/${movId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LADU_QUERY_KEY });
      flash("Kanne võetud tagasi");
    },
    onError: (err: Error) => flash(err.message),
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
    onError: (err: Error) => flash(err.message),
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
    onError: (err: Error) => flash(err.message),
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
    onError: (err: Error) => flash(err.message),
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
    onError: (err: Error) => flash(err.message),
  });

  const addBlankLabelTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await authFetch("/ladu/blank-label-types", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      return res.json() as Promise<BlankLabelType>;
    },
    onSuccess: (t) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        blankLabelTypes: [...old.blankLabelTypes, t],
      }));
      flash("Silditüüp lisatud");
    },
    onError: (err: Error) => flash(err.message),
  });

  const removeBlankLabelTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/ladu/blank-label-types/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<LaduData>(LADU_QUERY_KEY, (old = EMPTY) => ({
        ...old,
        blankLabelTypes: old.blankLabelTypes.filter((t) => t.id !== id),
        blankLabels: old.blankLabels.filter((l) => l.blankLabelTypeId !== id),
      }));
      flash("Silditüüp eemaldatud");
    },
    onError: (err: Error) => flash(err.message),
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
    onError: (err: Error) => flash(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await authFetch("/ladu/reset", { method: "DELETE" });
    },
    onSuccess: () => {
      qc.setQueryData(LADU_QUERY_KEY, EMPTY);
      flash("Andmed lähtestatud");
    },
    onError: (err: Error) => flash(err.message),
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
          <VillimineTab data={data} flavorName={flavorName} commitMutation={commitMutation} flash={flash} />
        )}
        {tab === "varu" && (
          <LisaVaruTab data={data} commitMutation={commitMutation} addBlankLabelTypeMutation={addBlankLabelTypeMutation} removeBlankLabelTypeMutation={removeBlankLabelTypeMutation} flash={flash} />
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
          <AjaluguTab data={data} undoMutation={undoMutation} />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </Layout>
  );
}

type CommitMutation = ReturnType<typeof useMutation<LaduData, Error, { deltas: unknown[]; type: string; summary: string; villimineGoods?: { flavorId: number; size: number; amount: number } }>>;

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

  const blankLabelQty = (typeId: number, size: number) =>
    data.blankLabels.find((l) => l.blankLabelTypeId === typeId && l.size === size)?.qty ?? 0;

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
        <h2 className="font-serif text-lg text-stone-900 mb-3">Korduvkasutatavad punnkorgid</h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = data.reusableCaps.find((r) => r.size === s)?.qty ?? 0;
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
          Puhtad punnkorgid, mis on valmis taaskasutusse — villimise ajal arvatakse maha.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-amber-700" /> Vabalt kirjutatavad sildid
        </h2>
        {data.blankLabelTypes.length === 0 ? (
          <p className="text-sm text-stone-400">Veel ühtegi silditüüpi pole lisatud. Lisa "Lisa varu" vahekaardil.</p>
        ) : (
          <div className="space-y-3">
            {data.blankLabelTypes.map((t) => (
              <div key={t.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                <div className="px-4 py-2 bg-stone-50 border-b border-stone-100">
                  <span className="font-medium text-stone-800">{t.name}</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-stone-100">
                  {SIZES.map((s) => {
                    const n = blankLabelQty(t.id, s);
                    return (
                      <div key={s} className="p-3 text-center">
                        <div className="text-xs text-stone-500">{s} ml</div>
                        <div className={`text-xl font-semibold ${n <= 0 ? "text-red-600" : "text-stone-900"}`}>{n}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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

function VillimineTab({ data, flavorName, commitMutation, flash }: { data: LaduData; flavorName: (id: number) => string; commitMutation: CommitMutation; flash: (msg: string) => void }) {
  const [flavorId, setFlavorId] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [size, setSize] = useState<number>(330);
  const [total, setTotal] = useState("");
  const [returned, setReturned] = useState("");
  const [fromCustom, setFromCustom] = useState("");
  const [capId, setCapId] = useState<number | "">("");
  const [oldCaps, setOldCaps] = useState("");

  const sizeCaps = data.caps.filter((c) => c.size === size);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const newCount = t - ret;
  const fromCust = Math.min(newCount, Math.max(0, parseInt(fromCustom) || 0));
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));

  const selectedCap = data.caps.find((c) => c.id === capId);
  const isPunnkork = selectedCap?.type === "punnkork";
  const reusableStock = data.reusableCaps.find((r) => r.size === size)?.qty ?? 0;
  const bottleDeduct = newCount - fromCust;
  const customLabelBottleDeduct = fromCust;
  const labelDeduct = newCount - fromCust;
  const capDeduct = capId !== "" ? t - old : 0;
  const wireCageDeduct = size === 750 && isPunnkork ? t : 0;
  const reusableCapDeduct = isPunnkork ? old : 0;

  const villi = () => {
    if (!flavorId) return flash("Vali maitse");
    if (t <= 0) return flash("Sisesta pudelite arv");

    const deltas: unknown[] = [];
    if (bottleDeduct > 0) deltas.push({ kind: "bottle", key: size, amount: -bottleDeduct });
    if (customLabelBottleDeduct > 0) deltas.push({ kind: "custom_label_bottle", size, amount: -customLabelBottleDeduct });
    if (labelDeduct > 0) deltas.push({ kind: "label", flavorId, size, amount: -labelDeduct });
    if (capId !== "" && capDeduct > 0) deltas.push({ kind: "cap", key: capId, amount: -capDeduct });
    if (wireCageDeduct > 0) deltas.push({ kind: "wire_cage", amount: -wireCageDeduct });
    if (reusableCapDeduct > 0) deltas.push({ kind: "reusable_cap", size, amount: -reusableCapDeduct });

    const cap = selectedCap;
    const parts = [`Villisin ${t} × ${flavorName(flavorId as number)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud pudelit`);
    if (fromCust) parts.push(`${fromCust} kohandatud sildiga pudelit`);
    if (reusableCapDeduct > 0) parts.push(`${reusableCapDeduct} korduvkasutatavat punnkorki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);
    if (wireCageDeduct > 0) parts.push(`${wireCageDeduct} traatkorki`);

    commitMutation.mutate(
      { deltas, type: "villimine", summary: parts.join(" · "), villimineGoods: { flavorId: flavorId as number, size, amount: t } },
      {
        onSuccess: () => {
          flash("Villimine kirja pandud");
          setTotal(""); setReturned(""); setFromCustom(""); setOldCaps("");
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

        <div>
          <label className="block text-sm text-stone-600 mb-1">Suurus</label>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={size} onChange={(v) => setSize(v as number)} />
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Mitu pudelit kokku tegid?</label>
          <Num value={total} onChange={setTotal} />
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Tagasi tulnud pudelid</label>
          <Num value={returned} onChange={setReturned} />
          <p className="text-xs text-stone-400 mt-1">Pudel + silt koos</p>
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Kohandatud sildiga pudelid</label>
          <Num value={fromCustom} onChange={setFromCustom} />
          <p className="text-xs text-stone-400 mt-1">Uued pudelid kohandatud sildiga — arvatakse vastavast varust</p>
        </div>

        <div className={isPunnkork ? "grid grid-cols-2 gap-3" : ""}>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Kork</label>
            <select
              value={capId}
              onChange={(e) => { setCapId(e.target.value ? Number(e.target.value) : ""); setOldCaps(""); }}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
            >
              {sizeCaps.length === 0 && <option value="">korki pole</option>}
              {sizeCaps.map((c) => (
                <option key={c.id} value={c.id}>{capLabel(c)}</option>
              ))}
            </select>
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
          <li>Sildid {flavorId ? flavorName(flavorId as number) : "—"} {size} ml: <b>{labelDeduct}</b></li>
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
  addBlankLabelTypeMutation,
  removeBlankLabelTypeMutation,
  flash,
}: {
  data: LaduData;
  commitMutation: CommitMutation;
  addBlankLabelTypeMutation: ReturnType<typeof useMutation<BlankLabelType, Error, string>>;
  removeBlankLabelTypeMutation: ReturnType<typeof useMutation<number, Error, number>>;
  flash: (msg: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const blankLabelQty = (typeId: number, size: number) =>
    data.blankLabels.find((l) => l.blankLabelTypeId === typeId && l.size === size)?.qty ?? 0;

  const key = (typeId: number, size: number) => `${typeId}_${size}`;

  const addType = () => {
    if (!newName.trim()) return;
    addBlankLabelTypeMutation.mutate(newName.trim(), {
      onSuccess: () => setNewName(""),
    });
  };

  const commit = (typeId: number, typeName: string, size: number, amount: number) => {
    if (amount === 0) return flash("Sisesta kogus");
    const qKey = key(typeId, size);
    commitMutation.mutate(
      {
        deltas: [{ kind: "blank_label", blankLabelTypeId: typeId, size, amount }],
        type: amount > 0 ? "ost" : "korrigeerimine",
        summary: `${amount > 0 ? "Lisasin" : "Eemaldasin"} ${Math.abs(amount)} × vabalt kirjutatav silt "${typeName}" ${size} ml`,
      },
      {
        onSuccess: () => {
          setQtys((prev) => ({ ...prev, [qKey]: "" }));
          flash("Saldeeritud");
        },
      }
    );
  };

  const handleDelete = (t: BlankLabelType) => {
    const hasStock = SIZES.some((s) => blankLabelQty(t.id, s) > 0);
    if (hasStock) {
      flash("Ei saa kustutada — laos on veel varusid");
      return;
    }
    removeBlankLabelTypeMutation.mutate(t.id);
  };

  return (
    <Card title="Vabalt kirjutatavad sildid">
      <p className="text-xs text-stone-400 mb-4">
        Sildid, kus kogus on trükitud aga nimi kirjutatakse käsitsi (nt "Aroonia").
      </p>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
          placeholder="Sildi nimi (nt Aroonia)"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={addType}
          disabled={addBlankLabelTypeMutation.isPending || !newName.trim()}
          className="rounded-lg bg-amber-700 px-4 text-sm text-white hover:bg-amber-800 disabled:opacity-60"
        >
          Lisa
        </button>
      </div>

      {data.blankLabelTypes.length === 0 ? (
        <p className="text-sm text-stone-400">Pole ühtegi silditüüpi.</p>
      ) : (
        <div className="space-y-4">
          {data.blankLabelTypes.map((t) => (
            <div key={t.id} className="rounded-lg border border-stone-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-200">
                <span className="font-medium text-stone-800 text-sm">{t.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  disabled={removeBlankLabelTypeMutation.isPending}
                  className="text-stone-400 hover:text-red-600 disabled:opacity-40"
                  title="Kustuta silditüüp"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-stone-100">
                {SIZES.map((s) => {
                  const qKey = key(t.id, s);
                  const current = blankLabelQty(t.id, s);
                  const inputVal = qtys[qKey] ?? "";
                  return (
                    <div key={s} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-sm text-stone-500 w-14 shrink-0">{s} ml</span>
                      <span className={`text-sm font-semibold w-8 text-right shrink-0 ${current <= 0 ? "text-red-600" : "text-stone-900"}`}>
                        {current}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={inputVal}
                        onChange={(e) => setQtys((prev) => ({ ...prev, [qKey]: e.target.value }))}
                        placeholder="±"
                        className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-center focus:border-amber-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => commit(t.id, t.name, s, parseInt(inputVal) || 0)}
                        disabled={commitMutation.isPending}
                        className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-60"
                      >
                        Salvesta
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LisaVaruTab({
  data,
  commitMutation,
  addBlankLabelTypeMutation,
  removeBlankLabelTypeMutation,
  flash,
}: {
  data: LaduData;
  commitMutation: CommitMutation;
  addBlankLabelTypeMutation: ReturnType<typeof useMutation<BlankLabelType, Error, string>>;
  removeBlankLabelTypeMutation: ReturnType<typeof useMutation<number, Error, number>>;
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
  const [rcSize, setRcSize] = useState<number>(330);
  const [rcQty, setRcQty] = useState("");
  const [cMode, setCMode] = useState<"olemasolev" | "uus">("olemasolev");
  const [cExisting, setCExisting] = useState<number | "">(data.caps[0]?.id ?? "");
  const [cSize, setCSize] = useState<number>(330);
  const [cType, setCType] = useState("kroonkork");
  const [cColor, setCColor] = useState("");
  const [cPunnkorkKat, setCPunnkorkKat] = useState<"uus" | "taaskasutus">("uus");
  const [cQty, setCQty] = useState("");

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
        <div className="mt-3 flex gap-2">
          <Num value={bQty} onChange={setBQty} className="flex-1" />
          <button type="button" onClick={addBottles} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Kohandatud sildiga pudelid">
        <p className="text-xs text-stone-400 mb-3">Tühi kohandatud silt peal — maitsekleeps lisatakse villimise ajal.</p>
        <label className="block text-sm text-stone-600 mb-1">Suurus</label>
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={clbSize} onChange={(v) => setClbSize(v as number)} />
        <div className="mt-3 flex gap-2">
          <Num value={clbQty} onChange={setClbQty} className="flex-1" />
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
        <div className="mt-3 flex gap-2">
          <Num value={lQty} onChange={setLQty} className="flex-1" />
          <button type="button" onClick={addLabels} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Traatkorgi">
        <p className="text-xs text-stone-400 mb-3">750 ml punnkorkide jaoks — üks traatkork ühe pudeli kohta.</p>
        <div className="flex gap-2">
          <Num value={wcQty} onChange={setWcQty} className="flex-1" />
          <button type="button" onClick={addWireCages} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <Card title="Korduvkasutatavad punnkorgid">
        <p className="text-xs text-stone-400 mb-3">Puhtad punnkorgid, valmis taaskasutusse — villimise ajal arvatakse valitud suuruse laost maha.</p>
        <label className="block text-sm text-stone-600 mb-1">Suurus</label>
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={rcSize} onChange={(v) => setRcSize(v as number)} />
        <div className="mt-3 flex gap-2">
          <Num value={rcQty} onChange={setRcQty} className="flex-1" />
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
              <select value={cExisting} onChange={(e) => setCExisting(Number(e.target.value))} className="w-full rounded-lg border border-stone-300 px-3 py-2">
                {data.caps.map((c) => <option key={c.id} value={c.id}>{capLabel(c)}</option>)}
              </select>
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
          <Num value={cQty} onChange={setCQty} className="flex-1" />
          <button type="button" onClick={addCaps} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
        </div>
      </Card>

      <BlankLabelsCard
        data={data}
        commitMutation={commitMutation}
        addBlankLabelTypeMutation={addBlankLabelTypeMutation}
        removeBlankLabelTypeMutation={removeBlankLabelTypeMutation}
        flash={flash}
      />
    </div>
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

function AjaluguTab({
  data,
  undoMutation,
}: {
  data: LaduData;
  undoMutation: ReturnType<typeof useMutation<void, Error, number>>;
}) {
  if (data.movements.length === 0)
    return <p className="text-sm text-stone-400">Veel ühtegi kannet pole.</p>;
  return (
    <div className="space-y-2">
      {data.movements.map((m) => (
        <div key={m.id} className="flex items-start justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.type === "villimine" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                {m.type}
              </span>
              <span className="text-xs text-stone-400">
                {new Date(m.createdAt).toLocaleString("et-EE")}
              </span>
            </div>
            <div className="text-sm text-stone-700">{m.summary}</div>
          </div>
          <button
            type="button"
            onClick={() => undoMutation.mutate(m.id)}
            disabled={undoMutation.isPending}
            className="text-stone-400 hover:text-amber-700 flex items-center gap-1 text-xs shrink-0 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> tagasi
          </button>
        </div>
      ))}
    </div>
  );
}
