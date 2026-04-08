import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetOnboardingAdvice, useUpdateProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight } from "lucide-react";

type OnboardingData = {
  hasMadeBefore: boolean;
  hasScoby: boolean;
  currentStage: string;
  experienceLevel: string;
};

const stages = ["Getting started", "First fermentation", "Second fermentation", "Bottling"];
const levels = ["Complete beginner", "Some experience", "Intermediate", "Experienced"];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    hasMadeBefore: false,
    hasScoby: false,
    currentStage: "Getting started",
    experienceLevel: "Complete beginner",
  });
  const [advice, setAdvice] = useState<string | null>(null);

  const { toast } = useToast();
  const getAdvice = useGetOnboardingAdvice();
  const updateProfile = useUpdateProfile();

  const handleSubmitQuiz = async () => {
    try {
      const result = await getAdvice.mutateAsync({
        data: {
          hasMadeBefore: data.hasMadeBefore,
          hasScoby: data.hasScoby,
          currentStage: data.currentStage,
          experienceLevel: data.experienceLevel,
        }
      });
      setAdvice(result.advice);
      setStep(4);
    } catch {
      toast({ title: "Could not get advice", variant: "destructive" });
    }
  };

  const handleComplete = async () => {
    try {
      await updateProfile.mutateAsync({
        data: {
          hasCompletedOnboarding: true,
          hasMadeBefore: data.hasMadeBefore,
          hasScoby: data.hasScoby,
          currentStage: data.currentStage,
          experienceLevel: data.experienceLevel,
          onboardingAdvice: advice ?? undefined,
        }
      });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Could not save profile", variant: "destructive" });
    }
  };

  const ChoiceCard = ({
    label,
    selected,
    onClick,
    testId,
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
    testId: string;
  }) => (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border hover:border-primary/40 hover:bg-accent text-foreground"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">
            Welcome to your brewery
          </h1>
          <p className="text-muted-foreground">
            {step < 4 ? "Tell us a bit about your brewing journey" : "Your personalized guide is ready"}
          </p>
        </div>

        {/* Progress */}
        {step < 4 && (
          <div className="flex gap-1.5 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        )}

        <Card className="border-card-border">
          <CardContent className="p-6">
            {step === 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Have you made kombucha before?</h2>
                <div className="space-y-3">
                  <ChoiceCard
                    label="Yes, I have brewed before"
                    selected={data.hasMadeBefore === true}
                    onClick={() => setData(d => ({ ...d, hasMadeBefore: true }))}
                    testId="choice-made-before-yes"
                  />
                  <ChoiceCard
                    label="No, this is my first time"
                    selected={data.hasMadeBefore === false}
                    onClick={() => setData(d => ({ ...d, hasMadeBefore: false }))}
                    testId="choice-made-before-no"
                  />
                </div>
                <Button
                  data-testid="button-onboarding-next-0"
                  className="w-full mt-6"
                  onClick={() => setStep(1)}
                >
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Do you have a SCOBY?</h2>
                <div className="space-y-3">
                  <ChoiceCard
                    label="Yes, I have a SCOBY ready"
                    selected={data.hasScoby === true}
                    onClick={() => setData(d => ({ ...d, hasScoby: true }))}
                    testId="choice-has-scoby-yes"
                  />
                  <ChoiceCard
                    label="No, I need to get one"
                    selected={data.hasScoby === false}
                    onClick={() => setData(d => ({ ...d, hasScoby: false }))}
                    testId="choice-has-scoby-no"
                  />
                </div>
                <Button
                  data-testid="button-onboarding-next-1"
                  className="w-full mt-6"
                  onClick={() => setStep(2)}
                >
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Where are you in your journey?</h2>
                <div className="space-y-3">
                  {stages.map(stage => (
                    <ChoiceCard
                      key={stage}
                      label={stage}
                      selected={data.currentStage === stage}
                      onClick={() => setData(d => ({ ...d, currentStage: stage }))}
                      testId={`choice-stage-${stage.toLowerCase().replace(/ /g, "-")}`}
                    />
                  ))}
                </div>
                <Button
                  data-testid="button-onboarding-next-2"
                  className="w-full mt-6"
                  onClick={() => setStep(3)}
                >
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">How would you describe your experience?</h2>
                <div className="space-y-3">
                  {levels.map(level => (
                    <ChoiceCard
                      key={level}
                      label={level}
                      selected={data.experienceLevel === level}
                      onClick={() => setData(d => ({ ...d, experienceLevel: level }))}
                      testId={`choice-level-${level.toLowerCase().replace(/ /g, "-")}`}
                    />
                  ))}
                </div>
                <Button
                  data-testid="button-onboarding-get-advice"
                  className="w-full mt-6"
                  onClick={handleSubmitQuiz}
                  disabled={getAdvice.isPending}
                >
                  {getAdvice.isPending ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Getting your guide...</>
                  ) : (
                    "Get my personalized guide"
                  )}
                </Button>
              </div>
            )}

            {step === 4 && advice && (
              <div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
                  <p className="text-sm text-foreground leading-relaxed font-serif">{advice}</p>
                </div>
                <Button
                  data-testid="button-onboarding-complete"
                  className="w-full"
                  onClick={handleComplete}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</>
                  ) : (
                    "Start brewing"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
