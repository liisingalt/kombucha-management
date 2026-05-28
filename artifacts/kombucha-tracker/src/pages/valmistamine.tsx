import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { FlaskConical, Pencil, Check, X } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tea = { id: number; name: string; qtyG: number };
type Sugar = { id: number; name: string; qtyG: number };
type Brew = {
  id: number;
  date: string;
  boiledL: number;
  startBoilTime: string;
  tempReachedMin: number | null;
  temp: number | null;
  teaStockId: number | null;
  teaSort: string;
  teaG: number;
  steepMin: number;
  steepHeat: number;
  sugarStockId: number | null;
  sugarG: number;
  coldWaterL: number;
  coolStartTime: string;
  coolPlace: string;
  coolTemp: number | null;
  continuedTime: string;
  notes: string;
  starterPct: number;
  starterG: number;
  electricityKwh: number | null;
  sessionId: number | null;
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600";
const calcCls =
  "w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium";

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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function ValmistaminePage() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  const [tab, setTab] = useState("uus");
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const teaQ = useQuery<Tea[]>({
    queryKey: ["brews-tea-stock"],
    queryFn: async () => {
      const res = await authFetch("/brews/tea-stock");
      return res.json();
    },
  });

  const sugarQ = useQuery<Sugar[]>({
    queryKey: ["brews-sugar-stock"],
    queryFn: async () => {
      const res = await authFetch("/brews/sugar-stock");
      return res.json();
    },
  });

  const brewsQ = useQuery<Brew[]>({
    queryKey: ["brews"],
    queryFn: async () => {
      const res = await authFetch("/brews");
      return res.json();
    },
  });

  const teas = teaQ.data ?? [];
  const sugars = sugarQ.data ?? [];

  const tabs = [
    { id: "uus", label: "Uus pruulimine" },
    { id: "tee", label: "Tee varu" },
    { id: "suhkur", label: "Suhkru varu" },
    { id: "ajalugu", label: "Ajalugu" },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <header className="mb-5">
          <h1 className="font-serif text-2xl text-stone-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-amber-700" /> Valmistamine
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Sisesta vesi ja kogused — valemid arvutavad tee, suhkru ja juuretise ise.
          </p>
        </header>

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

        {tab === "uus" && (
          <UusPruulimine
            teas={teas}
            sugars={sugars}
            authFetch={authFetch}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["brews"] });
              qc.invalidateQueries({ queryKey: ["brews-tea-stock"] });
              qc.invalidateQueries({ queryKey: ["brews-sugar-stock"] });
              flash("Pruulimine salvestatud");
            }}
          />
        )}
        {tab === "tee" && (
          <TeeVaru
            teas={teas}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["brews-tea-stock"] });
              flash("Tee varu uuendatud");
            }}
          />
        )}
        {tab === "suhkur" && (
          <SuhkruVaru
            sugars={sugars}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["brews-sugar-stock"] });
              flash("Suhkru varu uuendatud");
            }}
          />
        )}
        {tab === "ajalugu" && (
          <Ajalugu
            brews={brewsQ.data ?? []}
            teas={teas}
            sugars={sugars}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["brews"] });
              qc.invalidateQueries({ queryKey: ["brews-tea-stock"] });
              qc.invalidateQueries({ queryKey: ["brews-sugar-stock"] });
            }}
            flash={flash}
          />
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

type PortionForm = {
  boiledL: string;
  teaStockId: number | "";
  steepMin: string;
  steepHeat: string;
  coldEdited: boolean;
  coldWaterL: string;
};

const emptyPortion = (): PortionForm => ({
  boiledL: "",
  teaStockId: "",
  steepMin: "10",
  steepHeat: "0",
  coldEdited: false,
  coldWaterL: "",
});

