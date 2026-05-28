import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Droplets } from "lucide-react";
import { Layout } from "@/components/Layout";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tea = { id: number; name: string; qtyG: number };
type Brew = { id: number; date: string; teaSort: string; boiledL: number; sessionId: number | null };
type Vessel = { volumeL: number; vesselL: number; count: number; place: string; temp: number | null };
type BrewSummary = {
  id: number;
  date: string;
  teaSort: string;
  teaG: number;
  sugarG: number;
  boiledL: number;
  coldWaterL: number | null;
  starterPct: number | null;
  starterG: number;
  steepMin: number | null;
};
type Batch = {
  id: number;
  teaSort: string;
  startDate: string;
  flavoringDate: string | null;
  notes: string;
  vessels: Vessel[];
  brew: BrewSummary | null;
};
type FlavEvent = { id: number; date: string; fermentationBatchId: number | null };

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
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const flash = (msg: string) => {
    setToast({ msg, isError: false });
    setTimeout(() => setToast(null), 2600);
  };

  const flashError = (msg: string) => {
    setToast({ msg, isError: true });
    setTimeout(() => setToast(null), 3500);
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

  const flavEventsQ = useQuery<FlavEvent[]>({
    queryKey: ["flavoring-events"],
    queryFn: async () => {
      const res = await authFetch("/flavoring/events");
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
            onError={flashError}
          />
        )}
        {tab === "ajalugu" && (
          <Ajalugu
            batches={batchQ.data ?? []}
            teas={teas}
            flavEvents={flavEventsQ.data ?? []}
            authFetch={authFetch}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["fermentations"] });
            }}
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

function UusKaarimine({
  teas,
  brews,
  authFetch,
  onSaved,
  onError,
}: {
  teas: Tea[];
  brews: Brew[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onSaved: () => void;
  onError: (msg: string) => void;
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
    onError: (err: Error) => onError(err.message || "Salvestamine ebaõnnestus"),
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
        {(() => {
          if (!brewId) return null;
          const sel = brews.find((b) => b.id === brewId);
          if (!sel?.sessionId) return null;
          const sessionBrews = [...brews.filter((b) => b.sessionId === sel.sessionId)].sort((a, b) => a.id - b.id);
          if (sessionBrews.length <= 1) return null;
          const totalBoiled = sessionBrews.reduce((s, b) => s + b.boiledL, 0);
          return (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 space-y-0.5">
              <div className="font-medium">{sessionBrews.length} ports teed ühel päeval · kokku {totalBoiled} L</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-amber-700">
                {sessionBrews.map((b, i) => (
                  <span key={b.id}>Ports {i + 1}: {b.boiledL} L{b.teaSort ? ` (${b.teaSort})` : ""}</span>
                ))}
              </div>
            </div>
          );
        })()}
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

      <a
        href={`${BASE_URL}/maitsestamine`}
        className="w-full rounded-lg border-2 border-dashed border-amber-400 py-3 text-amber-700 font-medium hover:bg-amber-50 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> lisa maitsestus
      </a>

      <button
        type="button"
        onClick={addVessel}
        className="w-full rounded-lg border-2 border-dashed border-stone-300 py-3 text-stone-500 font-medium hover:border-stone-400 hover:text-stone-700 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> lisa nõu
      </button>

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
  teas,
  flavEvents,
  authFetch,
  onChange,
  flash,
  flashError,
}: {
  batches: Batch[];
  teas: Tea[];
  flavEvents: FlavEvent[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
  flashError: (msg: string) => void;
}) {
  if (batches.length === 0) {
    return <p className="text-sm text-stone-400">Veel ühtegi käärimist pole.</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} teas={teas} flavEvents={flavEvents} authFetch={authFetch} onChange={onChange} flash={flash} flashError={flashError} />
      ))}
    </div>
  );
}

