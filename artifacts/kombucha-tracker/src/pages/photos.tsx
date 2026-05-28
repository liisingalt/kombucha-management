import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/react";
import { Layout } from "@/components/Layout";
import { Image as ImageIcon, FlaskConical, Droplets, Leaf, Upload, X, Calendar, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Phase = "brew" | "fermentation" | "flavoring";
type Photo = {
  id: number;
  userId: string;
  objectPath: string;
  phase: string | null;
  stageRefId: number | null;
  photoDate: string | null;
  caption: string | null;
  createdAt: string;
};

const phaseInfo: Record<Phase, { label: string; icon: React.ElementType; color: string }> = {
  brew: { label: "Pruulimine", icon: FlaskConical, color: "bg-orange-100 text-orange-700 border-orange-200" },
  fermentation: { label: "Käärimine", icon: Droplets, color: "bg-blue-100 text-blue-700 border-blue-200" },
  flavoring: { label: "Maitsestamine", icon: Leaf, color: "bg-green-100 text-green-700 border-green-200" },
};

function PhaseBadge({ phase }: { phase: string | null }) {
  if (!phase || !(phase in phaseInfo)) return null;
  const info = phaseInfo[phase as Phase];
  const Icon = info.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", info.color)}>
      <Icon size={9} />
      {info.label}
    </span>
  );
}

export default function PhotosPage() {
  const { getToken } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [filterPhase, setFilterPhase] = useState<Phase | "all">("all");

  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      const token = await getToken();
      const url = filterPhase !== "all"
        ? `${BASE_URL}/api/photos?phase=${filterPhase}`
        : `${BASE_URL}/api/photos`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
      }
    } catch {
    } finally {
      setPhotosLoading(false);
    }
  }, [getToken, filterPhase]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  function pickPhase(phase: Phase) {
    setSelectedPhase(phase);
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const token = await getToken();

      const urlRes = await fetch(`${BASE_URL}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
      });
      if (!urlRes.ok) throw new Error("Üleslaadimise URL ei õnnestunud");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Faili üleslaadimine ebaõnnestus");

      const regRes = await fetch(`${BASE_URL}/api/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          objectPath,
          phase: selectedPhase ?? null,
          stageRefId: null,
          photoDate: useCustomDate ? photoDate : new Date().toISOString().slice(0, 10),
          caption: caption.trim() || null,
        }),
      });
      if (!regRes.ok) throw new Error("Foto registreerimine ebaõnnestus");

      setShowUpload(false);
      setSelectedPhase(null);
      setCaption("");
      setUseCustomDate(false);
      setPhotoDate(new Date().toISOString().slice(0, 10));
      await fetchPhotos();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Viga üleslaadimise ajal");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(photo: Photo) {
    if (!confirm("Kustuta foto?")) return;
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/photos/${photo.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
    }
  }

  function getPhotoUrl(objectPath: string) {
    return `${BASE_URL}/api${objectPath}`;
  }

  const displayed = filterPhase === "all" ? photos : photos.filter((p) => p.phase === filterPhase);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-stone-800">Fotod</h1>
            <p className="text-sm text-stone-500 mt-0.5">Protsessi visuaalne ajalugu</p>
          </div>
          <Button
            onClick={() => { setShowUpload(true); setUploadError(null); }}
            className="gap-2"
            size="sm"
          >
            <Upload size={14} />
            Lisa foto
          </Button>
        </div>

        {/* Phase filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterPhase("all")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
              filterPhase === "all"
                ? "bg-stone-800 text-white border-stone-800"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
            )}
          >
            Kõik ({photos.length})
          </button>
          {(Object.entries(phaseInfo) as [Phase, typeof phaseInfo[Phase]][]).map(([phase, info]) => {
            const Icon = info.icon;
            const count = photos.filter((p) => p.phase === phase).length;
            return (
              <button
                key={phase}
                onClick={() => setFilterPhase(phase)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium flex items-center gap-1 transition-all",
                  filterPhase === phase
                    ? "bg-stone-800 text-white border-stone-800"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                )}
              >
                <Icon size={10} />
                {info.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Photo grid */}
        {photosLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-stone-200">
            <ImageIcon size={36} className="mx-auto mb-3 text-stone-300" />
            <div className="text-sm text-stone-500">
              {filterPhase === "all" ? "Fotosid pole veel lisatud." : `Selles etapis pole fotosid.`}
            </div>
            <button
              onClick={() => { setShowUpload(true); setUploadError(null); }}
              className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
            >
              Lisa esimene foto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayed.map((photo) => (
              <div key={photo.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                <img
                  src={getPhotoUrl(photo.objectPath)}
                  alt={photo.caption ?? "Foto"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.caption && (
                    <p className="text-white text-xs line-clamp-2 mb-1">{photo.caption}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <PhaseBadge phase={photo.phase} />
                    <button
                      onClick={() => handleDelete(photo)}
                      className="text-white/80 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {photo.phase && (
                  <div className="absolute top-2 left-2">
                    <PhaseBadge phase={photo.phase} />
                  </div>
                )}
                {photo.photoDate && (
                  <div className="absolute top-2 right-2 text-[9px] bg-black/40 text-white rounded px-1.5 py-0.5">
                    {new Date(photo.photoDate).toLocaleDateString("et-EE", { day: "numeric", month: "short" })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-semibold text-lg">Lisa foto</h2>
              <button
                onClick={() => { setShowUpload(false); setSelectedPhase(null); setUploadError(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Phase selector */}
              <div>
                <label className="block text-sm font-medium mb-2">Protsessi etapp</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(phaseInfo) as [Phase, typeof phaseInfo[Phase]][]).map(([phase, info]) => {
                    const Icon = info.icon;
                    return (
                      <button
                        key={phase}
                        type="button"
                        onClick={() => pickPhase(phase)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all",
                          selectedPhase === phase
                            ? "bg-amber-50 border-amber-400 text-amber-800"
                            : "bg-background border-border text-muted-foreground hover:border-stone-400"
                        )}
                      >
                        <Icon size={16} />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Foto kuupäev</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setUseCustomDate(false)}
                    className={cn(
                      "flex-1 text-xs py-2 rounded-xl border font-medium transition-all",
                      !useCustomDate ? "bg-stone-800 text-white border-stone-800" : "border-border text-muted-foreground hover:border-stone-400"
                    )}
                  >
                    Täna
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseCustomDate(true)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border font-medium transition-all",
                      useCustomDate ? "bg-stone-800 text-white border-stone-800" : "border-border text-muted-foreground hover:border-stone-400"
                    )}
                  >
                    <Calendar size={12} />
                    Vali kuupäev
                  </button>
                </div>
                {useCustomDate && (
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={photoDate}
                    onChange={(e) => setPhotoDate(e.target.value)}
                  />
                )}
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Kirjeldus <span className="text-muted-foreground font-normal text-xs">(valikuline)</span>
                </label>
                <input
                  type="text"
                  placeholder="nt. SCOBY kasv 5. päeval"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>

              {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}

              {/* File input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowUpload(false); setSelectedPhase(null); setUploadError(null); }}
                >
                  Tühista
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Laadin üles...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Vali fail
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
