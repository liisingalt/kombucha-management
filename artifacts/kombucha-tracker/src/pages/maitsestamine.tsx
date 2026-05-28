import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Leaf } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Variant = { id: number; name: string; olek: string; paritolu: string; coefficient: number; qtyG: number };
type Method = { id: number; name: string };
type Ferm = { id: number; teaSort: string; startDate: string; brewId: number | null };
type BrewMin = { id: number; date: string; sessionId: number | null };
type EventBlock = {
  name: string; olek: string; paritolu: string;
  koguseL: number; vesselL: number; method: string;
  coefficient: number; gramsUsed: number; place: string; temp: number | null;
};
type FlavEvent = {
  id: number; date: string; bottlingDate: string | null;
  bottleFermentNote: string; notes: string; blocks: EventBlock[];
  fermentationBatchId: number | null;
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600";
const round2 = (n: number) => Math.round(n * 100) / 100;

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

function days(a?: string, b?: string | null) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

const variantLabel = (v: Variant) =>
  `${v.name}${v.olek ? " · " + v.olek : ""}${v.paritolu ? " · " + v.paritolu : ""} (${v.qtyG} g)`;

export default function MaitsestaminePage() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  const [tab, setTab] = useState("uus");
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const flash = (msg: string) => {
    setToast({ msg, isError: false });
    setTimeout(() => setToast(null), 2600);
  };

  const flashError = (msg: string) => {
    setToast({ msg, isError: true });
    setTimeout(() => setToast(null), 3500);
  };

  const stockQ = useQuery<Variant[]>({
    queryKey: ["flavoring-stock"],
    queryFn: async () => {
      const res = await authFetch("/flavoring/stock");
      return res.json();
    },
  });
  const methodsQ = useQuery<Method[]>({
    queryKey: ["flavoring-methods"],
    queryFn: async () => {
      const res = await authFetch("/flavoring/methods");
      return res.json();
    },
  });
  const fermQ = useQuery<Ferm[]>({
    queryKey: ["fermentations"],
    queryFn: async () => {
      const res = await authFetch("/fermentations");
      return res.json();
    },
  });
  const eventsQ = useQuery<FlavEvent[]>({
    queryKey: ["flavoring-events"],
    queryFn: async () => {
      const res = await authFetch("/flavoring/events");
      return res.json();
    },
  });
  const brewsQ = useQuery<BrewMin[]>({
    queryKey: ["brews"],
    queryFn: async () => {
      const res = await authFetch("/brews");
      return res.json();
    },
  });

  const stock = stockQ.data ?? [];
  const methods = methodsQ.data ?? [];

  const tabs = [
    { id: "uus", label: "Uus maitsestamine" },
    { id: "ladu", label: "Maitsestuse ladu" },
    { id: "viisid", label: "Töötlusviisid" },
    { id: "ajalugu", label: "Ajalugu" },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <header className="mb-5">
          <h1 className="font-serif text-2xl text-stone-900 flex items-center gap-2">
            <Leaf className="w-6 h-6 text-amber-700" /> Maitsestamine
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Märgi, mis maitsestust ja kui palju kasutasid. Grammid arvutatakse ja arvatakse laost maha.
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
          <UusMaitsestamine
            stock={stock}
            methods={methods}
            ferms={fermQ.data ?? []}
            authFetch={authFetch}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["flavoring-events"] });
              qc.invalidateQueries({ queryKey: ["flavoring-stock"] });
              qc.invalidateQueries({ queryKey: ["fermentations"] });
              flash("Maitsestamine salvestatud");
            }}
            onError={flashError}
          />
        )}
        {tab === "ladu" && (
          <MaitsestuseLadu
            stock={stock}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["flavoring-stock"] });
            }}
            flash={flash}
            flashError={flashError}
          />
        )}
        {tab === "viisid" && (
          <Tootlusviisid
            methods={methods}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["flavoring-methods"] });
            }}
            flash={flash}
            flashError={flashError}
          />
        )}
        {tab === "ajalugu" && (
          <Ajalugu
            events={eventsQ.data ?? []}
            ferms={fermQ.data ?? []}
            brews={brewsQ.data ?? []}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["flavoring-events"] });
              qc.invalidateQueries({ queryKey: ["flavoring-stock"] });
              flash("Maitsestamine kustutatud");
            }}
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

type BlockForm = {
  stockId: string; koguseL: string; vesselL: string; method: string;
  coefficient: string; grams: string; gEdited: boolean; place: string; temp: string;
};
const emptyBlock = (): BlockForm => ({
  stockId: "", koguseL: "", vesselL: "", method: "", coefficient: "1.3", grams: "", gEdited: false, place: "", temp: "",
});

