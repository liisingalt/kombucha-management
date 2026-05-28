import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Droplets } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tea = { id: number; name: string; qtyG: number };
type Brew = { id: number; date: string; teaSort: string; boiledL: number };
type Vessel = { volumeL: number; vesselL: number; count: number; place: string; temp: number | null };
type Batch = {
  id: number;
  teaSort: string;
  startDate: string;
  flavoringDate: string | null;
  notes: string;
  vessels: Vessel[];
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600";

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

function days(start?: string, end?: string | null) {
  if (!start || !end) return null;
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

type VesselForm = { volumeL: string; vesselL: string; count: string; place: string; temp: string };
const emptyVessel = (): VesselForm => ({ volumeL: "", vesselL: "", count: "1", place: "", temp: "" });

export default function KaariminePage() {
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

  const batchQ = useQuery<Batch[]>({
    queryKey: ["fermentations"],
    queryFn: async () => {
      const res = await authFetch("/fermentations");
      return res.json();
    },
  });

  const teas = teaQ.data ?? [];
  const brews = brewsQ.data ?? [];

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <header className="mb-5">
          <h1 className="font-serif text-2xl text-stone-900 flex items-center gap-2">
            <Droplets className="w-6 h-6 text-amber-700" /> Käärimine
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Märgi, mis tee millistes nõudes ja mis temperatuuril käärib.
          </p>
        </header>

        <nav className="flex gap-1 mb-6 border-b border-stone-200">
          {[
            { id: "uus", label: "Uus käärimine" },
            { id: "ajalugu", label: "Ajalugu" },
          ].map((t) => (
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
          <UusKaarimine
            teas={teas}
            brews={brews}
            authFetch={authFetch}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["fermentations"] });
              flash("Käärimine salvestatud");
            }}
          />
        )}
        {tab === "ajalugu" && (
          <Ajalugu
            batches={batchQ.data ?? []}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["fermentations"] });
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

