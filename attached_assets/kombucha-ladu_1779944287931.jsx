import React, { useState, useEffect } from "react";
import { Package, Boxes, FlaskConical, Tags, Disc, History, Plus, RotateCcw, Trash2, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "kombucha_ladu_v1";
const SIZES = [330, 500, 750];
const CAP_TYPES = ["kroonkork", "punnkork"];

const COLOR_HEX = {
  sinine: "#2563eb",
  punane: "#dc2626",
  kollane: "#eab308",
  roheline: "#16a34a",
  pruun: "#92400e",
  valge: "#f5f5f4",
  must: "#1c1917",
  "läbipaistev": "#d6d3d1",
};

const SEED = {
  flavors: [
    { id: "f1", name: "Leedimari", defaultCapId: "c1" },
    { id: "f2", name: "Aroonia", defaultCapId: "c2" },
  ],
  bottles: { 330: 0, 500: 0, 750: 0 },
  labels: [],
  caps: [
    { id: "c1", size: 330, type: "kroonkork", color: "sinine", qty: 0 },
    { id: "c2", size: 330, type: "kroonkork", color: "punane", qty: 0 },
    { id: "c3", size: 750, type: "punnkork", color: "", qty: 0 },
    { id: "c4", size: 750, type: "kroonkork", color: "", qty: 0 },
  ],
  movements: [],
};

const uid = () => Math.random().toString(36).slice(2, 9);
const capLabel = (c) =>
  c ? `${c.size} ml · ${c.type || "kork"}${c.color ? " · " + c.color : ""}` : "";

function ColorDot({ color }) {
  const hex = COLOR_HEX[(color || "").toLowerCase()];
  if (!hex) return null;
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-stone-300 align-middle mr-1"
      style={{ backgroundColor: hex }}
    />
  );
}

