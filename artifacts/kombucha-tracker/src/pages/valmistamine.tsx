import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { FlaskConical } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tea = { id: number; name: string; qtyG: number };
type Brew = {
  id: number;
  date: string;
  boiledL: number;
  teaSort: string;
  teaG: number;
  sugarG: number;
  starterG: number;
  electricityKwh: number | null;
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

  const brewsQ = useQuery<Brew[]>({
    queryKey: ["brews"],
    queryFn: async () => {
      const res = await authFetch("/brews");
      return res.json();
    },
  });

  const teas = teaQ.data ?? [];

  const tabs = [
    { id: "uus", label: "Uus pruulimine" },
    { id: "tee", label: "Tee varu" },
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
            authFetch={authFetch}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["brews"] });
              qc.invalidateQueries({ queryKey: ["brews-tea-stock"] });
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
        {tab === "ajalugu" && (
          <Ajalugu
            brews={brewsQ.data ?? []}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["brews"] });
              qc.invalidateQueries({ queryKey: ["brews-tea-stock"] });
              flash("Pruulimine kustutatud");
            }}
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

function UusPruulimine({
  teas,
  authFetch,
  onSaved,
}: {
  teas: Tea[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [boiledL, setBoiledL] = useState("");
  const [startBoilTime, setStartBoilTime] = useState("");
  const [tempReachedMin, setTempReachedMin] = useState("");
  const [temp, setTemp] = useState("");
  const [teaStockId, setTeaStockId] = useState<number | "">("");
  const [steepMin, setSteepMin] = useState("10");
  const [steepHeat, setSteepHeat] = useState("0");
  const [coldEdited, setColdEdited] = useState(false);
  const [coldWaterL, setColdWaterL] = useState("");
  const [coolStartTime, setCoolStartTime] = useState("");
  const [coolPlace, setCoolPlace] = useState("");
  const [coolTemp, setCoolTemp] = useState("");
  const [continuedTime, setContinuedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [starterPct, setStarterPct] = useState("20");
  const [electricityKwh, setElectricityKwh] = useState("");

  const boiled = parseFloat(boiledL) || 0;
  const cold = coldEdited ? parseFloat(coldWaterL) || 0 : boiled;
  const totalL = boiled + cold;
  const teaG = boiled > 0 ? Math.round(boiled * 5 + 5) : 0;
  const sugarG = Math.round(totalL * 80);
  const pct = parseInt(starterPct) || 0;
  const starterG = Math.round(totalL * 10 * pct);

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
      setBoiledL("");
      setStartBoilTime("");
      setTempReachedMin("");
      setTemp("");
      setColdEdited(false);
      setColdWaterL("");
      setCoolStartTime("");
      setCoolPlace("");
      setCoolTemp("");
      setContinuedTime("");
      setNotes("");
      setElectricityKwh("");
    },
  });

  const save = () => {
    if (boiled <= 0) return;
    const tea = teas.find((t) => t.id === teaStockId);
    m.mutate({
      date,
      boiledL: boiled,
      startBoilTime,
      tempReachedMin,
      temp,
      teaStockId: teaStockId || null,
      teaSort: tea?.name ?? "",
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
    <div className="space-y-5" ref={formRef} onKeyDown={onKey}>
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-stone-900">Keetmine</h3>
        <Field label="Kuupäev">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Vesi keema, L" hint="Sellest arvutatakse tee, suhkur ja juuretis.">
          <input
            type="number"
            value={boiledL}
            onChange={(e) => setBoiledL(e.target.value)}
            className={inputCls}
          />
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

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-stone-900">Suhkur ja vesi</h3>
        <Field label="Suhkur, g" hint="Arvutatud: kogu vedelik × 80">
          <input value={sugarG} readOnly className={calcCls} />
        </Field>
        <Field label="Külm vesi, L" hint="Vaikimisi sama mis keema läinud vesi, saad muuta.">
          <input
            type="number"
            value={coldEdited ? coldWaterL : boiled || ""}
            onChange={(e) => {
              setColdEdited(true);
              setColdWaterL(e.target.value);
            }}
            className={inputCls}
          />
        </Field>
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

      <button
        onClick={save}
        disabled={m.isPending || boiled <= 0}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Salvesta pruulimine"}
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
                <td className="px-4 py-3 text-stone-400" colSpan={2}>Ühtegi sorti pole veel lisatud.</td>
              </tr>
            ) : (
              teas.map((t) => (
                <tr key={t.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">{t.name}</td>
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

function Ajalugu({
  brews,
  authFetch,
  onChange,
}: {
  brews: Brew[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
}) {
  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/brews/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: onChange,
  });

  if (brews.length === 0) {
    return <p className="text-sm text-stone-400">Veel ühtegi pruulimist pole.</p>;
  }

  return (
    <div className="space-y-2">
      {brews.map((b) => (
        <div key={b.id} className="flex items-start justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div>
            <div className="text-sm font-medium">
              {new Date(b.date).toLocaleDateString("et-EE")} · {b.boiledL} L · {b.teaSort || "tee märkimata"}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              Tee {b.teaG} g · suhkur {b.sugarG} g · juuretis {b.starterG} g
              {b.electricityKwh != null ? ` · ${b.electricityKwh} kW/h` : ""}
            </div>
          </div>
          <button
            onClick={() => del.mutate(b.id)}
            disabled={del.isPending}
            className="text-stone-400 hover:text-red-600 text-xs shrink-0 disabled:opacity-50"
          >
            kustuta
          </button>
        </div>
      ))}
    </div>
  );
}