function UusPruulimine({
  teas,
  sugars,
  authFetch,
  onSaved,
}: {
  teas: Tea[];
  sugars: Sugar[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [startBoilTime, setStartBoilTime] = useState("");
  const [tempReachedMin, setTempReachedMin] = useState("");
  const [temp, setTemp] = useState("");
  const [sugarStockId, setSugarStockId] = useState<number | "">("");
  const [coolStartTime, setCoolStartTime] = useState("");
  const [coolPlace, setCoolPlace] = useState("");
  const [coolTemp, setCoolTemp] = useState("");
  const [continuedTime, setContinuedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [starterPct, setStarterPct] = useState("20");
  const [electricityKwh, setElectricityKwh] = useState("");
  const [portions, setPortions] = useState<PortionForm[]>([emptyPortion()]);

  const pct = parseInt(starterPct) || 0;
  const portionCalcs = portions.map((p) => {
    const boiled = parseFloat(p.boiledL) || 0;
    const cold = p.coldEdited ? parseFloat(p.coldWaterL) || 0 : boiled;
    const totalL = boiled + cold;
    return {
      boiled,
      cold,
      totalL,
      teaG: boiled > 0 ? Math.round(boiled * 5 + 5) : 0,
      sugarG: Math.round(totalL * 80),
      starterG: Math.round(totalL * 10 * pct),
    };
  });
  const totalSugarG = portionCalcs.reduce((s, c) => s + c.sugarG, 0);
  const totalStarterG = portionCalcs.reduce((s, c) => s + c.starterG, 0);
  const isMulti = portions.length > 1;

  const updatePortion = <K extends keyof PortionForm>(i: number, key: K, val: PortionForm[K]) =>
    setPortions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));

  const addPortion = () => setPortions((prev) => [...prev, emptyPortion()]);
  const removePortion = (i: number) => setPortions((prev) => prev.filter((_, idx) => idx !== i));

  const formRef = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    e.preventDefault();
    const els = Array.from(
      formRef.current?.querySelectorAll<HTMLElement>("input, select, textarea") ?? []
    ).filter((el) => !(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly);
    const idx = els.indexOf(target);
    els[idx + 1]?.focus();
  };

  const m = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch("/brews", { method: "POST", body: JSON.stringify(body) });
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      setPortions([emptyPortion()]);
      setStartBoilTime("");
      setTempReachedMin("");
      setTemp("");
      setCoolStartTime("");
      setCoolPlace("");
      setCoolTemp("");
      setContinuedTime("");
      setNotes("");
      setElectricityKwh("");
    },
  });

  const save = () => {
    if (!sugarStockId) return;
    const portionsPayload = portions
      .map((p, i) => {
        const calc = portionCalcs[i];
        if (calc.boiled <= 0) return null;
        const tea = teas.find((t) => t.id === p.teaStockId);
        return {
          boiledL: calc.boiled,
          teaStockId: p.teaStockId || null,
          teaSort: tea?.name ?? "",
          teaG: calc.teaG,
          steepMin: parseInt(p.steepMin) || 0,
          steepHeat: parseInt(p.steepHeat) || 0,
          sugarG: calc.sugarG,
          coldWaterL: calc.cold,
          starterG: calc.starterG,
        };
      })
      .filter(Boolean);
    if (portionsPayload.length === 0) return;
    m.mutate({
      date,
      startBoilTime,
      tempReachedMin,
      temp,
      sugarStockId: sugarStockId || null,
      coolStartTime,
      coolPlace,
      coolTemp,
      continuedTime,
      notes,
      starterPct: pct,
      electricityKwh,
      portions: portionsPayload,
    });
  };

  return (
    <div className="space-y-5" ref={formRef} onKeyDown={onKey}>
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-900">Keetmine</h3>
          <button
            type="button"
            onClick={addPortion}
            className="text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            + lisa uus ports teed
          </button>
        </div>
        <Field label="Kuupäev">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alustasin keetmist kl">
            <input type="time" value={startBoilTime} onChange={(e) => setStartBoilTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Temp saavutas, min">
            <input type="number" value={tempReachedMin} onChange={(e) => setTempReachedMin(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Temp, °C">
          <input type="number" value={temp} onChange={(e) => setTemp(e.target.value)} className={inputCls} />
        </Field>

        {portions.map((p, i) => {
          const calc = portionCalcs[i];
          return (
            <div
              key={i}
              className={isMulti ? "rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-3" : "space-y-3"}
            >
              {isMulti && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800">Ports {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removePortion(i)}
                    className="text-xs text-stone-400 hover:text-red-600"
                  >
                    eemalda
                  </button>
                </div>
              )}
              <Field label="Vesi keema, L" hint={!isMulti ? "Sellest arvutatakse tee, suhkur ja juuretis." : undefined}>
                <input
                  type="number"
                  value={p.boiledL}
                  onChange={(e) => updatePortion(i, "boiledL", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Tee sort">
                <select
                  value={p.teaStockId}
                  onChange={(e) => updatePortion(i, "teaStockId", e.target.value ? Number(e.target.value) : "")}
                  className={inputCls}
                >
                  <option value="">— vali tee —</option>
                  {teas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.qtyG} g laos)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tee, g" hint="Arvutatud: L × 5 + 5">
                <input value={calc.teaG} readOnly className={calcCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min tõmbab">
                  <input
                    type="number"
                    value={p.steepMin}
                    onChange={(e) => updatePortion(i, "steepMin", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Tõmbamise kuumus">
                  <input
                    type="number"
                    value={p.steepHeat}
                    onChange={(e) => updatePortion(i, "steepHeat", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              {isMulti && calc.boiled > 0 && (
                <div className="text-xs text-amber-800 bg-amber-100 rounded px-3 py-1.5">
                  Suhkur: {calc.sugarG} g · Juuretis: {calc.starterG} g
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-stone-900">Suhkur ja vesi</h3>
        <Field label="Suhkru varu" hint={totalSugarG > 0 ? `Lahutatakse kokku: ${totalSugarG} g` : undefined}>
          <select
            value={sugarStockId}
            onChange={(e) => setSugarStockId(e.target.value ? Number(e.target.value) : "")}
            className={inputCls}
          >
            <option value="">— vali suhkur —</option>
            {sugars.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.qtyG} g laos)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Suhkur, g" hint="Arvutatud: kogu vedelik × 80">
          <input value={totalSugarG} readOnly className={calcCls} />
        </Field>
        {!isMulti && (
          <Field label="Külm vesi, L" hint="Vaikimisi sama mis keema läinud vesi, saad muuta.">
            <input
              type="number"
              value={portions[0].coldEdited ? portions[0].coldWaterL : portionCalcs[0]?.boiled || ""}
              onChange={(e) => {
                updatePortion(0, "coldEdited", true);
                updatePortion(0, "coldWaterL", e.target.value);
              }}
              className={inputCls}
            />
          </Field>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-stone-900">Jahtumine</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jahtuma kl">
            <input type="time" value={coolStartTime} onChange={(e) => setCoolStartTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Jahtumiskoha temp, °C">
            <input type="number" value={coolTemp} onChange={(e) => setCoolTemp(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Jahtumiskoht">
          <input
            value={coolPlace}
            onChange={(e) => setCoolPlace(e.target.value)}
            list="cool-places"
            className={inputCls}
            placeholder="nt sahver"
          />
          <datalist id="cool-places">
            <option value="sahver" />
            <option value="kelder" />
            <option value="köök" />
          </datalist>
        </Field>
        <Field label="Tegutsesin edasi kl">
          <input type="time" value={continuedTime} onChange={(e) => setContinuedTime(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-stone-900">Juuretis ja kulu</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Juuretise %">
            <input type="number" value={starterPct} onChange={(e) => setStarterPct(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Juuretis, g" hint="Arvutatud">
            <input value={totalStarterG} readOnly className={calcCls} />
          </Field>
        </div>
        <Field label="Elektrikulu, kW/h">
          <input type="number" value={electricityKwh} onChange={(e) => setElectricityKwh(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Soovitused">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </Field>
      </div>

      <a
        href={`${BASE_URL}/maitsestamine`}
        className="w-full rounded-lg border-2 border-dashed border-amber-400 py-3 text-amber-700 font-medium hover:bg-amber-50 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> lisa maitsestus
      </a>

      <button
        onClick={save}
        disabled={m.isPending || !portionCalcs.some((c) => c.boiled > 0) || !sugarStockId}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending
          ? "Salvestan…"
          : isMulti
          ? `Salvesta ${portions.filter((_, i) => portionCalcs[i].boiled > 0).length} portsi teed`
          : "Salvesta pruulimine"}
      </button>
    </div>
  );
}

function TeeVaru({
  teas,
  authFetch,
  onChange,
}: {
  teas: Tea[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [existing, setExisting] = useState<number | "">("");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"olemasolev" | "uus">("olemasolev");

  const mut = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch("/brews/tea-stock", { method: "POST", body: JSON.stringify(body) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setQty("");
      setName("");
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await authFetch(`/brews/tea-stock/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setEditingId(null);
      setRenameError(null);
    },
    onError: (err: Error) => {
      setRenameError(err.message);
    },
  });

  const startEdit = (t: Tea) => {
    setEditingId(t.id);
    setEditName(t.name);
    setRenameError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setRenameError(null);
  };

  const saveEdit = (id: number) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    renameMut.mutate({ id, name: trimmed });
  };

  const add = () => {
    const q = parseInt(qty) || 0;
    if (mode === "olemasolev") {
      const t = teas.find((x) => x.id === existing);
      if (!t) return;
      mut.mutate({ name: t.name, qtyG: q });
    } else {
      if (!name.trim()) return;
      mut.mutate({ name: name.trim(), qtyG: q });
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg text-stone-900">Lisa teed lattu</h3>
        <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
          {(["olemasolev", "uus"] as const).map((mm) => (
            <button
              key={mm}
              type="button"
              onClick={() => setMode(mm)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                mode === mm ? "bg-amber-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-200"
              }`}
            >
              {mm === "olemasolev" ? "Olemasolev sort" : "Uus sort"}
            </button>
          ))}
        </div>
        {mode === "olemasolev" ? (
          <select
            value={existing}
            onChange={(e) => setExisting(e.target.value ? Number(e.target.value) : "")}
            className={inputCls}
          >
            <option value="">— vali sort —</option>
            {teas.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nt roheline Mozum"
            className={inputCls}
          />
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="grammid"
            className={inputCls}
          />
          <button
            type="button"
            onClick={add}
            disabled={mut.isPending}
            className="rounded-lg bg-amber-700 px-4 text-white shrink-0 disabled:opacity-50"
          >
            Lisa
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Tee sort</th>
              <th className="px-4 py-2 font-medium text-right">Grammid</th>
            </tr>
          </thead>
          <tbody>
            {teas.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-stone-400" colSpan={3}>Ühtegi sorti pole veel lisatud.</td>
              </tr>
            ) : (
              teas.map((t) => (
                <tr key={t.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">
                    {editingId === t.id ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => { setEditName(e.target.value); setRenameError(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(t.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="flex-1 rounded border border-amber-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-600"
                          />
                          <button
                            onClick={() => saveEdit(t.id)}
                            disabled={renameMut.isPending}
                            className="p-1 text-green-700 hover:text-green-900 disabled:opacity-50"
                            title="Salvesta"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-stone-400 hover:text-stone-700"
                            title="Tühista"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {renameError && (
                          <p className="text-xs text-red-600">{renameError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span>{t.name}</span>
                        <button
                          onClick={() => startEdit(t)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-amber-700 transition-opacity"
                          title="Muuda nime"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${t.qtyG <= 0 ? "text-red-600" : ""}`}>
                    {t.qtyG} g
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuhkruVaru({
  sugars,
  authFetch,
  onChange,
}: {
  sugars: Sugar[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [existing, setExisting] = useState<number | "">("");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"olemasolev" | "uus">("olemasolev");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const addMut = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch("/brews/sugar-stock", { method: "POST", body: JSON.stringify(body) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setQty("");
      setName("");
    },
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await authFetch(`/brews/sugar-stock/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setRenamingId(null);
      setRenameVal("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/brews/sugar-stock/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: onChange,
  });

  const add = () => {
    const q = parseInt(qty) || 0;
    if (mode === "olemasolev") {
      const s = sugars.find((x) => x.id === existing);
      if (!s) return;
      addMut.mutate({ name: s.name, qtyG: q });
    } else {
      if (!name.trim()) return;
      addMut.mutate({ name: name.trim(), qtyG: q });
    }
  };

  const startRename = (s: Sugar) => {
    setRenamingId(s.id);
    setRenameVal(s.name);
  };

  const confirmRename = (id: number) => {
    if (!renameVal.trim()) return;
    renameMut.mutate({ id, name: renameVal.trim() });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg text-stone-900">Lisa suhkrut lattu</h3>
        <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
          {(["olemasolev", "uus"] as const).map((mm) => (
            <button
              key={mm}
              type="button"
              onClick={() => setMode(mm)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                mode === mm ? "bg-amber-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-200"
              }`}
            >
              {mm === "olemasolev" ? "Olemasolev" : "Uus"}
            </button>
          ))}
        </div>
        {mode === "olemasolev" ? (
          <select
            value={existing}
            onChange={(e) => setExisting(e.target.value ? Number(e.target.value) : "")}
            className={inputCls}
          >
            <option value="">— vali suhkur —</option>
            {sugars.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nt valge suhkur"
            className={inputCls}
          />
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="grammid"
            className={inputCls}
          />
          <button
            type="button"
            onClick={add}
            disabled={addMut.isPending}
            className="rounded-lg bg-amber-700 px-4 text-white shrink-0 disabled:opacity-50"
          >
            Lisa
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nimi</th>
              <th className="px-4 py-2 font-medium text-right">Grammid</th>
              <th className="px-4 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {sugars.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-stone-400" colSpan={3}>Ühtegi suhkrut pole veel lisatud.</td>
              </tr>
            ) : (
              sugars.map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">
                    {renamingId === s.id ? (
                      <div className="flex gap-1">
                        <input
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename(s.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="rounded border border-stone-300 px-2 py-1 text-sm w-full focus:border-amber-600 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => confirmRename(s.id)}
                          disabled={renameMut.isPending}
                          className="text-amber-700 text-xs shrink-0 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="text-stone-400 text-xs shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRename(s)}
                        className="text-left hover:text-amber-700 transition"
                        title="Klõpsa nimele ümbernimetamiseks"
                      >
                        {s.name}
                      </button>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${s.qtyG <= 0 ? "text-red-600" : ""}`}>
                    {s.qtyG} g
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => deleteMut.mutate(s.id)}
                      disabled={deleteMut.isPending}
                      className="text-stone-400 hover:text-red-600 text-xs disabled:opacity-50"
                    >
                      kustuta
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Ajalugu({
  brews,
  teas,
  sugars,
  authFetch,
  onChange,
  flash,
}: {
  brews: Brew[];
  teas: Tea[];
  sugars: Sugar[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const sessionCounts = new Map<number, number>();
  brews.forEach((b) => {
    if (b.sessionId != null) {
      sessionCounts.set(b.sessionId, (sessionCounts.get(b.sessionId) ?? 0) + 1);
    }
  });

  if (brews.length === 0) {
    return <p className="text-sm text-stone-400">Veel ühtegi pruulimist pole.</p>;
  }

  return (
    <div className="space-y-2">
      {brews.map((b) => (
        <BrewCard
          key={b.id}
          brew={b}
          teas={teas}
          sugars={sugars}
          authFetch={authFetch}
          editOpen={editingId === b.id}
          onOpenEdit={() => setEditingId(b.id)}
          onCloseEdit={() => setEditingId(null)}
          onChange={onChange}
          flash={flash}
          sessionCount={b.sessionId != null ? (sessionCounts.get(b.sessionId) ?? 1) : 1}
        />
      ))}
    </div>
  );
}

function BrewCard({
  brew,
  teas,
  sugars,
  authFetch,
  editOpen,
  onOpenEdit,
  onCloseEdit,
  onChange,
  flash,
  sessionCount,
}: {
  brew: Brew;
  teas: Tea[];
  sugars: Sugar[];
  authFetch: ReturnType<typeof useAuthFetch>;
  editOpen: boolean;
  onOpenEdit: () => void;
  onCloseEdit: () => void;
  onChange: () => void;
  flash: (msg: string) => void;
  sessionCount: number;
}) {
  const [date, setDate] = useState(brew.date);
  const [boiledL, setBoiledL] = useState(String(brew.boiledL));
  const [startBoilTime, setStartBoilTime] = useState(brew.startBoilTime ?? "");
  const [tempReachedMin, setTempReachedMin] = useState(brew.tempReachedMin != null ? String(brew.tempReachedMin) : "");
  const [temp, setTemp] = useState(brew.temp != null ? String(brew.temp) : "");
  const [teaStockId, setTeaStockId] = useState<number | "">(brew.teaStockId ?? "");
  const [steepMin, setSteepMin] = useState(String(brew.steepMin ?? 10));
  const [steepHeat, setSteepHeat] = useState(String(brew.steepHeat ?? 0));
  const [coldWaterL, setColdWaterL] = useState(String(brew.coldWaterL));
  const [coolStartTime, setCoolStartTime] = useState(brew.coolStartTime ?? "");
  const [coolPlace, setCoolPlace] = useState(brew.coolPlace ?? "");
  const [coolTemp, setCoolTemp] = useState(brew.coolTemp != null ? String(brew.coolTemp) : "");
  const [continuedTime, setContinuedTime] = useState(brew.continuedTime ?? "");
  const [notes, setNotes] = useState(brew.notes ?? "");
  const [starterPct, setStarterPct] = useState(String(brew.starterPct ?? 20));
  const [electricityKwh, setElectricityKwh] = useState(brew.electricityKwh != null ? String(brew.electricityKwh) : "");

  const openEdit = () => {
    setDate(brew.date);
    setBoiledL(String(brew.boiledL));
    setStartBoilTime(brew.startBoilTime ?? "");
    setTempReachedMin(brew.tempReachedMin != null ? String(brew.tempReachedMin) : "");
    setTemp(brew.temp != null ? String(brew.temp) : "");
    setTeaStockId(brew.teaStockId ?? "");
    setSteepMin(String(brew.steepMin ?? 10));
    setSteepHeat(String(brew.steepHeat ?? 0));
    setColdWaterL(String(brew.coldWaterL));
    setCoolStartTime(brew.coolStartTime ?? "");
    setCoolPlace(brew.coolPlace ?? "");
    setCoolTemp(brew.coolTemp != null ? String(brew.coolTemp) : "");
    setContinuedTime(brew.continuedTime ?? "");
    setNotes(brew.notes ?? "");
    setStarterPct(String(brew.starterPct ?? 20));
    setElectricityKwh(brew.electricityKwh != null ? String(brew.electricityKwh) : "");
    onOpenEdit();
  };

  const boiled = parseFloat(boiledL) || 0;
  const cold = parseFloat(coldWaterL) || 0;
  const totalL = boiled + cold;
  const teaG = boiled > 0 ? Math.round(boiled * 5 + 5) : 0;
  const sugarG = Math.round(totalL * 80);
  const pct = parseInt(starterPct) || 0;
  const starterG = Math.round(totalL * 10 * pct);

  const delMut = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/brews/${brew.id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Pruulimine kustutatud");
    },
  });

  const patchMut = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch(`/brews/${brew.id}`, { method: "PATCH", body: JSON.stringify(body) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Pruulimine salvestatud");
      onCloseEdit();
    },
  });

  const save = () => {
    if (boiled <= 0) return;
    const tea = teas.find((t) => t.id === teaStockId);
    patchMut.mutate({
      date,
      boiledL: boiled,
      startBoilTime,
      tempReachedMin,
      temp,
      teaStockId: teaStockId || null,
      teaSort: tea?.name ?? brew.teaSort ?? "",
      teaG,
      steepMin,
      steepHeat,
      sugarG,
      coldWaterL: cold,
      coolStartTime,
      coolPlace,
      coolTemp,
      continuedTime,
      notes,
      starterPct: pct,
      starterG,
      electricityKwh,
    });
  };

  return (
    <div className={`rounded-xl border bg-white ${editOpen ? "border-amber-300" : "border-stone-200"}`}>
      <div className="flex items-start justify-between px-4 py-3">
        <div>
          <div className="text-sm font-medium flex flex-wrap items-center gap-1.5">
            <span>{new Date(brew.date).toLocaleDateString("et-EE")} · {brew.boiledL + (brew.coldWaterL ?? brew.boiledL)} L · {brew.teaSort || "tee märkimata"}</span>
            {sessionCount > 1 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700">{sessionCount} ports ühel päeval</span>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            Tee {brew.teaG} g · suhkur {brew.sugarG} g · juuretis {brew.starterG} g
            {brew.electricityKwh != null ? ` · ${brew.electricityKwh} kW/h` : ""}
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          {!editOpen && (
            <button
              onClick={openEdit}
              className="text-stone-400 hover:text-amber-700 text-xs"
            >
              muuda
            </button>
          )}
          <button
            onClick={() => delMut.mutate()}
            disabled={delMut.isPending}
            className="text-stone-400 hover:text-red-600 text-xs disabled:opacity-50"
          >
            kustuta
          </button>
        </div>
      </div>

      {editOpen && (
        <div className="border-t border-amber-200 px-4 pb-5 pt-4 space-y-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
            <h3 className="font-serif text-base text-stone-900">Keetmine</h3>
            <Field label="Kuupäev">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Vesi keema, L" hint="Sellest arvutatakse tee, suhkur ja juuretis.">
              <input type="number" value={boiledL} onChange={(e) => setBoiledL(e.target.value)} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Alustasin keetmist kl">
                <input type="time" value={startBoilTime} onChange={(e) => setStartBoilTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Temp saavutas, min">
                <input type="number" value={tempReachedMin} onChange={(e) => setTempReachedMin(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Temp, °C">
              <input type="number" value={temp} onChange={(e) => setTemp(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Tee sort">
              <select
                value={teaStockId}
                onChange={(e) => setTeaStockId(e.target.value ? Number(e.target.value) : "")}
                className={inputCls}
              >
                <option value="">— vali tee —</option>
                {teas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.qtyG} g laos)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tee, g" hint="Arvutatud: L × 5 + 5">
              <input value={teaG} readOnly className={calcCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min tõmbab">
                <input type="number" value={steepMin} onChange={(e) => setSteepMin(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Tõmbamise kuumus">
                <input type="number" value={steepHeat} onChange={(e) => setSteepHeat(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
            <h3 className="font-serif text-base text-stone-900">Suhkur ja vesi</h3>
            <Field label="Suhkur, g" hint="Arvutatud: kogu vedelik × 80">
              <input value={sugarG} readOnly className={calcCls} />
            </Field>
            <Field label="Külm vesi, L">
              <input type="number" value={coldWaterL} onChange={(e) => setColdWaterL(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
            <h3 className="font-serif text-base text-stone-900">Jahtumine</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jahtuma kl">
                <input type="time" value={coolStartTime} onChange={(e) => setCoolStartTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Jahtumiskoha temp, °C">
                <input type="number" value={coolTemp} onChange={(e) => setCoolTemp(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Jahtumiskoht">
              <input
                value={coolPlace}
                onChange={(e) => setCoolPlace(e.target.value)}
                list="edit-cool-places"
                className={inputCls}
                placeholder="nt sahver"
              />
              <datalist id="edit-cool-places">
                <option value="sahver" />
                <option value="kelder" />
                <option value="köök" />
              </datalist>
            </Field>
            <Field label="Tegutsesin edasi kl">
              <input type="time" value={continuedTime} onChange={(e) => setContinuedTime(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
            <h3 className="font-serif text-base text-stone-900">Juuretis ja kulu</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Juuretise %">
                <input type="number" value={starterPct} onChange={(e) => setStarterPct(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Juuretis, g" hint="Arvutatud">
                <input value={starterG} readOnly className={calcCls} />
              </Field>
            </div>
            <Field label="Elektrikulu, kW/h">
              <input type="number" value={electricityKwh} onChange={(e) => setElectricityKwh(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Soovitused">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
            </Field>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={patchMut.isPending || boiled <= 0}
              className="flex-1 rounded-lg bg-amber-700 py-2.5 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
            >
              {patchMut.isPending ? "Salvestan…" : "Salvesta muutused"}
            </button>
            <button
              onClick={onCloseEdit}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              Tühista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
