import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useGetProfile,
  getGetProfileQueryKey,
  useUpdateProfile,
  useListPersonaMaterials,
  getListPersonaMaterialsQueryKey,
  useDeletePersonaMaterial,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useUser, useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Loader2, FileText, Key, ShieldCheck, Lock, Users } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

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

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

function AdminSection() {
  const { toast } = useToast();
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await authFetch("/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const setAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const res = await authFetch(`/admin/users/${userId}/set-admin`, {
        method: "POST",
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update admin status");
      }
      return res.json();
    },
    onSuccess: (_, { isAdmin, userId }) => {
      const users = queryClient.getQueryData<AdminUser[]>(["admin-users"]);
      const name = users?.find((u) => u.id === userId);
      const displayName = name
        ? [name.firstName, name.lastName].filter(Boolean).join(" ") || name.email
        : userId;
      toast({
        title: isAdmin
          ? `Admin õigused antud: ${displayName}`
          : `Admin õigused eemaldatud: ${displayName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const getInitials = (user: AdminUser) => {
    if (user.firstName || user.lastName) {
      return [user.firstName[0], user.lastName[0]].filter(Boolean).join("").toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  return (
    <Card className="mt-4 border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users size={15} />
          Adminid
        </CardTitle>
      </CardHeader>
      <CardContent>
        {usersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Laen kasutajaid...
          </div>
        ) : usersQuery.isError ? (
          <p className="text-sm text-destructive">Kasutajate laadimine ebaõnnestus.</p>
        ) : (
          <div className="space-y-2">
            {(usersQuery.data ?? []).map((user) => {
              const displayName =
                [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
              const isPending =
                setAdminMutation.isPending &&
                (setAdminMutation.variables as { userId: string } | undefined)?.userId === user.id;

              return (
                <div
                  key={user.id}
                  data-testid={`admin-user-row-${user.id}`}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                    {getInitials(user)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {user.isSuperAdmin ? (
                    <Badge
                      data-testid={`badge-superadmin-${user.id}`}
                      variant="secondary"
                      className="flex items-center gap-1 flex-shrink-0 text-xs"
                    >
                      <Lock size={10} />
                      Superadmin
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {user.isAdmin && (
                        <Badge
                          data-testid={`badge-admin-${user.id}`}
                          variant="outline"
                          className="flex items-center gap-1 text-xs"
                        >
                          <ShieldCheck size={10} />
                          Admin
                        </Badge>
                      )}
                      <Button
                        data-testid={`button-toggle-admin-${user.id}`}
                        variant={user.isAdmin ? "outline" : "default"}
                        size="sm"
                        className="text-xs h-7 px-2"
                        disabled={isPending}
                        onClick={() =>
                          setAdminMutation.mutate({ userId: user.id, isAdmin: !user.isAdmin })
                        }
                      >
                        {isPending ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : user.isAdmin ? (
                          "Eemalda"
                        ) : (
                          "Anna admin"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const updateProfile = useUpdateProfile();

  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("teadmusbaas_admin_key") ?? "");
  const [adminKeyInput, setAdminKeyInput] = useState(() => localStorage.getItem("teadmusbaas_admin_key") ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useUnsavedChanges(adminKeyInput !== adminKey);

  const isAdminQuery = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-me"],
    queryFn: async () => {
      const res = await authFetch("/admin/me");
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
    staleTime: 60_000,
  });

  const materialsQuery = useListPersonaMaterials({
    query: {
      queryKey: [...getListPersonaMaterialsQueryKey(), adminKey],
      enabled: !!adminKey,
    },
    request: {
      headers: { "x-admin-key": adminKey },
    },
  });

  const deleteMaterial = useDeletePersonaMaterial({
    request: {
      headers: { "x-admin-key": adminKey },
    },
  });

  const handleTtsToggle = async (enabled: boolean) => {
    try {
      await updateProfile.mutateAsync({ data: { ttsEnabled: enabled } });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({ title: `TTS ${enabled ? "enabled" : "disabled"}` });
    } catch {
      toast({ title: "Could not update settings", variant: "destructive" });
    }
  };

  const handleSaveAdminKey = () => {
    const trimmed = adminKeyInput.trim();
    localStorage.setItem("teadmusbaas_admin_key", trimmed);
    setAdminKey(trimmed);
    if (trimmed) {
      toast({ title: "Admin-võti salvestatud" });
    } else {
      toast({ title: "Admin-võti eemaldatud" });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch("/api/persona/materials/upload", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Viga: ${resp.status}`);
      }

      await queryClient.invalidateQueries({ queryKey: [...getListPersonaMaterialsQueryKey(), adminKey] });
      toast({ title: "Dokument edukalt üles laaditud" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Üleslaadimise viga";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    try {
      await deleteMaterial.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: [...getListPersonaMaterialsQueryKey(), adminKey] });
      toast({ title: `"${title}" kustutatud` });
    } catch {
      toast({ title: "Kustutamine ebaõnnestus", variant: "destructive" });
    }
  };

  const isAdmin = isAdminQuery.data?.isAdmin ?? false;

  return (
    <Layout>
      <div className="p-6 max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
        </div>

        {/* Account info */}
        <Card className="mb-4 border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user && (
              <>
                {(user.firstName || user.lastName) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span data-testid="text-user-name">{[user.firstName, user.lastName].filter(Boolean).join(" ")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span data-testid="text-user-email">{user.emailAddresses?.[0]?.emailAddress}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="mb-4 border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="tts-toggle" className="text-sm font-medium">Text-to-speech</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Auto-play AI advisor responses</p>
              </div>
              <Switch
                id="tts-toggle"
                data-testid="switch-tts"
                checked={profile.data?.ttsEnabled ?? true}
                onCheckedChange={handleTtsToggle}
                disabled={updateProfile.isPending || profile.isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Brewing profile */}
        {profile.data && (
          <Card className="mb-4 border-card-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Brewing profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Experience level", value: profile.data.experienceLevel },
                { label: "Current stage", value: profile.data.currentStage },
                { label: "Has SCOBY", value: profile.data.hasScoby ? "Yes" : "No" },
                { label: "Made before", value: profile.data.hasMadeBefore ? "Yes" : "No" },
              ].map(({ label, value }) => value && (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span data-testid={`text-profile-${label.toLowerCase().replace(/ /g, "-")}`}>{value}</span>
                </div>
              ))}
              {profile.data.onboardingAdvice && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Your personalized advice</p>
                  <p className="text-xs text-foreground/70 italic leading-relaxed">{profile.data.onboardingAdvice}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Teadmusbaas */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Teadmusbaas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Lae üles Word dokumendid (.docx, .doc), mida Kombucha Abiline kasutab vastuste koostamisel.
            </p>

            {/* Admin key input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Key size={13} />
                Admin-võti
              </Label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-admin-key"
                  type="password"
                  placeholder="Sisesta admin-võti..."
                  value={adminKeyInput}
                  onChange={e => setAdminKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveAdminKey(); }}
                  className="flex-1 text-sm"
                />
                <Button
                  data-testid="button-save-admin-key"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAdminKey}
                >
                  Salvesta
                </Button>
              </div>
            </div>

            {/* Upload button */}
            {adminKey && (
              <div className="space-y-3">
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".docx,.doc"
                    className="hidden"
                    onChange={handleUpload}
                    data-testid="input-file-upload"
                  />
                  <Button
                    data-testid="button-upload-document"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <><Loader2 size={14} className="animate-spin mr-2" />Laen üles...</>
                    ) : (
                      <><Upload size={14} className="mr-2" />Lae üles dokument (.docx, .doc)</>
                    )}
                  </Button>
                </div>

                {/* Materials list */}
                {materialsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Laen materjale...
                  </div>
                ) : materialsQuery.isError ? (
                  <p className="text-sm text-destructive">
                    Vigane admin-võti või serveri viga.
                  </p>
                ) : materialsQuery.data && materialsQuery.data.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">
                      Olemasolevad materjalid ({materialsQuery.data.length})
                    </p>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {materialsQuery.data.map(mat => (
                        <div
                          key={mat.id}
                          data-testid={`material-item-${mat.id}`}
                          className="flex items-center gap-2 p-2 rounded-md border border-border bg-card/50 text-sm"
                        >
                          <FileText size={13} className="text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 truncate text-xs">{mat.title}</span>
                          <button
                            data-testid={`button-delete-material-${mat.id}`}
                            onClick={() => handleDelete(mat.id, mat.title)}
                            disabled={deleteMaterial.isPending}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-0.5 rounded"
                            title="Kustuta"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : materialsQuery.data && materialsQuery.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Materjale pole üles laaditud.</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin management — only visible to admins */}
        {isAdmin && <AdminSection />}
      </div>
    </Layout>
  );
}
