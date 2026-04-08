import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetFlavoringGuide, getGetFlavoringGuideQueryKey } from "@workspace/api-client-react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const preferences = [
  { value: "", label: "No preference" },
  { value: "sweet", label: "Sweet" },
  { value: "sour", label: "Sour" },
  { value: "fruity", label: "Fruity" },
];

export default function FlavoringPage() {
  const [preference, setPreference] = useState("");

  const guide = useGetFlavoringGuide(
    { preference: preference || undefined },
    {
      query: {
        queryKey: getGetFlavoringGuideQueryKey({ preference: preference || undefined }),
        enabled: true,
      }
    }
  );

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold">Flavoring guide</h1>
          <p className="text-muted-foreground text-sm mt-1">Second fermentation ideas for your taste</p>
        </div>

        {/* Preference selector */}
        <div className="mb-8">
          <p className="text-sm font-medium text-foreground mb-3">Flavor preference</p>
          <div className="flex flex-wrap gap-2">
            {preferences.map(p => (
              <button
                key={p.value}
                data-testid={`button-pref-${p.value || "none"}`}
                onClick={() => setPreference(p.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                  preference === p.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {guide.isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-2xl" />
            ))}
          </div>
        ) : guide.data ? (
          <div>
            {guide.data.generalTips && (
              <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-sm font-medium text-primary">General F2 tips</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{guide.data.generalTips}</p>
              </div>
            )}

            {guide.data.suggestions && guide.data.suggestions.length > 0 && (
              <div className="space-y-3">
                {guide.data.suggestions.map((suggestion: { name: string; ingredients: string; tip: string }, i: number) => (
                  <Card key={i} data-testid={`card-suggestion-${i}`} className="border-card-border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-1">{suggestion.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{suggestion.ingredients}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed italic">{suggestion.tip}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border">
            <Sparkles size={24} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading flavoring suggestions...</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
