import { useState, useRef } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  useListBatches, getListBatchesQueryKey,
  useListPhotos, getListPhotosQueryKey,
  useRequestUploadUrl,
  useCreatePhoto,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Image as ImageIcon } from "lucide-react";
import { getPhotoUrl } from "@/lib/photoUrl";

function BatchPhotos({ batchId, batchName }: { batchId: number; batchName: string }) {
  const photos = useListPhotos(batchId, { query: { queryKey: getListPhotosQueryKey(batchId) } });
  const photoList = photos.data ?? [];

  if (photoList.length === 0) return null;

  const first = photoList[photoList.length - 1];
  const latest = photoList[0];
  const hasMultiple = photoList.length > 1;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-serif font-semibold">{batchName}</h2>
        <span className="text-xs text-muted-foreground">{photoList.length} photo{photoList.length !== 1 ? "s" : ""}</span>
      </div>

      {hasMultiple ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">First</p>
            <div
              data-testid={`photo-first-${batchId}`}
              className="rounded-xl overflow-hidden aspect-square bg-muted"
            >
              <img
                src={getPhotoUrl(first.objectPath)}
                alt="First photo"
                className="w-full h-full object-cover"
              />
            </div>
            {first.dayNumber != null && (
              <p className="text-xs text-muted-foreground mt-1">Day {first.dayNumber}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Latest</p>
            <div
              data-testid={`photo-latest-${batchId}`}
              className="rounded-xl overflow-hidden aspect-square bg-muted"
            >
              <img
                src={getPhotoUrl(latest.objectPath)}
                alt="Latest photo"
                className="w-full h-full object-cover"
              />
            </div>
            {latest.dayNumber != null && (
              <p className="text-xs text-muted-foreground mt-1">Day {latest.dayNumber}</p>
            )}
          </div>
        </div>
      ) : (
        <div
          data-testid={`photo-single-${batchId}`}
          className="rounded-xl overflow-hidden aspect-video bg-muted max-w-xs"
        >
          <img
            src={getPhotoUrl(first.objectPath)}
            alt="Batch photo"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {latest.aiAnalysis && (
        <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-2">
          {latest.aiAnalysis}
        </p>
      )}

      <Link href={`/batches/${batchId}`}>
        <a className="text-xs text-primary hover:underline mt-2 inline-block">View batch</a>
      </Link>
    </div>
  );
}

export default function PhotosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const batches = useListBatches({ query: { queryKey: getListBatchesQueryKey() } });
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const requestUploadUrl = useRequestUploadUrl();
  const createPhoto = useCreatePhoto();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedBatch === null) return;

    setUploadingPhoto(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type }
      });

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await createPhoto.mutateAsync({
        batchId: selectedBatch,
        data: { objectPath, caption: "", dayNumber: 0, analyzeWithAi: true }
      });

      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey(selectedBatch) });
      toast({ title: "Photo added" });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      setSelectedBatch(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const activeBatches = batches.data?.filter(b => b.status === "active" || b.status === "f1_complete") ?? [];

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold">Photos</h1>
            <p className="text-muted-foreground text-sm mt-1">Visual history of your brews</p>
          </div>
          {activeBatches.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {activeBatches.slice(0, 3).map(b => (
                <Button
                  key={b.id}
                  data-testid={`button-upload-photo-${b.id}`}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={uploadingPhoto}
                  onClick={() => {
                    setSelectedBatch(b.id);
                    setTimeout(() => fileInputRef.current?.click(), 0);
                  }}
                >
                  {uploadingPhoto && selectedBatch === b.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                  {b.name}
                </Button>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
            data-testid="input-photos-upload"
          />
        </div>

        {batches.isLoading ? (
          <div className="animate-pulse space-y-6">
            {[...Array(2)].map((_, i) => (
              <div key={i}>
                <div className="h-5 bg-muted rounded w-32 mb-3" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="aspect-square bg-muted rounded-xl" />
                  <div className="aspect-square bg-muted rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : batches.data && batches.data.length > 0 ? (
          <div>
            {batches.data.map(b => (
              <BatchPhotos key={b.id} batchId={b.id} batchName={b.name} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={24} className="text-primary" />
            </div>
            <h3 className="font-serif font-semibold text-xl mb-2">No photos yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              Add photos to your batches to track your SCOBY's visual progress.
            </p>
            <Link href="/batches">
              <Button variant="outline" size="sm">Go to batches</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
