import React, { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Boxes, FlaskConical, Tags, History, Plus, RotateCcw, Trash2, AlertTriangle, Pencil, Check, X } from "lucide-react";
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
type LabeledBottle = { id: number; flavorId: number; size: number; qty: number };
type CustomLabelBottle = { id: number; size: number; qty: number };
type Movement = { id: number; type: string; summary: string; deltas: unknown[]; createdAt: string };

type ReusableCap = { size: number; qty: number };

type LaduData = {
  flavors: Flavor[];
  bottles: Bottle[];
  labels: Label[];
  caps: Cap[];
  labeledBottles: LabeledBottle[];
  customLabelBottles: CustomLabelBottle[];
  wireCageQty: number;
  reusableCaps: ReusableCap[];
  movements: Movement[];
};

const EMPTY: LaduData = { flavors: [], bottles: [], labels: [], caps: [], labeledBottles: [], customLabelBottles: [], wireCageQty: 0, reusableCaps: [], movements: [] };

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
  const [tab, setTab] = useState("ladu");
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
    mutationFn: async ({ deltas, type, summary }: { deltas: unknown[]; type: string; summary: string }) => {
      const res = await authFetch("/ladu/commit", {
        method: "POST",
        body: JSON.stringify({ type, summary, deltas }),
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

        {tab === "ladu" && <LaduTab data={data} flavorName={flavorName} bottleQty={bottleQty} updateCapMutation={updateCapMutation} flash={flash} />}
        {tab === "villimine" && (
          <VillimineTab data={data} flavorName={flavorName} commitMutation={commitMutation} flash={flash} />
        )}
        {tab === "varu" && (
          <LisaVaruTab data={data} commitMutation={commitMutation} flash={flash} />
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

type CommitMutation = ReturnType<typeof useMutation<LaduData, Error, { deltas: unknown[]; type: string; summary: string }>>;

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
        <h2 className="font-serif text-lg text-stone-900 mb-3">Sildistatud pudelid</h2>
        {data.labeledBottles.length === 0 ? (
          <p className="text-sm text-stone-400">Pole ühtegi sildistatud pudelit laos.</p>
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
                {data.labeledBottles
                  .slice()
                  .sort((a, b) => flavorName(a.flavorId).localeCompare(flavorName(b.flavorId)))
                  .map((lb) => (
                    <tr key={lb.id} className="border-t border-stone-100">
                      <td className="px-4 py-2">{flavorName(lb.flavorId)}</td>
                      <td className="px-4 py-2 text-stone-500">{lb.size} ml</td>
                      <td className={`px-4 py-2 text-right font-medium ${lb.qty <= 0 ? "text-red-600" : ""}`}>{lb.qty}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-stone-400 mt-2">
          Pudel + silt koos, valmis väljastamiseks. Lisa "Lisa varu" all.
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
  const [fromLabeled, setFromLabeled] = useState("");
  const [fromCustom, setFromCustom] = useState("");
  const [capId, setCapId] = useState<number | "">("");
  const [oldCaps, setOldCaps] = useState("");

  const sizeCaps = data.caps.filter((c) => c.size === size);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const fromLab = Math.min(ret, Math.max(0, parseInt(fromLabeled) || 0));
  const newCount = t - ret;
  const fromCust = Math.min(newCount, Math.max(0, parseInt(fromCustom) || 0));
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));

  const selectedCap = data.caps.find((c) => c.id === capId);
  const isPunnkork = selectedCap?.type === "punnkork";
  const reusableStock = data.reusableCaps.find((r) => r.size === size)?.qty ?? 0;
  const bottleDeduct = newCount - fromCust;
  const customLabelBottleDeduct = fromCust;
  const labelDeduct = newCount - fromCust;
  const labeledBottleDeduct = fromLab;
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
    if (labeledBottleDeduct > 0) deltas.push({ kind: "labeled_bottle", flavorId, size, amount: -labeledBottleDeduct });
    if (capId !== "" && capDeduct > 0) deltas.push({ kind: "cap", key: capId, amount: -capDeduct });
    if (wireCageDeduct > 0) deltas.push({ kind: "wire_cage", amount: -wireCageDeduct });
    if (reusableCapDeduct > 0) deltas.push({ kind: "reusable_cap", size, amount: -reusableCapDeduct });

    const cap = selectedCap;
    const parts = [`Villisin ${t} × ${flavorName(flavorId as number)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud pudelit`);
    if (fromLab) parts.push(`sh ${fromLab} sildistatud varust`);
    if (fromCust) parts.push(`${fromCust} kohandatud sildiga pudelit`);
    if (reusableCapDeduct > 0) parts.push(`${reusableCapDeduct} korduvkasutatavat punnkorki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);
    if (wireCageDeduct > 0) parts.push(`${wireCageDeduct} traatkorki`);

    commitMutation.mutate(
      { deltas, type: "villimine", summary: parts.join(" · ") },
      {
        onSuccess: () => {
          flash("Villimine kirja pandud");
          setTotal(""); setReturned(""); setFromLabeled(""); setFromCustom(""); setOldCaps("");
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Tagasi tulnud pudelid</label>
            <Num value={returned} onChange={setReturned} />
            <p className="text-xs text-stone-400 mt-1">Pudel + silt koos</p>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">sh sildistatud varust</label>
            <Num value={fromLabeled} onChange={setFromLabeled} />
            <p className="text-xs text-stone-400 mt-1">Arvatakse lao sildistatud pudelitest</p>
          </div>
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
          <li>Sildistatud pudelid: <b>{labeledBottleDeduct}</b></li>
          <li>
            Korgid: <b>{capId !== "" ? capDeduct : 0}</b>
            {capId !== "" && <span className="text-stone-500"> ({capLabel(selectedCap)})</span>}
          </li>
          {wireCageDeduct > 0 && <li>Traatkorgi: <b>{wireCageDeduct}</b></li>}
          {reusableCapDeduct > 0 && <li>Korduvkasutatavad punnkorgid {size} ml: <b>{reusableCapDeduct}</b></li>}
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

function LisaVaruTab({ data, commitMutation, flash }: { data: LaduData; commitMutation: CommitMutation; flash: (msg: string) => void }) {
  const [bSize, setBSize] = useState<number>(330);
  const [bQty, setBQty] = useState("");
  const [clbSize, setClbSize] = useState<number>(330);
  const [clbQty, setClbQty] = useState("");
  const [lFlavor, setLFlavor] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [lSize, setLSize] = useState<number>(330);
  const [lQty, setLQty] = useState("");
  const [lbFlavor, setLbFlavor] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [lbSize, setLbSize] = useState<number>(330);
  const [lbQty, setLbQty] = useState("");
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

  const addLabeledBottles = () => {
    const q = parseInt(lbQty) || 0;
    if (!lbFlavor) return flash("Vali maitse");
    if (q <= 0) return flash("Sisesta kogus");
    commitMutation.mutate(
      {
        deltas: [{ kind: "labeled_bottle", flavorId: lbFlavor, size: lbSize, amount: q }],
        type: "ost",
        summary: `Lisasin ${q} × sildistatud pudel ${flavorN(lbFlavor)} ${lbSize} ml`,
      },
      { onSuccess: () => { flash("Sildistatud pudelid lisatud"); setLbQty(""); } }
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

      <Card title="Juba sildistatud pudel">
        <p className="text-xs text-stone-400 mb-3">Pudel + silt koos — nt tagastatud või eelnevalt sildistatud varu.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitse</label>
            {data.flavors.length === 0 ? (
              <p className="text-xs text-stone-400">Lisa maitsed esmalt.</p>
            ) : (
              <select value={lbFlavor} onChange={(e) => setLbFlavor(Number(e.target.value))} className="w-full rounded-lg border border-stone-300 px-3 py-2">
                {data.flavors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Suurus</label>
            <Seg options={SIZES.map((s) => ({ value: s, label: `${s}` }))} value={lbSize} onChange={(v) => setLbSize(v as number)} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Num value={lbQty} onChange={setLbQty} className="flex-1" />
          <button type="button" onClick={addLabeledBottles} disabled={commitMutation.isPending} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800 disabled:opacity-60">Lisa</button>
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
