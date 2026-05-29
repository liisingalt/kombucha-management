// =====================================================================
//  LAO LEHT  —  salvesta failina  client/src/pages/Ladu.tsx
//  Lisa Wouteri marsruut App.tsx-i (vt README).
//  Stiil on tahtlikult Tailwind-põhine, et ükski shadcn komponent
//  poleks kohustuslik ja leht töötaks kohe.
// =====================================================================
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  "läbipaistev": "#d6d3d1",
};

type Flavor = { id: number; name: string };
type Cap = { id: number; size: number; type: string; color: string; qty: number };
type Label = { id: number; flavorId: number; size: number; qty: number };
type Movement = { id: number; createdAt: string; kind: string; summary: string };
type State = {
  bottles: { id: number; size: number; qty: number }[];
  labels: Label[];
  caps: Cap[];
  defaults: { flavorId: number; size: number; capId: number }[];
  movements: Movement[];
};

const capLabel = (c?: Cap) =>
  c ? `${c.size} ml · ${c.type || "kork"}${c.color ? " · " + c.color : ""}` : "";

async function post(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

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

function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            value === o.value ? "bg-amber-700 text-white" : "text-stone-600 hover:bg-stone-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none";

export default function Ladu() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("ladu");

  const stateQ = useQuery<State>({
    queryKey: ["/api/inventory/state"],
    queryFn: () => fetch("/api/inventory/state").then((r) => r.json()),
  });
  const flavorsQ = useQuery<Flavor[]>({
    queryKey: ["/api/inventory/flavors"],
    queryFn: () => fetch("/api/inventory/flavors").then((r) => r.json()),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/inventory/state"] });

  if (stateQ.isLoading || flavorsQ.isLoading)
    return <div className="p-8 text-stone-500">Laen ladu…</div>;

  const state = stateQ.data!;
  const flavors = flavorsQ.data ?? [];
  const flavorName = (id: number) => flavors.find((f) => f.id === id)?.name ?? "?";
  const bottleQty = (s: number) => state.bottles.find((b) => b.size === s)?.qty ?? 0;

  const tabs = [
    { id: "ladu", label: "Ladu" },
    { id: "villimine", label: "Villimine" },
    { id: "varu", label: "Lisa varu" },
    { id: "seaded", label: "Vaikekorgid" },
    { id: "ajalugu", label: "Ajalugu" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <h1 className="font-serif text-2xl text-stone-900">Kombucha ladu</h1>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          Pudelid, sildid ja korgid. Villimine arvab varud ise maha.
        </p>

        <nav className="flex flex-wrap gap-1 mb-6 border-b border-stone-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition ${
                tab === t.id
                  ? "border-amber-700 text-amber-800 font-medium"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "ladu" && (
          <LaduView state={state} flavorName={flavorName} bottleQty={bottleQty} />
        )}
        {tab === "villimine" && (
          <Villimine
            state={state}
            flavors={flavors}
            flavorName={flavorName}
            refresh={refresh}
          />
        )}
        {tab === "varu" && (
          <LisaVaru state={state} flavors={flavors} refresh={refresh} />
        )}
        {tab === "seaded" && (
          <Vaikekorgid state={state} flavors={flavors} refresh={refresh} />
        )}
        {tab === "ajalugu" && <Ajalugu state={state} refresh={refresh} />}
      </div>
    </div>
  );
}

/* ---------- LADU ---------- */
function LaduView({
  state,
  flavorName,
  bottleQty,
}: {
  state: State;
  flavorName: (id: number) => string;
  bottleQty: (s: number) => number;
}) {
  return (
    <div className="space-y-7">
      <section>
        <h2 className="font-serif text-lg mb-3">Pudelid</h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = bottleQty(s);
            return (
              <div key={s} className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <div className="text-xs text-stone-500">{s} ml</div>
                <div className={`text-2xl font-semibold ${n <= 0 ? "text-red-600" : ""}`}>{n}</div>
                {n <= 0 && <div className="text-xs text-red-600">telli juurde</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg mb-3">Sildid</h2>
        {state.labels.length === 0 ? (
          <p className="text-sm text-stone-400">Ühtegi silti pole veel lisatud.</p>
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
                {state.labels.map((l) => (
                  <tr key={l.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">{flavorName(l.flavorId)}</td>
                    <td className="px-4 py-2 text-stone-500">{l.size} ml</td>
                    <td className={`px-4 py-2 text-right font-medium ${l.qty <= 0 ? "text-red-600" : ""}`}>
                      {l.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-serif text-lg mb-3">Korgid</h2>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Kork</th>
                <th className="px-4 py-2 font-medium text-right">Kogus</th>
              </tr>
            </thead>
            <tbody>
              {state.caps.map((c) => (
                <tr key={c.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">
                    <ColorDot color={c.color} />
                    {capLabel(c)}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${c.qty <= 0 ? "text-red-600" : ""}`}>
                    {c.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-stone-400 mt-2">
          750 ml korke saad villimisel märkida vanadena, siis neid maha ei arvata.
        </p>
      </section>
    </div>
  );
}

/* ---------- VILLIMINE ---------- */
function Villimine({
  state,
  flavors,
  flavorName,
  refresh,
}: {
  state: State;
  flavors: Flavor[];
  flavorName: (id: number) => string;
  refresh: () => void;
}) {
  const [flavorId, setFlavorId] = useState<number>(flavors[0]?.id ?? 0);
  const [size, setSize] = useState(330);
  const [total, setTotal] = useState("");
  const [returned, setReturned] = useState("");
  const [labeled, setLabeled] = useState("");
  const [capId, setCapId] = useState<number | "">("");
  const [oldCaps, setOldCaps] = useState("");

  const sizeCaps = state.caps.filter((c) => c.size === size);

  useEffect(() => {
    const def = state.defaults.find((d) => d.flavorId === flavorId && d.size === size);
    const exists = def && sizeCaps.some((c) => c.id === def.capId);
    setCapId(exists ? def!.capId : sizeCaps[0]?.id ?? "");
    // eslint-disable-next-line
  }, [flavorId, size]);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const lab = Math.min(t - ret, Math.max(0, parseInt(labeled) || 0));
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));
  const bottleDeduct = t - ret;
  const labelDeduct = t - ret - lab;
  const capDeduct = capId ? t - old : 0;

  const m = useMutation({
    mutationFn: (body: any) => post("/api/inventory/bottling", body),
    onSuccess: () => {
      refresh();
      setTotal("");
      setReturned("");
      setLabeled("");
      setOldCaps("");
    },
  });

  const villi = () => {
    if (!flavorId || t <= 0) return;
    const cap = state.caps.find((c) => c.id === capId);
    const parts = [`Villisin ${t} × ${flavorName(flavorId)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud`);
    if (lab) parts.push(`${lab} juba sildiga`);
    if (old) parts.push(`${old} vana korki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);
    m.mutate({
      flavorId,
      size,
      total: t,
      returned: ret,
      labeled: lab,
      oldCaps: old,
      capId: capId || null,
      summary: parts.join(" · "),
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Maitse</label>
          <select value={flavorId} onChange={(e) => setFlavorId(Number(e.target.value))} className={inputCls}>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Suurus</label>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={size} onChange={setSize} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Mitu pudelit kokku tegid?</label>
          <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Tagasi tulnud pudelid</label>
            <input type="number" value={returned} onChange={(e) => setReturned(e.target.value)} className={inputCls} />
            <p className="text-xs text-stone-400 mt-1">Pudel + silt olemas</p>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Lisaks juba sildiga</label>
            <input type="number" value={labeled} onChange={(e) => setLabeled(e.target.value)} className={inputCls} />
            <p className="text-xs text-stone-400 mt-1">Ainult silt oli olemas</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Kork</label>
            <select value={capId} onChange={(e) => setCapId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
              {sizeCaps.length === 0 && <option value="">korki pole</option>}
              {sizeCaps.map((c) => (
                <option key={c.id} value={c.id}>{capLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Vanu korke kasutatud</label>
            <input type="number" value={oldCaps} onChange={(e) => setOldCaps(e.target.value)} className={inputCls} />
            <p className="text-xs text-stone-400 mt-1">Peamiselt 750 ml</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium text-amber-900 mb-2">Laost arvatakse maha:</p>
        <ul className="space-y-1">
          <li>Pudelid {size} ml: <b>{bottleDeduct}</b></li>
          <li>Sildid {flavorName(flavorId)} {size} ml: <b>{labelDeduct}</b></li>
          <li>Korgid: <b>{capId ? capDeduct : 0}</b></li>
        </ul>
      </div>

      <button
        onClick={villi}
        disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Pane villimine kirja"}
      </button>
    </div>
  );
}

/* ---------- LISA VARU ---------- */
function LisaVaru({
  state,
  flavors,
  refresh,
}: {
  state: State;
  flavors: Flavor[];
  refresh: () => void;
}) {
  const [bSize, setBSize] = useState(330);
  const [bQty, setBQty] = useState("");
  const [lFlavor, setLFlavor] = useState<number>(flavors[0]?.id ?? 0);
  const [lSize, setLSize] = useState(330);
  const [lQty, setLQty] = useState("");
  const [cMode, setCMode] = useState<"olemasolev" | "uus">("olemasolev");
  const [cExisting, setCExisting] = useState<number | "">(state.caps[0]?.id ?? "");
  const [cSize, setCSize] = useState(330);
  const [cType, setCType] = useState("kroonkork");
  const [cColor, setCColor] = useState("");
  const [cQty, setCQty] = useState("");

  const mut = useMutation({
    mutationFn: ({ url, body }: { url: string; body: any }) => post(url, body),
    onSuccess: refresh,
  });

  const flavorName = (id: number) => flavors.find((f) => f.id === id)?.name ?? "";

  const addBottles = () => {
    const q = parseInt(bQty) || 0;
    if (q <= 0) return;
    mut.mutate({ url: "/api/inventory/purchase/bottles", body: { size: bSize, qty: q, summary: `Ostsin ${q} × pudel ${bSize} ml` } });
    setBQty("");
  };
  const addLabels = () => {
    const q = parseInt(lQty) || 0;
    if (!lFlavor || q <= 0) return;
    mut.mutate({ url: "/api/inventory/purchase/labels", body: { flavorId: lFlavor, size: lSize, qty: q, summary: `Ostsin ${q} × silt ${flavorName(lFlavor)} ${lSize} ml` } });
    setLQty("");
  };
  const addCaps = () => {
    const q = parseInt(cQty) || 0;
    if (q <= 0) return;
    if (cMode === "olemasolev") {
      if (!cExisting) return;
      const c = state.caps.find((x) => x.id === cExisting);
      mut.mutate({ url: "/api/inventory/purchase/caps", body: { capId: cExisting, qty: q, summary: `Ostsin ${q} × ${capLabel(c)}` } });
    } else {
      mut.mutate({ url: "/api/inventory/purchase/caps", body: { size: cSize, type: cType, color: cColor.trim(), qty: q, summary: `Ostsin ${q} × ${cSize} ml ${cType}${cColor ? " " + cColor : ""}` } });
    }
    setCQty("");
  };

  return (
    <div className="space-y-5">
      <Card title="Pudelid">
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={bSize} onChange={setBSize} />
        <div className="mt-3 flex gap-2">
          <input type="number" value={bQty} onChange={(e) => setBQty(e.target.value)} className={inputCls} />
          <button onClick={addBottles} className="rounded-lg bg-amber-700 px-4 text-white">Lisa</button>
        </div>
      </Card>

      <Card title="Sildid">
        <div className="grid grid-cols-2 gap-3">
          <select value={lFlavor} onChange={(e) => setLFlavor(Number(e.target.value))} className={inputCls}>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s}` }))} value={lSize} onChange={setLSize} />
        </div>
        <div className="mt-3 flex gap-2">
          <input type="number" value={lQty} onChange={(e) => setLQty(e.target.value)} className={inputCls} />
          <button onClick={addLabels} className="rounded-lg bg-amber-700 px-4 text-white">Lisa</button>
        </div>
      </Card>

      <Card title="Korgid">
        <Seg
          options={[
            { value: "olemasolev", label: "Olemasolev kork" },
            { value: "uus", label: "Uus kork" },
          ]}
          value={cMode}
          onChange={setCMode}
        />
        {cMode === "olemasolev" ? (
          <select value={cExisting} onChange={(e) => setCExisting(e.target.value ? Number(e.target.value) : "")} className={`${inputCls} mt-3`}>
            {state.caps.map((c) => (
              <option key={c.id} value={c.id}>{capLabel(c)}</option>
            ))}
          </select>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select value={cSize} onChange={(e) => setCSize(Number(e.target.value))} className={inputCls}>
              {SIZES.map((s) => <option key={s} value={s}>{s} ml</option>)}
            </select>
            <select value={cType} onChange={(e) => setCType(e.target.value)} className={inputCls}>
              {CAP_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
            <input value={cColor} onChange={(e) => setCColor(e.target.value)} placeholder="värv" className={inputCls} />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input type="number" value={cQty} onChange={(e) => setCQty(e.target.value)} className={inputCls} />
          <button onClick={addCaps} className="rounded-lg bg-amber-700 px-4 text-white">Lisa</button>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="font-serif text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

/* ---------- VAIKEKORGID ---------- */
function Vaikekorgid({
  state,
  flavors,
  refresh,
}: {
  state: State;
  flavors: Flavor[];
  refresh: () => void;
}) {
  const [flavorId, setFlavorId] = useState<number>(flavors[0]?.id ?? 0);
  const [size, setSize] = useState(330);
  const [capId, setCapId] = useState<number | "">("");

  const mut = useMutation({
    mutationFn: (body: any) => post("/api/inventory/flavor-cap-default", body),
    onSuccess: refresh,
  });

  const sizeCaps = state.caps.filter((c) => c.size === size);

  return (
    <div className="space-y-5">
      <Card title="Määra maitse vaikekork">
        <p className="text-sm text-stone-500 mb-3">
          Villimisel pakutakse seda korki automaatselt. Saad selle villimisel alati üle valida.
        </p>
        <div className="space-y-3">
          <select value={flavorId} onChange={(e) => setFlavorId(Number(e.target.value))} className={inputCls}>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={size} onChange={setSize} />
          <select value={capId} onChange={(e) => setCapId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            <option value="">— vali kork —</option>
            {sizeCaps.map((c) => (
              <option key={c.id} value={c.id}>{capLabel(c)}</option>
            ))}
          </select>
          <button
            onClick={() => capId && mut.mutate({ flavorId, size, capId })}
            className="rounded-lg bg-amber-700 px-4 py-2 text-white"
          >
            Salvesta vaikekork
          </button>
        </div>
      </Card>

      {state.defaults.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden text-sm">
          {state.defaults.map((d, i) => {
            const f = flavors.find((x) => x.id === d.flavorId);
            const c = state.caps.find((x) => x.id === d.capId);
            return (
              <div key={i} className="px-4 py-2 border-b border-stone-100 last:border-0">
                {f?.name ?? "?"} {d.size} ml → {capLabel(c)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- AJALUGU ---------- */
function Ajalugu({ state, refresh }: { state: State; refresh: () => void }) {
  const undo = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/inventory/movements/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: refresh,
  });

  if (state.movements.length === 0)
    return <p className="text-sm text-stone-400">Veel ühtegi kannet pole.</p>;

  return (
    <div className="space-y-2">
      {state.movements.map((m) => (
        <div key={m.id} className="flex items-start justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.kind === "villimine" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                {m.kind}
              </span>
              <span className="text-xs text-stone-400">
                {new Date(m.createdAt).toLocaleString("et-EE")}
              </span>
            </div>
            <div className="text-sm text-stone-700">{m.summary}</div>
          </div>
          <button
            onClick={() => undo.mutate(m.id)}
            className="text-stone-400 hover:text-amber-700 text-xs shrink-0"
          >
            tagasi
          </button>
        </div>
      ))}
    </div>
  );
}
