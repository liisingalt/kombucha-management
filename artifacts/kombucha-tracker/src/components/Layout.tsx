import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { Home, BookOpen, MessageSquare, Settings, Beaker, Image, Sparkles, LogOut, ChevronRight, FlaskConical, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const bottomTabs = [
  { href: "/dashboard", label: "Today", icon: Home },
  { href: "/insights", label: "Insights", icon: BookOpen },
  { href: "/advisor", label: "Abiline", icon: MessageSquare },
  { href: "/maaraja", label: "Määraja", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

const sidebarSecondary = [
  { href: "/batches", label: "My batches", icon: Beaker },
  { href: "/photos", label: "Photos", icon: Image },
  { href: "/flavoring", label: "Flavoring", icon: Sparkles },
  { href: "/kestvuskatsed", label: "Katsed", icon: FlaskConical },
  { href: "/ladu", label: "Ladu", icon: Package },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const isTabActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    return location === href || location.startsWith(href + "/");
  };

  const isSecondaryActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const isOnSecondaryPage = sidebarSecondary.some((s) => isSecondaryActive(s.href));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-background/80 sticky top-0 h-screen">
          <div className="p-6 pb-4">
            <Link
              href="/dashboard"
              className="font-serif text-2xl font-semibold text-primary block"
            >
              Kombucha
            </Link>
          </div>

          {/* Primary nav */}
          <nav className="flex-1 px-4 flex flex-col gap-0.5 overflow-y-auto">
            {bottomTabs.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                data-testid={`link-nav-${label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isTabActive(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}

            {/* Divider */}
            <div className="my-2 border-t border-border" />

            {/* Secondary nav */}
            {sidebarSecondary.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                data-testid={`link-nav-${label.toLowerCase().replace(/ /g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  isSecondaryActive(href)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.firstName ?? "Brewer"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.emailAddresses?.[0]?.emailAddress}</p>
              </div>
            </div>
            <Button
              data-testid="button-sign-out"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </aside>

        {/* Main content — pb-20 on mobile to clear the bottom tab bar */}
        <main className="flex-1 min-w-0 overflow-auto pb-20 lg:pb-0">
          {/* Mobile secondary nav strip — shown when on a secondary page */}
          {isOnSecondaryPage && (
            <nav className="lg:hidden flex items-center gap-1 overflow-x-auto scrollbar-hide px-3 py-2 border-b border-border bg-background/95 sticky top-0 z-20">
              {sidebarSecondary.map(({ href, label, icon: Icon }) => {
                const active = isSecondaryActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    data-testid={`mobile-secondary-${label.toLowerCase().replace(/ /g, "-")}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon size={13} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center bg-background/95 backdrop-blur-md border-t border-border safe-area-pb">
        {bottomTabs.map(({ href, label, icon: Icon }) => {
          const active = isTabActive(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`tab-${label.toLowerCase()}`}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-colors",
                active ? "bg-primary/10" : ""
              )}>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.7} />
              </div>
              <span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function LayoutWithBack({ children, title, backHref }: {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
}) {
  return (
    <Layout>
      {title && (
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
          {backHref && (
            <Link href={backHref} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight size={20} className="rotate-180" />
            </Link>
          )}
          <h1 className="font-serif font-semibold text-lg">{title}</h1>
        </div>
      )}
      {children}
    </Layout>
  );
}
