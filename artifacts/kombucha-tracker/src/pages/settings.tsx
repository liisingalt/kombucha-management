import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useGetProfile, getGetProfileQueryKey, useUpdateProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const updateProfile = useUpdateProfile();

  const handleTtsToggle = async (enabled: boolean) => {
    try {
      await updateProfile.mutateAsync({ data: { ttsEnabled: enabled } });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({ title: `TTS ${enabled ? "enabled" : "disabled"}` });
    } catch {
      toast({ title: "Could not update settings", variant: "destructive" });
    }
  };

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
          <Card className="border-card-border">
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
      </div>
    </Layout>
  );
}
