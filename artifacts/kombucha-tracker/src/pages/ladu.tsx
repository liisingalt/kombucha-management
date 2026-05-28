import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { Package, Boxes, FlaskConical, Tags, History, Plus, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const SIZES = [330, 500, 750];
const CAP_TYPES = ["kroonkork", "punnkork"];

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
type Movement = { id: number; type: string; summary: string; deltas: unknown[]; createdAt: string };

type LaduData = {
  flavors: Flavor[];
  bottles: Bottle[];
  labels: Label[];
  caps: Cap[];
  movements: Movement[];
};

const EMPTY: LaduData = { flavors: [], bottles: [], labels: [], caps: [], movements: [] };

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

export default function LaduPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<LaduData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ladu");
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const authFetch = async (path: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(`${BASE_URL}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });
  };

  const load = async () => {
    try {
      const res = await authFetch("/ladu");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const commit = async (deltas: unknown[], type: string, summary: string) => {
    const res = await authFetch("/ladu/commit", {
      method: "POST",
      body: JSON.stringify({ type, summary, deltas }),
    });
    if (res.ok) {
      setData(await res.json());
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Viga");
    }
  };

  const undo = async (movId: number) => {
    const res = await authFetch(`/ladu/movements/${movId}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      flash("Kanne võetud tagasi");
    } else {
      flash("Tagasivõtmine ebaõnnestus");
    }
  };

  const addFlavor = async (name: string, defaultCapId: number | null) => {
    const res = await authFetch("/ladu/flavors", {
      method: "POST",
      body: JSON.stringify({ name, defaultCapId }),
    });
    if (res.ok) {
      const flavor = await res.json();
      setData((d) => ({ ...d, flavors: [...d.flavors, flavor] }));
      flash("Maitse lisatud");
    }
  };

  const removeFlavor = async (id: number) => {
    const res = await authFetch(`/ladu/flavors/${id}`, { method: "DELETE" });
    if (res.ok) {
      setData((d) => ({ ...d, flavors: d.flavors.filter((f) => f.id !== id) }));
      flash("Maitse eemaldatud");
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Kustutamine ebaõnnestus");
    }
  };

  const resetAll = async () => {
    if (!confirm("Kustutan kõik andmed?")) return;
    const res = await authFetch("/ladu/reset", { method: "DELETE" });
    if (res.ok) {
      setData(EMPTY);
      flash("Andmed lähtestatud");
    }
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] text-stone-500">Laen ladu…</div>
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

        {tab === "ladu" && <LaduTab data={data} flavorName={flavorName} bottleQty={bottleQty} />}
        {tab === "villimine" && (
          <VillimineTab data={data} flavorName={flavorName} commit={commit} flash={flash} />
        )}
        {tab === "varu" && (
          <LisaVaruTab data={data} commit={commit} flash={flash} />
        )}
        {tab === "maitsed" && (
          <MaitsedTab data={data} addFlavor={addFlavor} removeFlavor={removeFlavor} resetAll={resetAll} />
        )}
        {tab === "ajalugu" && (
          <AjaluguTab data={data} undo={undo} />
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

function LaduTab({ data, flavorName, bottleQty }: { data: LaduData; flavorName: (id: number) => string; bottleQty: (size: number) => number }) {
  const Low = ({ show }: { show: boolean }) =>
    show ? (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
        <AlertTriangle className="w-3 h-3" /> telli juurde
      </span>
    ) : null;

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
        <h2 className="font-serif text-lg text-stone-900 mb-3">Korgid</h2>
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
                {data.caps.map((c) => (
                  <tr key={c.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">
                      <ColorDot color={c.color} />
                      {capLabel(c)}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${c.qty <= 0 ? "text-red-600" : ""}`}>{c.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-stone-400 mt-2">
          750 ml korke saad villimisel märkida vanadena, siis neid maha ei arvata.
        </p>
      </section>
    </div>
  );
}

function VillimineTab({ data, flavorName, commit, flash }: { data: LaduData; flavorName: (id: number) => string; commit: (deltas: unknown[], type: string, summary: string) => Promise<void>; flash: (msg: string) => void }) {
  const [flavorId, setFlavorId] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [size, setSize] = useState<number>(330);
  const [total, setTotal] = useState("");
  const [returned, setReturned] = useState("");
  const [labeled, setLabeled] = useState("");
  const [capId, setCapId] = useState<number | "">("");
  const [oldCaps, setOldCaps] = useState("");
  const [saving, setSaving] = useState(false);

  const sizeCaps = data.caps.filter((c) => c.size === size);

  useEffect(() => {
    if (flavorId === "") return;
    const f = data.flavors.find((x) => x.id === flavorId);
    const def = data.caps.find((c) => c.id === f?.defaultCapId && c.size === size);
    setCapId(def ? def.id : sizeCaps[0]?.id ?? "");
  }, [flavorId, size, data.caps, data.flavors]);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const lab = Math.min(t - ret, Math.max(0, parseInt(labeled) || 0));
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));

  const bottleDeduct = t - ret;
  const labelDeduct = t - ret - lab;
  const capDeduct = capId !== "" ? t - old : 0;

  const villi = async () => {
    if (!flavorId) return flash("Vali maitse");
    if (t <= 0) return flash("Sisesta pudelite arv");

    const deltas: unknown[] = [];
    if (bottleDeduct > 0) deltas.push({ kind: "bottle", key: size, amount: -bottleDeduct });
    if (labelDeduct > 0) deltas.push({ kind: "label", flavorId, size, amount: -labelDeduct });
    if (capId !== "" && capDeduct > 0) deltas.push({ kind: "cap", key: capId, amount: -capDeduct });

    const cap = data.caps.find((c) => c.id === capId);
    const parts = [`Villisin ${t} × ${flavorName(flavorId as number)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud pudelit`);
    if (lab) parts.push(`${lab} juba sildiga`);
    if (old) parts.push(`${old} vana korki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);

    setSaving(true);
    await commit(deltas, "villimine", parts.join(" · "));
    setSaving(false);
    flash("Villimine kirja pandud");
    setTotal(""); setReturned(""); setLabeled(""); setOldCaps("");
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
            <p className="text-xs text-stone-400 mt-1">Pudel + silt juba olemas</p>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Lisaks juba sildiga</label>
            <Num value={labeled} onChange={setLabeled} />
            <p className="text-xs text-stone-400 mt-1">Ainult silt oli olemas</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Kork</label>
            <select
              value={capId}
              onChange={(e) => setCapId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
            >
              {sizeCaps.length === 0 && <option value="">korki pole</option>}
              {sizeCaps.map((c) => (
                <option key={c.id} value={c.id}>{capLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Vanu korke kasutatud</label>
            <Num value={oldCaps} onChange={setOldCaps} />
            <p className="text-xs text-stone-400 mt-1">Peamiselt 750 ml</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-stone-700">
        <p className="font-medium text-amber-900 mb-2">Laost arvatakse maha:</p>
        <ul className="space-y-1">
          <li>Pudelid {size} ml: <b>{bottleDeduct}</b></li>
          <li>Sildid {flavorId ? flavorName(flavorId as number) : "—"} {size} ml: <b>{labelDeduct}</b></li>
          <li>
            Korgid: <b>{capId !== "" ? capDeduct : 0}</b>
            {capId !== "" && <span className="text-stone-500"> ({capLabel(data.caps.find((c) => c.id === capId))})</span>}
          </li>
        </ul>
      </div>

      <button
        onClick={villi}
        disabled={saving}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 transition disabled:opacity-60"
      >
        {saving ? "Salvestan…" : "Pane villimine kirja"}
      </button>
    </div>
  );
}

function LisaVaruTab({ data, commit, flash }: { data: LaduData; commit: (deltas: unknown[], type: string, summary: string) => Promise<void>; flash: (msg: string) => void }) {
  const [bSize, setBSize] = useState<number>(330);
  const [bQty, setBQty] = useState("");
  const [lFlavor, setLFlavor] = useState<number | "">(data.flavors[0]?.id ?? "");
  const [lSize, setLSize] = useState<number>(330);
  const [lQty, setLQty] = useState("");
  const [cMode, setCMode] = useState<"olemasolev" | "uus">("olemasolev");
  const [cExisting, setCExisting] = useState<number | "">(data.caps[0]?.id ?? "");
  const [cSize, setCSize] = useState<number>(330);
  const [cType, setCType] = useState("kroonkork");
  const [cColor, setCColor] = useState("");
  const [cQty, setCQty] = useState("");

  const flavorN = (id: number | "") => (id !== "" ? (data.flavors.find((f) => f.id === id)?.name ?? "?") : "—");

  const addBottles = async () => {
    const q = parseInt(bQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    await commit([{ kind: "bottle", key: bSize, amount: q }], "ost", `Ostsin ${q} × pudel ${bSize} ml`);
    flash("Pudelid lisatud");
    setBQty("");
  };

  const addLabels = async () => {
    const q = parseInt(lQty) || 0;
    if (!lFlavor) return flash("Vali maitse");
    if (q <= 0) return flash("Sisesta kogus");
    await commit([{ kind: "label", flavorId: lFlavor, size: lSize, amount: q }], "ost", `Ostsin ${q} × silt ${flavorN(lFlavor)} ${lSize} ml`);
    flash("Sildid lisatud");
    setLQty("");
  };

  const addCaps = async () => {
    const q = parseInt(cQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    if (cMode === "olemasolev") {
      if (!cExisting) return flash("Vali kork");
      const cap = data.caps.find((c) => c.id === cExisting);
      await commit([{ kind: "cap", key: cExisting, amount: q }], "ost", `Ostsin ${q} × ${capLabel(cap)}`);
    } else {
      await commit(
        [{ kind: "cap", key: 0, amount: q, create: { size: cSize, type: cType, color: cColor.trim() } }],
        "ost",
        `Ostsin ${q} × ${cSize} ml ${cType}${cColor ? " " + cColor : ""}`
      );
    }
    flash("Korgid lisatud");
    setCQty("");
  };

  return (
    <div className="space-y-5">
      <Card title="Pudelid">
        <label className="block text-sm text-stone-600 mb-1">Suurus</label>
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={bSize} onChange={(v) => setBSize(v as number)} />
        <div className="mt-3 flex gap-2">
          <Num value={bQty} onChange={setBQty} className="flex-1" />
          <button type="button" onClick={addBottles} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800">Lisa</button>
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
          <button type="button" onClick={addLabels} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800">Lisa</button>
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
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select value={cSize} onChange={(e) => setCSize(parseInt(e.target.value))} className="rounded-lg border border-stone-300 px-2 py-2">
              {SIZES.map((s) => <option key={s} value={s}>{s} ml</option>)}
            </select>
            <select value={cType} onChange={(e) => setCType(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-2">
              {CAP_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
            <input
              value={cColor}
              onChange={(e) => setCColor(e.target.value)}
              placeholder="värv"
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Num value={cQty} onChange={setCQty} className="flex-1" />
          <button type="button" onClick={addCaps} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800">Lisa</button>
        </div>
      </Card>
    </div>
  );
}

function MaitsedTab({ data, addFlavor, removeFlavor, resetAll }: { data: LaduData; addFlavor: (name: string, defaultCapId: number | null) => Promise<void>; removeFlavor: (id: number) => Promise<void>; resetAll: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [capId, setCapId] = useState<number | "">("");

  const add = async () => {
    if (!name.trim()) return;
    await addFlavor(name.trim(), capId !== "" ? (capId as number) : null);
    setName(""); setCapId("");
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
          <button type="button" onClick={add} className="rounded-lg bg-amber-700 px-4 py-2 text-white hover:bg-amber-800">Lisa maitse</button>
        </div>
      </Card>

      {data.flavors.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {data.flavors.map((f) => {
            const defCap = data.caps.find((c) => c.id === f.defaultCapId);
            return (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-stone-400">
                    {defCap ? capLabel(defCap) : "vaikekork määramata"}
                  </div>
                </div>
                <button type="button" onClick={() => removeFlavor(f.id)} className="text-stone-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
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

function AjaluguTab({ data, undo }: { data: LaduData; undo: (id: number) => Promise<void> }) {
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
            onClick={() => undo(m.id)}
            className="text-stone-400 hover:text-amber-700 flex items-center gap-1 text-xs shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> tagasi
          </button>
        </div>
      ))}
    </div>
  );
}