function Num({ value, onChange, className = "" }) {
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

function Seg({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
      {options.map((o) => (
        <button
          key={o.value}
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

export default function App() {
  const [data, setData] = useState(SEED);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("ladu");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r && r.value) setData(JSON.parse(r.value));
      } catch (e) {
        /* esmakordsel avamisel andmeid pole, kasutan algseadeid */
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        /* salvestus ebaõnnestus */
      }
    })();
  }, [data, loaded]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // --- laoseisu muutmise tuum ---
  function applyDeltas(d, deltas) {
    const nd = JSON.parse(JSON.stringify(d));
    for (const x of deltas) {
      if (x.kind === "bottle") nd.bottles[x.key] = (nd.bottles[x.key] || 0) + x.amount;
      if (x.kind === "label") {
        let l = nd.labels.find((y) => y.flavorId === x.flavorId && y.size === x.size);
        if (!l) {
          l = { id: uid(), flavorId: x.flavorId, size: x.size, qty: 0 };
          nd.labels.push(l);
        }
        l.qty += x.amount;
      }
      if (x.kind === "cap") {
        let c = nd.caps.find((y) => y.id === x.key);
        if (!c && x.create) {
          c = { id: x.key, ...x.create, qty: 0 };
          nd.caps.push(c);
        }
        if (c) c.qty += x.amount;
      }
    }
    return nd;
  }

  function ensureLabel(d, flavorId, size) {
    let l = d.labels.find((x) => x.flavorId === flavorId && x.size === size);
    if (!l) {
      l = { id: uid(), flavorId, size, qty: 0 };
      d.labels.push(l);
    }
    return l;
  }

  function commit(deltas, type, summary) {
    setData((prev) => {
      const nd = applyDeltas(prev, deltas);
      nd.movements = [
        { id: uid(), ts: Date.now(), type, summary, deltas },
        ...nd.movements,
      ].slice(0, 200);
      return nd;
    });
  }

  function undo(movId) {
    setData((prev) => {
      const m = prev.movements.find((x) => x.id === movId);
      if (!m) return prev;
      const reverse = m.deltas.map((x) => ({ ...x, amount: -x.amount }));
      const nd = applyDeltas(prev, reverse);
      nd.movements = nd.movements.filter((x) => x.id !== movId);
      return nd;
    });
    flash("Kanne võetud tagasi");
  }

  if (!loaded)
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500">
        Laen ladu…
      </div>
    );

  const flavorName = (id) => data.flavors.find((f) => f.id === id)?.name || "?";

  const tabs = [
    { id: "ladu", label: "Ladu", icon: Boxes },
    { id: "villimine", label: "Villimine", icon: FlaskConical },
    { id: "varu", label: "Lisa varu", icon: Plus },
    { id: "maitsed", label: "Maitsed", icon: Tags },
    { id: "ajalugu", label: "Ajalugu", icon: History },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
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

        {tab === "ladu" && <Ladu data={data} flavorName={flavorName} />}
        {tab === "villimine" && (
          <Villimine
            data={data}
            flavorName={flavorName}
            ensureLabel={ensureLabel}
            setData={setData}
            commit={commit}
            flash={flash}
          />
        )}
        {tab === "varu" && (
          <LisaVaru data={data} setData={setData} commit={commit} flash={flash} ensureLabel={ensureLabel} />
        )}
        {tab === "maitsed" && (
          <Maitsed data={data} setData={setData} flash={flash} />
        )}
        {tab === "ajalugu" && (
          <Ajalugu data={data} undo={undo} flavorName={flavorName} />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------- LADU ---------------- */
function Ladu({ data, flavorName }) {
  const Low = ({ show }) =>
    show ? (
      <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600">
        <AlertTriangle className="w-3 h-3" /> telli juurde
      </span>
    ) : null;

  return (
    <div className="space-y-7">
      <section>
        <h2 className="font-serif text-lg text-stone-900 mb-3">Pudelid</h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = data.bottles[s] || 0;
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
        <h2 className="font-serif text-lg text-stone-900 mb-3">Korgid</h2>
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
        <p className="text-xs text-stone-400 mt-2">
          750 ml korke saad villimisel märkida vanadena, siis neid maha ei arvata.
        </p>
      </section>
    </div>
  );
}

/* ---------------- VILLIMINE ---------------- */
function Villimine({ data, flavorName, commit, flash }) {
  const [flavorId, setFlavorId] = useState(data.flavors[0]?.id || "");
  const [size, setSize] = useState(330);
  const [total, setTotal] = useState("");
  const [returned, setReturned] = useState("");
  const [labeled, setLabeled] = useState("");
  const [capId, setCapId] = useState("");
  const [oldCaps, setOldCaps] = useState("");

  const sizeCaps = data.caps.filter((c) => c.size === size);

  // vaikekork: maitse oma, kui suurus sobib, muidu esimene sama suuruse kork
  useEffect(() => {
    const f = data.flavors.find((x) => x.id === flavorId);
    const def = data.caps.find((c) => c.id === f?.defaultCapId && c.size === size);
    setCapId(def ? def.id : sizeCaps[0]?.id || "");
    // eslint-disable-next-line
  }, [flavorId, size]);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const lab = Math.min(t - ret, Math.max(0, parseInt(labeled) || 0));
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));

  const bottleDeduct = t - ret;
  const labelDeduct = t - ret - lab;
  const capDeduct = capId ? t - old : 0;

  const villi = () => {
    if (!flavorId) return flash("Vali maitse");
    if (t <= 0) return flash("Sisesta pudelite arv");

    const deltas = [];
    if (bottleDeduct > 0) deltas.push({ kind: "bottle", key: size, amount: -bottleDeduct });
    if (labelDeduct > 0) deltas.push({ kind: "label", flavorId, size, amount: -labelDeduct });
    if (capId && capDeduct > 0) deltas.push({ kind: "cap", key: capId, amount: -capDeduct });

    const cap = data.caps.find((c) => c.id === capId);
    const parts = [`Villisin ${t} × ${flavorName(flavorId)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud pudelit`);
    if (lab) parts.push(`${lab} juba sildiga`);
    if (old) parts.push(`${old} vana korki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);

    commit(deltas, "villimine", parts.join(" · "));
    flash("Villimine kirja pandud");
    setTotal("");
    setReturned("");
    setLabeled("");
    setOldCaps("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Maitse</label>
          <select
            value={flavorId}
            onChange={(e) => setFlavorId(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
          >
            {data.flavors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Suurus</label>
          <Seg
            options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))}
            value={size}
            onChange={setSize}
          />
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
              onChange={(e) => setCapId(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none"
            >
              {sizeCaps.length === 0 && <option value="">korki pole</option>}
              {sizeCaps.map((c) => (
                <option key={c.id} value={c.id}>
                  {capLabel(c)}
                </option>
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
          <li>Sildid {flavorName(flavorId)} {size} ml: <b>{labelDeduct}</b></li>
          <li>
            Korgid: <b>{capId ? capDeduct : 0}</b>
            {capId && <span className="text-stone-500"> ({capLabel(data.caps.find((c) => c.id === capId))})</span>}
          </li>
        </ul>
      </div>

      <button
        onClick={villi}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 transition"
      >
        Pane villimine kirja
      </button>
    </div>
  );
}

/* ---------------- LISA VARU ---------------- */
function LisaVaru({ data, commit, flash }) {
  // pudelid
  const [bSize, setBSize] = useState(330);
  const [bQty, setBQty] = useState("");
  // sildid
  const [lFlavor, setLFlavor] = useState(data.flavors[0]?.id || "");
  const [lSize, setLSize] = useState(330);
  const [lQty, setLQty] = useState("");
  // korgid
  const [cMode, setCMode] = useState("olemasolev"); // olemasolev | uus
  const [cExisting, setCExisting] = useState(data.caps[0]?.id || "");
  const [cSize, setCSize] = useState(330);
  const [cType, setCType] = useState("kroonkork");
  const [cColor, setCColor] = useState("");
  const [cQty, setCQty] = useState("");

  const addBottles = () => {
    const q = parseInt(bQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    commit([{ kind: "bottle", key: bSize, amount: q }], "ost", `Ostsin ${q} × pudel ${bSize} ml`);
    flash("Pudelid lisatud");
    setBQty("");
  };

  const flavorN = (id) => data.flavors.find((f) => f.id === id)?.name || "?";

  const addLabels = () => {
    const q = parseInt(lQty) || 0;
    if (!lFlavor) return flash("Vali maitse");
    if (q <= 0) return flash("Sisesta kogus");
    commit(
      [{ kind: "label", flavorId: lFlavor, size: lSize, amount: q }],
      "ost",
      `Ostsin ${q} × silt ${flavorN(lFlavor)} ${lSize} ml`
    );
    flash("Sildid lisatud");
    setLQty("");
  };

  const addCaps = () => {
    const q = parseInt(cQty) || 0;
    if (q <= 0) return flash("Sisesta kogus");
    if (cMode === "olemasolev") {
      if (!cExisting) return flash("Vali kork");
      commit([{ kind: "cap", key: cExisting, amount: q }], "ost", `Ostsin ${q} × ${capLabel(data.caps.find((c) => c.id === cExisting))}`);
    } else {
      const id = uid();
      commit([{ kind: "cap", key: id, amount: q, create: { size: cSize, type: cType, color: cColor.trim() } }], "ost", `Ostsin ${q} × ${cSize} ml ${cType}${cColor ? " " + cColor : ""}`);
    }
    flash("Korgid lisatud");
    setCQty("");
  };

  return (
    <div className="space-y-5">
      <Card title="Pudelid">
        <label className="block text-sm text-stone-600 mb-1">Suurus</label>
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={bSize} onChange={setBSize} />
        <div className="mt-3 flex gap-2">
          <Num value={bQty} onChange={setBQty} className="flex-1" />
          <button onClick={addBottles} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800">
            Lisa
          </button>
        </div>
      </Card>

      <Card title="Sildid">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitse</label>
            <select value={lFlavor} onChange={(e) => setLFlavor(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              {data.flavors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Suurus</label>
            <Seg options={SIZES.map((s) => ({ value: s, label: `${s}` }))} value={lSize} onChange={setLSize} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Num value={lQty} onChange={setLQty} className="flex-1" />
          <button onClick={addLabels} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800">Lisa</button>
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
          <div className="mt-3">
            <select value={cExisting} onChange={(e) => setCExisting(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              {data.caps.map((c) => (
                <option key={c.id} value={c.id}>{capLabel(c)}</option>
              ))}
            </select>
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
          <button onClick={addCaps} className="rounded-lg bg-amber-700 px-4 text-white hover:bg-amber-800">Lisa</button>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="font-serif text-lg text-stone-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

/* ---------------- MAITSED ---------------- */
function Maitsed({ data, setData, flash }) {
  const [name, setName] = useState("");
  const [capId, setCapId] = useState("");

  const add = () => {
    if (!name.trim()) return flash("Sisesta maitse nimi");
    setData((p) => ({
      ...p,
      flavors: [...p.flavors, { id: uid(), name: name.trim(), defaultCapId: capId || null }],
    }));
    setName("");
    setCapId("");
    flash("Maitse lisatud");
  };

  const remove = (id) => {
    setData((p) => ({ ...p, flavors: p.flavors.filter((f) => f.id !== id) }));
  };

  const reset = () => {
    if (confirm("Kustutan kõik andmed ja taastan algseaded?")) {
      setData(SEED);
      flash("Andmed lähtestatud");
    }
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
          />
          <div>
            <label className="block text-sm text-stone-600 mb-1">Vaikekork (valikuline)</label>
            <select value={capId} onChange={(e) => setCapId(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">— vali hiljem —</option>
              {data.caps.map((c) => (
                <option key={c.id} value={c.id}>{capLabel(c)}</option>
              ))}
            </select>
            <p className="text-xs text-stone-400 mt-1">Villimisel pakutakse seda korki automaatselt.</p>
          </div>
          <button onClick={add} className="rounded-lg bg-amber-700 px-4 py-2 text-white hover:bg-amber-800">Lisa maitse</button>
        </div>
      </Card>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {data.flavors.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0">
            <div>
              <div className="font-medium">{f.name}</div>
              <div className="text-xs text-stone-400">
                {f.defaultCapId ? capLabel(data.caps.find((c) => c.id === f.defaultCapId)) : "vaikekork määramata"}
              </div>
            </div>
            <button onClick={() => remove(f.id)} className="text-stone-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={reset} className="text-sm text-stone-400 hover:text-red-600 flex items-center gap-1">
        <RotateCcw className="w-4 h-4" /> Lähtesta kõik andmed
      </button>
    </div>
  );
}

/* ---------------- AJALUGU ---------------- */
function Ajalugu({ data, undo }) {
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
                {new Date(m.ts).toLocaleString("et-EE")}
              </span>
            </div>
            <div className="text-sm text-stone-700">{m.summary}</div>
          </div>
          <button onClick={() => undo(m.id)} className="text-stone-400 hover:text-amber-700 flex items-center gap-1 text-xs shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> tagasi
          </button>
        </div>
      ))}
    </div>
  );
}