function UusKaarimine({
  teas,
  brews,
  authFetch,
  onSaved,
}: {
  teas: Tea[];
  brews: Brew[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [brewId, setBrewId] = useState<number | "">("");
  const [teaSort, setTeaSort] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [flavoringDate, setFlavoringDate] = useState("");
  const [notes, setNotes] = useState("");
  const [vessels, setVessels] = useState<VesselForm[]>([emptyVessel()]);

  const onPickBrew = (id: number | "") => {
    setBrewId(id);
    const br = brews.find((x) => x.id === id);
    if (br) {
      if (br.teaSort) setTeaSort(br.teaSort);
      if (br.date) setStartDate(br.date);
    }
  };

  const setVessel = (i: number, key: keyof VesselForm, val: string) =>
    setVessels((v) => v.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));
  const addVessel = () => setVessels((v) => [...v, emptyVessel()]);
  const removeVessel = (i: number) => setVessels((v) => v.filter((_, idx) => idx !== i));

  const totalLiquid = vessels.reduce(
    (s, v) => s + (parseFloat(v.volumeL) || 0) * (parseInt(v.count) || 0),
    0
  );
  const d = days(startDate, flavoringDate);

  const m = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch("/fermentations", { method: "POST", body: JSON.stringify(body) });
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      setVessels([emptyVessel()]);
      setNotes("");
      setFlavoringDate("");
      setBrewId("");
      setTeaSort("");
    },
  });

  const save = () => {
    if (!startDate) return;
    const cleaned: Vessel[] = vessels
      .filter((v) => v.volumeL || v.vesselL)
      .map((v) => ({
        volumeL: parseFloat(v.volumeL) || 0,
        vesselL: parseFloat(v.vesselL) || 0,
        count: parseInt(v.count) || 1,
        place: v.place,
        temp: v.temp === "" ? null : Number(v.temp),
      }));
    m.mutate({
      brewId: brewId || null,
      teaSort,
      startDate,
      flavoringDate: flavoringDate || null,
      notes,
      vessels: cleaned,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Seo pruulimisega (valikuline)</label>
          <select
            value={brewId}
            onChange={(e) => onPickBrew(e.target.value ? Number(e.target.value) : "")}
            className={inputCls}
          >
            <option value="">— vali pruulimine —</option>
            {brews.map((br) => (
              <option key={br.id} value={br.id}>
                {new Date(br.date).toLocaleDateString("et-EE")} · {br.teaSort || "tee märkimata"} · {br.boiledL} L
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Tee sort</label>
            <select value={teaSort} onChange={(e) => setTeaSort(e.target.value)} className={inputCls}>
              <option value="">— vali tee —</option>
              {teas.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Käärima pandi</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitsestamise kuupäev</label>
            <input
              type="date"
              value={flavoringDate}
              onChange={(e) => setFlavoringDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Käärimise aeg</label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium">
              {d != null ? `${d} päeva` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-900">Nõud</h3>
          <button
            type="button"
            onClick={addVessel}
            className="text-sm text-amber-700 hover:text-amber-900"
          >
            + lisa nõu
          </button>
        </div>
        {vessels.map((v, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Kogus nõus, L</label>
                <input
                  type="number"
                  value={v.volumeL}
                  onChange={(e) => setVessel(i, "volumeL", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nõu maht, L</label>
                <input
                  type="number"
                  value={v.vesselL}
                  onChange={(e) => setVessel(i, "vesselL", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Mitu sellist nõud</label>
                <input
                  type="number"
                  value={v.count}
                  onChange={(e) => setVessel(i, "count", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Temp, °C</label>
                <input
                  type="number"
                  value={v.temp}
                  onChange={(e) => setVessel(i, "temp", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-stone-500 mb-1">Käärimiskoht</label>
                <input
                  value={v.place}
                  onChange={(e) => setVessel(i, "place", e.target.value)}
                  list="ferm-places"
                  className={inputCls}
                  placeholder="nt köögis kapi peal"
                />
                <datalist id="ferm-places">
                  <option value="köögis kapi peal" />
                  <option value="sahver" />
                  <option value="kelder" />
                </datalist>
              </div>
            </div>
            {vessels.length > 1 && (
              <button
                type="button"
                onClick={() => removeVessel(i)}
                className="mt-2 text-xs text-stone-400 hover:text-red-600"
              >
                eemalda nõu
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-stone-400">Kokku vedelikku nõudes: {totalLiquid.toFixed(1)} L</p>
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1">Märkmed</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="kuidas maitses, kas käärimine oli piisav"
        />
      </div>

      <button
        onClick={save}
        disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Salvesta käärimine"}
      </button>
    </div>
  );
}

function Ajalugu({
  batches,
  authFetch,
  onChange,
  flash,
}: {
  batches: Batch[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
}) {
  if (batches.length === 0) {
    return <p className="text-sm text-stone-400">Veel ühtegi käärimist pole.</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} authFetch={authFetch} onChange={onChange} flash={flash} />
      ))}
    </div>
  );
}

function BatchCard({
  batch,
  authFetch,
  onChange,
  flash,
}: {
  batch: Batch;
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
}) {
  const [flavoringDate, setFlavoringDate] = useState(batch.flavoringDate ?? "");
  const d = days(batch.startDate, flavoringDate || batch.flavoringDate);

  const patch = useMutation({
    mutationFn: async (body: unknown) => {
      const res = await authFetch(`/fermentations/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Maitsestamise kuupäev salvestatud");
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/fermentations/${batch.id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      onChange();
      flash("Käärimine kustutatud");
    },
  });

  const inputCls =
    "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-stone-900">
            {new Date(batch.startDate).toLocaleDateString("et-EE")} · {batch.teaSort || "tee märkimata"}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            {batch.vessels.map((v, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {v.count} × {v.vesselL} L ({v.volumeL} L, {v.temp ?? "?"} °C{v.place ? ", " + v.place : ""})
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => del.mutate()}
          disabled={del.isPending}
          className="text-xs text-stone-400 hover:text-red-600 shrink-0 disabled:opacity-50"
        >
          kustuta
        </button>
      </div>
      <div className="mt-3 flex items-end gap-2 border-t border-stone-100 pt-3">
        <div className="flex-1">
          <label className="block text-xs text-stone-500 mb-1">Maitsestamise kuupäev</label>
          <input
            type="date"
            value={flavoringDate}
            onChange={(e) => setFlavoringDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="text-sm text-stone-600 pb-2">{d != null ? `${d} päeva` : "—"}</div>
        <button
          onClick={() => patch.mutate({ flavoringDate })}
          disabled={patch.isPending}
          className="rounded-lg bg-amber-700 px-3 py-2 text-white text-sm shrink-0 disabled:opacity-50"
        >
          Salvesta
        </button>
      </div>
      {batch.notes && <p className="mt-2 text-sm text-stone-600">{batch.notes}</p>}
    </div>
  );
}
