import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Beaker, BarChart2, MessageSquare, Camera } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-background pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center relative">
          <p className="text-primary font-medium text-sm uppercase tracking-widest mb-4">Your fermentation journal</p>
          <h1 className="text-5xl font-serif font-semibold text-foreground mb-6 leading-tight">
            Nurture your brew,<br />
            <span className="text-primary">day by day</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
            Track your SCOBY health, log daily observations, get AI-powered insights,
            and guide your kombucha from first fermentation to the perfect bottle.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button data-testid="button-get-started" size="lg" className="w-full sm:w-auto px-8 text-base font-medium">
                Start brewing
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button data-testid="button-sign-in" variant="outline" size="lg" className="w-full sm:w-auto px-8 text-base font-medium">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            {
              icon: Beaker,
              title: "Batch tracking",
              description: "Create and monitor your fermentation batches from day one through bottling."
            },
            {
              icon: BarChart2,
              title: "Daily logs",
              description: "Record temperature, smell, SCOBY appearance, and get AI tips based on each entry."
            },
            {
              icon: Camera,
              title: "Photo timeline",
              description: "Document your SCOBY's growth with photos and get AI analysis of each image."
            },
            {
              icon: MessageSquare,
              title: "AI advisor",
              description: "Chat with a knowledgeable kombucha mentor anytime you have a question."
            }
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-4 p-6 rounded-2xl bg-card border border-card-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">Made with care for fermentation enthusiasts</p>
      </footer>
    </div>
  );
}
