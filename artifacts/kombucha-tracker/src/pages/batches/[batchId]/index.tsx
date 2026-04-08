import { useState, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetBatch, getGetBatchQueryKey,
  useListLogs, getListLogsQueryKey,
  useListPhotos, getListPhotosQueryKey,
  useUpdateBatch,
  useRequestUploadUrl,
  useCreatePhoto,
  useDeletePhoto,
  useDeleteBatch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Plus, Camera, ArrowLeft, Check, Loader2, Trash2, Beaker, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { getPhotoUrl } from "@/lib/photoUrl";

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const batchIdNum = parseInt(batchId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const batch = useGetBatch(batchIdNum, { query: { queryKey: getGetBatchQueryKey(batchIdNum) } });
  const logs = useListLogs(batchIdNum, { query: { queryKey: getListLogsQueryKey(batchIdNum) } });
  const photos = useListPhotos(batchIdNum, { query: { queryKey: getListPhotosQueryKey(batchIdNum) } });

  const updateBatch = useUpdateBatch();
  const requestUploadUrl = useRequestUploadUrl();
  const createPhoto = useCreatePhoto();
  const deletePhoto = useDeletePhoto();
  const deleteBatch = useDeleteBatch();

  const handleMarkF1Complete = async () => {
    try {
      await updateBatch.mutateAsync({ batchId: batchIdNum, data: { status: "f1_complete" } });
      queryClient.invalidateQueries({ queryKey: getGetBatchQueryKey(batchIdNum) });
      toast({ title: "Batch marked as F1 complete" });
    } catch {
      toast({ title: "Could not update batch", variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        batchId: batchIdNum,
        data: { objectPath, caption: "", dayNumber: batch.data?.daysSinceStart ?? 0, analyzeWithAi: true }
      });

      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey(batchIdNum) });
      queryClient.invalidateQueries({ queryKey: getGetBatchQueryKey(batchIdNum) });
      toast({ title: "Photo added" });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    try {
      await deletePhoto.mutateAsync({ batchId: batchIdNum, photoId });
      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey(batchIdNum) });
      toast({ title: "Photo deleted" });
    } catch {
      toast({ title: "Could not delete photo", variant: "destructive" });
    }
  };

  const handleDeleteBatch = async () => {
    if (!confirm("Delete this batch and all its logs and photos?")) return;
    try {
      await deleteBatch.mutateAsync({ batchId: batchIdNum });
      queryClient.invalidateQueries({ queryKey: [] });
      setLocation("/batches");
    } catch {
      toast({ title: "Could not delete batch", variant: "destructive" });
    }
  };

  if (batch.isLoading) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-xl w-48" />
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!batch.data) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Batch not found</p>
          <Link href="/batches"><Button className="mt-4" variant="outline">Back to batches</Button></Link>
        </div>
      </Layout>
    );
  }

  const b = batch.data;
  const photoList = photos.data ?? [];
  const logList = logs.data ?? [];

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/batches"
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-serif font-semibold">{b.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                b.status === "active" ? "bg-primary/10 text-primary" :
                b.status === "f1_complete" ? "bg-secondary/10 text-secondary" :
                "bg-muted text-muted-foreground"
              }`}>
                {b.status === "active" ? "Active" : b.status === "f1_complete" ? "F1 Complete" : b.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={13} /> Day {b.daysSinceStart}</span>
              {b.teaType && <span>{b.teaType}</span>}
            </div>
          </div>
        </div>

        {/* F2 prompt */}
        {b.status === "active" && b.daysSinceStart >= 7 && (
          <div className="mb-4 p-4 rounded-xl bg-secondary/10 border border-secondary/20 text-sm text-foreground">
            <p className="font-medium text-secondary mb-1">Ready for second fermentation?</p>
            <p className="text-muted-foreground">Your brew has been fermenting for {b.daysSinceStart} days. Consider starting F2 soon.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          {b.status === "active" && (
            <Button
              data-testid="button-mark-f1-complete"
              onClick={handleMarkF1Complete}
              disabled={updateBatch.isPending}
              size="sm"
              className="gap-2"
            >
              {updateBatch.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Mark F1 complete
            </Button>
          )}
          {b.status === "f1_complete" && (
            <Link href="/flavoring">
              <Button data-testid="button-flavoring-guide" size="sm" variant="outline" className="gap-2">
                <Sparkles size={14} />
                Flavoring guide
              </Button>
            </Link>
          )}
          <Link href={`/batches/${batchIdNum}/log`}>
            <Button data-testid="button-log-today" size="sm" variant="outline" className="gap-2">
              <Plus size={14} />
              Log today
            </Button>
          </Link>
          <Button
            data-testid="button-add-photo"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Add photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
            data-testid="input-photo-upload"
          />
          <Button
            data-testid="button-delete-batch"
            size="sm"
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
            onClick={handleDeleteBatch}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>

        {/* Notes */}
        {b.notes && (
          <Card className="mb-6 border-card-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground italic">{b.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {photoList.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-serif font-semibold mb-3">Photos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoList.map((photo) => (
                <div key={photo.id} data-testid={`photo-${photo.id}`} className="relative group rounded-xl overflow-hidden aspect-square bg-muted">
                  <img
                    src={getPhotoUrl(photo.objectPath)}
                    alt={photo.caption ?? "Batch photo"}
                    className="w-full h-full object-cover"
                  />
                  {photo.aiAnalysis && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.aiAnalysis}
                    </div>
                  )}
                  <button
                    data-testid={`button-delete-photo-${photo.id}`}
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="absolute top-2 left-2">
                    {photo.dayNumber != null && (
                      <span className="text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">Day {photo.dayNumber}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log timeline */}
        <div>
          <h2 className="text-lg font-serif font-semibold mb-3">Log timeline</h2>
          {logList.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-dashed border-border">
              <Beaker size={24} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No logs yet for this batch</p>
              <Link href={`/batches/${batchIdNum}/log`}>
                <Button size="sm" data-testid="button-first-log">
                  <Plus size={14} className="mr-2" />
                  Add first log
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {logList.map((log) => (
                <div
                  key={log.id}
                  data-testid={`log-${log.id}`}
                  className="p-4 rounded-xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Day {log.dayNumber}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(log.loggedAt), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                    {log.temperature != null && <span>Temp: {log.temperature}°C</span>}
                    {log.ph != null && <span>pH: {log.ph}</span>}
                    {log.smell && <span>Smell: {log.smell}</span>}
                    {log.carbonation && <span>Carbonation: {log.carbonation}</span>}
                    {log.color && <span>Colour: {log.color}</span>}
                  </div>
                  {log.taste && log.taste.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {log.taste.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.activities && log.activities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {log.activities.map((a) => (
                        <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
                          {a.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.flavourAdditions && log.flavourAdditions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {log.flavourAdditions.map((f) => (
                        <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-accent text-foreground font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.scobylook && (
                    <p className="text-xs text-foreground/70 mb-2">{log.scobylook}</p>
                  )}
                  {log.notes && (
                    <p className="text-xs text-muted-foreground mb-2 italic">{log.notes}</p>
                  )}
                  {log.aiTip && (
                    <div className="mt-2 border-l-2 border-primary/30 pl-3">
                      <p className="text-xs text-primary/80 italic">{log.aiTip}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