function UusMaitsestamine({
  stock,
  methods,
  ferms,
  authFetch,
  onSaved,
  onError,
}: {
  stock: Variant[];
  methods: Method[];
  ferms: Ferm[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [fermId, setFermId] = useState<number | "">("");
  const [bottlingDate, setBottlingDate] = useState("");
  const [bottleNote, setBottleNote] = useState("");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<BlockForm[]>([emptyBlock()]);

  const isDirty =
    date !== today ||
    fermId !== "" ||
    bottlingDate !== "" ||
    bottleNote !== "" ||
    notes !== "" ||
    blocks.some(
      (b) =>
        b.stockId !== "" ||
        b.koguseL !== "" ||
        b.vesselL !== "" ||
        b.method !== "" ||
        b.coefficient !== "1.3" ||
        b.grams !== "" ||
        b.place !== "" ||
        b.temp !== ""
    );
  useUnsavedChanges(isDirty);

  const recompute = (b: BlockForm): BlockForm => {
    if (b.gEdited) return b;
    const L = parseFloat(b.koguseL) || 0;
    const c = parseFloat(b.coefficient) || 0;
    return { ...b, grams: L > 0 ? String(round2(L * c)) : "" };
  };

  const update = (i: number, patch: Partial<BlockForm>) =>
    setBlocks((arr) => arr.map((b, idx) => (idx === i ? recompute({ ...b, ...patch }) : b)));

  const pickVariant = (i: number, stockId: string) => {
    const v = stock.find((x) => x.id === Number(stockId));
    update(i, { stockId, coefficient: v ? String(v.coefficient) : blocks[i].coefficient });
  };

  const addBlock = () => setBlocks((a) => [...a, emptyBlock()]);
  const removeBlock = (i: number) => setBlocks((a) => a.filter((_, idx) => idx !== i));

  const d = days(date, bottlingDate);

  const m = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch("/flavoring/events", { method: "POST", body: JSON.stringify(body) });
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      setBlocks([emptyBlock()]);
      setBottlingDate("");
      setBottleNote("");
      setNotes("");
      setFermId("");
    },
    onError: (err: Error) => onError(err.message || "Salvestamine ebaõnnestus"),
  });

  const save = () => {
    if (!date) return;
    const out = blocks
      .filter((b) => b.stockId || b.koguseL)
      .map((b) => {
        const v = stock.find((x) => x.id === Number(b.stockId));
        return {
          name: v?.name ?? "",
          olek: v?.olek ?? "",
          paritolu: v?.paritolu ?? "",
          flavoringStockId: v?.id ?? null,
          koguseL: parseFloat(b.koguseL) || 0,
          vesselL: parseFloat(b.vesselL) || 0,
          method: b.method,
          coefficient: parseFloat(b.coefficient) || 0,
          gramsUsed: parseFloat(b.grams) || 0,
          place: b.place,
          temp: b.temp === "" ? null : Number(b.temp),
        };
      });
    m.mutate({
      date,
      fermentationBatchId: fermId || null,
      bottlingDate: bottlingDate || null,
      bottleFermentNote: bottleNote,
      notes,
      blocks: out,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitsestamise kuupäev</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Seo käärimisega</label>
            <select
              value={fermId}
              onChange={(e) => setFermId(e.target.value ? Number(e.target.value) : "")}
              className={inputCls}
            >
              <option value="">— valikuline —</option>
              {ferms.map((f) => (
                <option key={f.id} value={f.id}>
                  {new Date(f.startDate).toLocaleDateString("et-EE")} · {f.teaSort || "tee märkimata"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-stone-400">
          Kui seod käärimisega, läheb see kuupäev käärimise kirjele käärimise lõpuks.
        </p>
      </div>

      <datalist id="flavor-methods">
        {methods.map((mm) => <option key={mm.id} value={mm.name} />)}
      </datalist>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-900">Maitsestused</h3>
          <button
            type="button"
            onClick={addBlock}
            className="text-sm text-amber-700 hover:text-amber-900"
          >
            + lisa maitsestus
          </button>
        </div>

        {blocks.map((b, i) => {
          const v = stock.find((x) => x.id === Number(b.stockId));
          return (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Maitsestus</label>
                <select
                  value={b.stockId}
                  onChange={(e) => pickVariant(i, e.target.value)}
                  className={inputCls}
                >
                  <option value="">— vali maitsestus —</option>
                  {stock.map((x) => (
                    <option key={x.id} value={x.id}>{variantLabel(x)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Kombucha, L</label>
                  <input
                    type="number"
                    value={b.koguseL}
                    onChange={(e) => update(i, { koguseL: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Nõu maht, L</label>
                  <input
                    type="number"
                    value={b.vesselL}
                    onChange={(e) => update(i, { vesselL: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Koefitsient (g/L)</label>
                  <input
                    type="number"
                    value={b.coefficient}
                    onChange={(e) => update(i, { coefficient: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Kogus, g</label>
                  <input
                    type="number"
                    value={b.grams}
                    onChange={(e) =>
                      setBlocks((arr) =>
                        arr.map((x, idx) =>
                          idx === i ? { ...x, grams: e.target.value, gEdited: true } : x
                        )
                      )
                    }
                    className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Töötlusviis</label>
                <input
                  value={b.method}
                  onChange={(e) => update(i, { method: e.target.value })}
                  list="flavor-methods"
                  className={inputCls}
                  placeholder="nt purustamine"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Käärimiskoht</label>
                  <input
                    value={b.place}
                    onChange={(e) => update(i, { place: e.target.value })}
                    className={inputCls}
                    placeholder="nt köögis kapi peal"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Temp, °C</label>
                  <input
                    type="number"
                    value={b.temp}
                    onChange={(e) => update(i, { temp: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              {v && v.qtyG < (parseFloat(b.grams) || 0) && (
                <p className="text-xs text-red-600">
                  Laos on {v.qtyG} g, kasutad {b.grams} g. Laoseis läheb miinusesse.
                </p>
              )}
              {blocks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  className="text-xs text-stone-400 hover:text-red-600"
                >
                  eemalda maitsestus
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Villimise aeg</label>
            <input
              type="date"
              value={bottlingDate}
              onChange={(e) => setBottlingDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Käärimise aeg (2F)</label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium">
              {d != null ? `${d} päeva` : "—"}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Lisakääritus pudelis soojas</label>
          <input value={bottleNote} onChange={(e) => setBottleNote(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Soovitused</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={addBlock}
        className="w-full rounded-lg border-2 border-dashed border-amber-400 py-3 text-amber-700 font-medium hover:bg-amber-50 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> lisa maitsestus
      </button>

      <button
        onClick={save}
        disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Salvesta maitsestamine"}
      </button>
    </div>
  );
}

function MaitsestuseLadu({
  stock,
  authFetch,
  onChange,
  flash,
  flashError,
}: {
  stock: Variant[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
  flashError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [olek, setOlek] = useState("kuivatatud");
  const [paritolu, setParitolu] = useState("");
  const [coefficient, setCoefficient] = useState("1.3");
  const [qtyG, setQtyG] = useState("");

  const addM = useMutation({
    mutationFn: async (b: unknown) => {
      const res = await authFetch("/flavoring/stock", { method: "POST", body: JSON.stringify(b) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setName("");
      setParitolu("");
      setQtyG("");
      flash("Maitsestus lisatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg text-stone-900">Lisa maitsestus lattu</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nt leedrimari"
          className={inputCls}
        />
        <div className="grid grid-cols-2 gap-3">
          <select value={olek} onChange={(e) => setOlek(e.target.value)} className={inputCls}>
            <option value="kuivatatud">kuivatatud</option>
            <option value="sügavkülmutatud">sügavkülmutatud</option>
            <option value="värske">värske</option>
          </select>
          <input
            value={paritolu}
            onChange={(e) => setParitolu(e.target.value)}
            placeholder="päritolu, nt IdeaFarm"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Koefitsient (g/L)</label>
            <input
              type="number"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Algkogus, g</label>
            <input
              type="number"
              value={qtyG}
              onChange={(e) => setQtyG(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => name.trim() && addM.mutate({ name, olek, paritolu, coefficient, qtyG })}
          disabled={addM.isPending}
          className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
        >
          Lisa
        </button>
      </div>

      <div className="space-y-2">
        {stock.length === 0 ? (
          <p className="text-sm text-stone-400">Ühtegi maitsestust pole veel lisatud.</p>
        ) : (
          stock.map((v) => (
            <StockRow key={v.id} v={v} authFetch={authFetch} onChange={onChange} flash={flash} flashError={flashError} />
          ))
        )}
      </div>
    </div>
  );
}

function StockRow({
  v,
  authFetch,
  onChange,
  flash,
  flashError,
}: {
  v: Variant;
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
  flashError: (msg: string) => void;
}) {
  const [coef, setCoef] = useState(String(v.coefficient));
  const [add, setAdd] = useState("");

  const patch = useMutation({
    mutationFn: async (b: unknown) => {
      const res = await authFetch(`/flavoring/stock/${v.id}`, { method: "PATCH", body: JSON.stringify(b) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Koefitsient uuendatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const topup = useMutation({
    mutationFn: async (b: unknown) => {
      const res = await authFetch(`/flavoring/stock/${v.id}/add`, { method: "POST", body: JSON.stringify(b) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setAdd("");
      flash("Grammid lisatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/flavoring/stock/${v.id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Maitsestus eemaldatud");
    },
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-stone-900">{v.name}</div>
          <div className="text-xs text-stone-500">{[v.olek, v.paritolu].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="text-right">
          <div className={`font-semibold ${v.qtyG <= 0 ? "text-red-600" : "text-stone-900"}`}>{v.qtyG} g</div>
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            kustuta
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Koefitsient</label>
            <input
              type="number"
              value={coef}
              onChange={(e) => setCoef(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => patch.mutate({ coefficient: coef })}
            disabled={patch.isPending}
            className="rounded-lg bg-stone-700 px-3 py-2 text-white text-sm disabled:opacity-50"
          >
            Salvesta
          </button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Lisa grammid</label>
            <input
              type="number"
              value={add}
              onChange={(e) => setAdd(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => add && topup.mutate({ qtyG: Number(add) })}
            disabled={topup.isPending}
            className="rounded-lg bg-amber-700 px-3 py-2 text-white text-sm disabled:opacity-50"
          >
            Lisa
          </button>
        </div>
      </div>
    </div>
  );
}

function Tootlusviisid({
  methods,
  authFetch,
  onChange,
  flash,
  flashError,
}: {
  methods: Method[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
  flashError: (msg: string) => void;
}) {
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async (b: unknown) => {
      const res = await authFetch("/flavoring/methods", { method: "POST", body: JSON.stringify(b) });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      setName("");
      flash("Töötlusviis lisatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/flavoring/methods/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Töötlusviis eemaldatud");
    },
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg text-stone-900">Lisa töötlusviis</h3>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nt sulatasin kuuma veega ja muljusin käega"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => name.trim() && add.mutate({ name })}
            disabled={add.isPending}
            className="rounded-lg bg-amber-700 px-4 text-white shrink-0 disabled:opacity-50"
          >
            Lisa
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {methods.length === 0 ? (
          <p className="px-4 py-3 text-sm text-stone-400">Ühtegi viisi pole veel lisatud.</p>
        ) : (
          methods.map((mm) => (
            <div
              key={mm.id}
              className="flex items-center justify-between px-4 py-2 border-b border-stone-100 last:border-0"
            >
              <span className="text-sm">{mm.name}</span>
              <button
                type="button"
                onClick={() => del.mutate(mm.id)}
                disabled={del.isPending}
                className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
              >
                kustuta
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Ajalugu({
  events,
  ferms,
  brews,
  authFetch,
  onChange,
  flashError,
}: {
  events: FlavEvent[];
  ferms: Ferm[];
  brews: BrewMin[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flashError: (msg: string) => void;
}) {
  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/flavoring/events/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: onChange,
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  if (events.length === 0) {
    return <p className="text-sm text-stone-400">Veel ühtegi maitsestamist pole.</p>;
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => {
        const ferm = ev.fermentationBatchId != null ? ferms.find((f) => f.id === ev.fermentationBatchId) : null;
        const brew = ferm?.brewId != null ? brews.find((b) => b.id === ferm.brewId) : null;
        let portionLabel: string | null = null;
        if (brew?.sessionId != null) {
          const sessionBrews = brews.filter((b) => b.sessionId === brew.sessionId).sort((a, b) => a.id - b.id);
          const idx = sessionBrews.findIndex((b) => b.id === brew.id) + 1;
          portionLabel = `Ports ${idx}/${sessionBrews.length}`;
        }

        return (
          <div key={ev.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="font-medium text-stone-900">
                {new Date(ev.date).toLocaleDateString("et-EE")}
                {ev.bottlingDate && (
                  <span className="text-stone-500 font-normal ml-2 text-sm">
                    → villimine {new Date(ev.bottlingDate).toLocaleDateString("et-EE")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => del.mutate(ev.id)}
                disabled={del.isPending}
                className="text-xs text-stone-400 hover:text-red-600 shrink-0 disabled:opacity-50"
              >
                kustuta
              </button>
            </div>
            {brew && (
              <div className="text-xs text-stone-400 mt-0.5">
                Pruulimine: {new Date(brew.date).toLocaleDateString("et-EE")}
                {portionLabel && ` · ${portionLabel}`}
              </div>
            )}
            <div className="text-sm text-stone-600 mt-1 space-y-0.5">
              {ev.blocks.map((bl, i) => (
                <div key={i}>
                  {bl.name || "?"} · {bl.koguseL} L → {bl.gramsUsed} g{bl.method ? " · " + bl.method : ""}
                </div>
              ))}
            </div>
            {ev.notes && <p className="mt-2 text-xs text-stone-500">{ev.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
