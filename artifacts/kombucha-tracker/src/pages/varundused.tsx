import { useState } from "react";
import { useAuth } from "@clerk/react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, RefreshCw, Database, ShieldOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface BackupInfo {
  filename: string;
  timestamp: string;
  sizeBytes: number;
}

function useAuthFetch() {
  const { getToken } = useAuth();
  return async (path: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    return fetch(`${BASE_URL}/api${path}`, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(ts: string): string {
  const normalized = ts.replace(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-\d+Z?$/,
    "$1-$2-$3T$4:$5:$6Z"
  );
  try {
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString("et-EE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export default function VarundusedPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const authFetch = useAuthFetch();
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const {
    data: backups = [],
    isLoading,
    isError,
    error,
  } = useQuery<BackupInfo[], Error>({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await authFetch("/backups");
      if (res.status === 403) throw new ForbiddenError();
      if (!res.ok) throw new Error("Varunduste laadimine ebaõnnestus");
      return res.json();
    },
    retry: (_, err) => !(err instanceof ForbiddenError),
  });

  const isForbidden = error instanceof ForbiddenError;

  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/backups", { method: "POST" });
      if (res.status === 403) throw new ForbiddenError();
      if (!res.ok) throw new Error("Varundamine ebaõnnestus");
      return res.json() as Promise<BackupInfo>;
    },
    onSuccess: (info: BackupInfo) => {
      toast({ title: "Varukoopia loodud", description: info.filename });
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err: Error) => {
      toast({ title: "Viga", description: err.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await authFetch(
        `/backups/restore/${encodeURIComponent(filename)}`,
        { method: "POST" }
      );
      if (res.status === 403) throw new ForbiddenError();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Taastamine ebaõnnestus");
      }
    },
    onSuccess: () => {
      toast({ title: "Taastamine õnnestus", description: "Andmebaas on taastatud." });
      qc.invalidateQueries({ queryKey: ["backups"] });
      setRestoreTarget(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Taastamine ebaõnnestus",
        description: err.message,
        variant: "destructive",
      });
      setRestoreTarget(null);
    },
  });

  if (isForbidden) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <ShieldOff size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
          <h1 className="font-serif text-2xl font-semibold mb-2">Juurdepääs puudub</h1>
          <p className="text-sm text-muted-foreground">
            Varunduste haldamine on ainult administraatoritele. Palun võta ühendust rakenduse
            omanikuga kui vajad ligipääsu.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="text-primary" size={24} />
            <h1 className="font-serif text-2xl font-semibold">Varundused</h1>
          </div>
          <Button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="gap-2"
          >
            <RefreshCw
              size={16}
              className={backupMutation.isPending ? "animate-spin" : ""}
            />
            {backupMutation.isPending ? "Varundamine..." : "Tee varukoopia"}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Andmebaas varundatakse automaatselt iga 4 tunni tagant. Säilitatakse kuni 30
          viimast varukoopiat.
        </p>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Laadin varundusi...</p>
        )}

        {isError && !isForbidden && (
          <p className="text-sm text-destructive">
            Varunduste laadimine ebaõnnestus.
          </p>
        )}

        {!isLoading && !isError && backups.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Database size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              Varukoopiad puuduvad. Vajuta "Tee varukoopia" esimese loomiseks.
            </p>
          </div>
        )}

        {backups.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Kuupäev
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Suurus
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backups.map((b, i) => (
                  <tr
                    key={b.filename}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground">
                        {formatTimestamp(b.timestamp)}
                      </span>
                      {i === 0 && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          viimane
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {b.sizeBytes > 0 ? formatBytes(b.sizeBytes) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setRestoreTarget(b.filename)}
                        disabled={restoreMutation.isPending}
                      >
                        <Download size={13} />
                        Taasta
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Kinnita andmebaasi taastamine
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Oled taastamas varukoopiat <strong>{restoreTarget}</strong>.
              </span>
              <span className="block text-destructive font-medium">
                See kirjutab üle kõik praegused andmed. Tegevust ei saa tagasi
                võtta.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>
              Tühista
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={restoreMutation.isPending}
              onClick={() =>
                restoreTarget && restoreMutation.mutate(restoreTarget)
              }
            >
              {restoreMutation.isPending ? "Taastan..." : "Taasta andmebaas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