function BatchCard({
  batch,
  teas,
  flavEvents,
  authFetch,
  onChange,
  flash,
  flashError,
}: {
  batch: Batch;
  teas: Tea[];
  flavEvents: FlavEvent[];
  authFetch: ReturnType<typeof useAuthFetch>;
  onChange: () => void;
  flash: (msg: string) => void;
  flashError: (msg: string) => void;
}) {
  const linkedEvent = flavEvents.find((e) => e.fermentationBatchId === batch.id) ?? null;
  const linkedFlavoringDate = linkedEvent?.date ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [editTeaSort, setEditTeaSort] = useState(batch.teaSort);
  const [editStartDate, setEditStartDate] = useState(batch.startDate);
  const [editFlavoringDate, setEditFlavoringDate] = useState(batch.flavoringDate ?? "");
  const [editNotes, setEditNotes] = useState(batch.notes);
  const [editVessels, setEditVessels] = useState<VesselForm[]>([emptyVessel()]);

  const openEdit = () => {
    setEditTeaSort(batch.teaSort);
    setEditStartDate(batch.startDate);
    setEditFlavoringDate(batch.flavoringDate ?? "");
    setEditNotes(batch.notes);
    setEditVessels(
      batch.vessels.length > 0
        ? batch.vessels.map((v) => ({
            volumeL: String(v.volumeL),
            vesselL: String(v.vesselL),
            count: String(v.count),
            place: v.place,
            temp: v.temp != null ? String(v.temp) : "",
          }))
        : [emptyVessel()]
    );
    setEditOpen(true);
  };

  const setEditVessel = (i: number, key: keyof VesselForm, val: string) =>
    setEditVessels((v) => v.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));
  const addEditVessel = () => setEditVessels((v) => [...v, emptyVessel()]);
  const removeEditVessel = (i: number) =>
    setEditVessels((v) => v.filter((_, idx) => idx !== i));

  const editTotalLiquid = editVessels.reduce(
    (s, v) => s + (parseFloat(v.volumeL) || 0) * (parseInt(v.count) || 0),
    0
  );
  const effectiveFlavoringDate = linkedFlavoringDate ?? (editFlavoringDate || null);
  const editD = days(editStartDate, effectiveFlavoringDate);
  const d = days(batch.startDate, batch.flavoringDate);

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
      setEditOpen(false);
      flash("Käärimine salvestatud");
    },
    onError: (err: Error) => flashError(err.message || "Salvestamine ebaõnnestus"),
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
    onError: (err: Error) => flashError(err.message || "Kustutamine ebaõnnestus"),
  });

  const save = () => {
    if (!editStartDate) return;
    const cleaned: Vessel[] = editVessels
      .filter((v) => v.volumeL || v.vesselL)
      .map((v) => ({
        volumeL: parseFloat(v.volumeL) || 0,
        vesselL: parseFloat(v.vesselL) || 0,
        count: parseInt(v.count) || 1,
        place: v.place,
        temp: v.temp === "" ? null : Number(v.temp),
      }));
    patch.mutate({
      teaSort: editTeaSort,
      startDate: editStartDate,
      flavoringDate: effectiveFlavoringDate || null,
      notes: editNotes,
      vessels: cleaned,
    });
  };

  if (editOpen) {
    return (
      <div className="rounded-xl border border-amber-300 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base text-stone-900">Muuda käärimist</h3>
          <button
            onClick={() => setEditOpen(false)}
            className="text-xs text-stone-400 hover:text-stone-700"
          >
            tühista
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Tee sort</label>
            <select
              value={editTeaSort}
              onChange={(e) => setEditTeaSort(e.target.value)}
              className={inputCls}
            >
              <option value="">— vali tee —</option>
              {teas.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Käärima pandi</label>
            <input
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Maitsestamise kuupäev</label>
            {linkedFlavoringDate ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium text-sm">
                {new Date(linkedFlavoringDate).toLocaleDateString("et-EE")}
                <span className="ml-2 text-xs text-amber-600 font-normal">automaatne maitsestamisest</span>
              </div>
            ) : (
              <input
                type="date"
                value={editFlavoringDate}
                onChange={(e) => setEditFlavoringDate(e.target.value)}
                className={inputCls}
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Käärimise aeg</label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium">
              {editD != null ? `${editD} päeva` : "—"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Nõud</span>
            <button
              type="button"
              onClick={addEditVessel}
              className="text-xs text-amber-700 hover:text-amber-900"
            >
              + lisa nõu
            </button>
          </div>
          {editVessels.map((v, i) => (
            <div key={i} className="rounded-lg border border-stone-200 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Kogus nõus, L</label>
                  <input
                    type="number"
                    value={v.volumeL}
                    onChange={(e) => setEditVessel(i, "volumeL", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Nõu maht, L</label>
                  <input
                    type="number"
                    value={v.vesselL}
                    onChange={(e) => setEditVessel(i, "vesselL", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Mitu sellist nõud</label>
                  <input
                    type="number"
                    value={v.count}
                    onChange={(e) => setEditVessel(i, "count", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Temp, °C</label>
                  <input
                    type="number"
                    value={v.temp}
                    onChange={(e) => setEditVessel(i, "temp", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-stone-500 mb-1">Käärimiskoht</label>
                  <input
                    value={v.place}
                    onChange={(e) => setEditVessel(i, "place", e.target.value)}
                    list="edit-ferm-places"
                    className={inputCls}
                    placeholder="nt köögis kapi peal"
                  />
                  <datalist id="edit-ferm-places">
                    <option value="köögis kapi peal" />
                    <option value="sahver" />
                    <option value="kelder" />
                  </datalist>
                </div>
              </div>
              {editVessels.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEditVessel(i)}
                  className="mt-2 text-xs text-stone-400 hover:text-red-600"
                >
                  eemalda nõu
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-stone-400">
            Kokku vedelikku nõudes: {editTotalLiquid.toFixed(1)} L
          </p>
        </div>

        <div>
          <label className="block text-xs text-stone-500 mb-1">Märkmed</label>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>

        <button
          onClick={save}
          disabled={patch.isPending}
          className="w-full rounded-lg bg-amber-700 py-2.5 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
        >
          {patch.isPending ? "Salvestan…" : "Salvesta muudatused"}
        </button>
      </div>
    );
  }

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
                {v.count} × {v.vesselL} L ({v.volumeL} L, {v.temp ?? "?"} °C
                {v.place ? ", " + v.place : ""})
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={openEdit}
            className="text-xs text-stone-500 hover:text-amber-700"
          >
            muuda
          </button>
          <button
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            kustuta
          </button>
        </div>
      </div>
      {(batch.brew || batch.flavoringDate || batch.notes) && (
        <div className="mt-2 pt-2 border-t border-stone-100 space-y-1">
          {batch.brew && (
            <div className="text-xs text-stone-500 bg-amber-50 rounded-lg px-3 py-2 space-y-0.5">
              <p className="font-medium text-amber-800">
                Pruulimine: {new Date(batch.brew.date).toLocaleDateString("et-EE")}
              </p>
              <p>
                Teed {batch.brew.teaG} g · suhkrut {batch.brew.sugarG} g
                {batch.brew.boiledL ? ` · keedetud ${batch.brew.boiledL} L` : ""}
                {batch.brew.coldWaterL ? ` + ${batch.brew.coldWaterL} L külm` : ""}
                {batch.brew.steepMin ? ` · tõmbis ${batch.brew.steepMin} min` : ""}
              </p>
              {batch.brew.starterG > 0 && (
                <p>Juuretis {batch.brew.starterG} g{batch.brew.starterPct ? ` (${batch.brew.starterPct}%)` : ""}</p>
              )}
            </div>
          )}
          {batch.flavoringDate && (
            <p className="text-xs text-stone-500">
              Maitsestamine: {new Date(batch.flavoringDate).toLocaleDateString("et-EE")}
              {d != null ? ` · ${d} päeva` : ""}
              {linkedFlavoringDate && (
                <span className="ml-1 text-amber-600">· automaatne</span>
              )}
            </p>
          )}
          {batch.notes && <p className="text-sm text-stone-600">{batch.notes}</p>}
        </div>
      )}
    </div>
  );
}
