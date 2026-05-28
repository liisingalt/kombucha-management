import React, { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth, useUser } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import OnboardingPage from "@/pages/onboarding";
import PhotosPage from "@/pages/photos";
import AdvisorPage from "@/pages/advisor";
import InsightsPage from "@/pages/insights";
import FlavoringPage from "@/pages/flavoring";
import MaarajaPage from "@/pages/maaraja";
import SettingsPage from "@/pages/settings";
import KestvuskatsedPage from "@/pages/kestvuskatsed";
import LaduPage from "@/pages/ladu";
import ValmistaminePage from "@/pages/valmistamine";
import KaariminePage from "@/pages/kaarimine";
import MaitsestaminePage from "@/pages/maitsestamine";
import EluigaPage from "@/pages/eluiga";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function EmailVerificationBanner() {
  const { user } = useUser();
  const primaryEmail = user?.primaryEmailAddress;
  if (!primaryEmail || primaryEmail.verification.status === "verified") return null;
  return (
    <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 text-center">
      Please verify your email address to access all features.
      Check your inbox for a verification link.
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: () => React.ReactElement }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  const primaryEmail = user?.primaryEmailAddress;
  const isEmailVerified = !primaryEmail || primaryEmail.verification.status === "verified";

  return (
    <>
      <Show when="signed-in">
        <>
          {!isEmailVerified && <EmailVerificationBanner />}
          <Component />
        </>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkAuthTokenWirer() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthTokenWirer />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard">
              {() => <ProtectedRoute component={DashboardPage} />}
            </Route>
            <Route path="/onboarding">
              {() => <ProtectedRoute component={OnboardingPage} />}
            </Route>
            <Route path="/photos">
              {() => <ProtectedRoute component={PhotosPage} />}
            </Route>
            <Route path="/advisor">
              {() => <ProtectedRoute component={AdvisorPage} />}
            </Route>
            <Route path="/insights">
              {() => <ProtectedRoute component={InsightsPage} />}
            </Route>
            <Route path="/flavoring">
              {() => <ProtectedRoute component={FlavoringPage} />}
            </Route>
            <Route path="/maaraja">
              {() => <ProtectedRoute component={MaarajaPage} />}
            </Route>
            <Route path="/settings">
              {() => <ProtectedRoute component={SettingsPage} />}
            </Route>
            <Route path="/kestvuskatsed">
              {() => <ProtectedRoute component={KestvuskatsedPage} />}
            </Route>
            <Route path="/ladu">
              {() => <ProtectedRoute component={LaduPage} />}
            </Route>
            <Route path="/valmistamine">
              {() => <ProtectedRoute component={ValmistaminePage} />}
            </Route>
            <Route path="/kaarimine">
              {() => <ProtectedRoute component={KaariminePage} />}
            </Route>
            <Route path="/maitsestamine">
              {() => <ProtectedRoute component={MaitsestaminePage} />}
            </Route>
            <Route path="/eluiga">
              {() => <ProtectedRoute component={EluigaPage} />}
            </Route>
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
