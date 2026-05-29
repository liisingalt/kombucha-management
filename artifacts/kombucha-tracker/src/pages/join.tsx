import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth, SignIn } from "@clerk/react";
import { Layout } from "@/components/Layout";
import { FlaskConical, Loader2, CheckCircle, XCircle } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Status = "loading" | "success" | "already" | "error" | "need-auth";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus("need-auth");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const clerkToken = await getToken();
        const res = await fetch(`${BASE_URL}/api/team/accept/${token}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErrorMsg((body as { error?: string }).error ?? `HTTP ${res.status}`);
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { ok: boolean; alreadyMember: boolean };
        setStatus(data.alreadyMember ? "already" : "success");
        setTimeout(() => setLocation("/dashboard"), 2200);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Viga");
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, token, getToken, setLocation]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
      </div>
    );
  }

  if (status === "need-auth") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-full max-w-md px-4">
          <div className="text-center mb-6">
            <FlaskConical className="w-8 h-8 text-amber-700 mx-auto mb-2" />
            <h1 className="font-serif text-xl text-stone-900">Liitu meeskonnaga</h1>
            <p className="text-sm text-stone-500 mt-1">
              Enne kutse vastuvõtmist logi sisse või registreeri.
            </p>
          </div>
          <SignIn
            routing="hash"
            forceRedirectUrl={`${BASE_URL}/join/${token}`}
          />
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-sm px-4 pt-24 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-amber-700 mx-auto mb-3" />
            <p className="text-stone-600">Töötlen kutset…</p>
          </>
        )}
        {(status === "success" || status === "already") && (
          <>
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <h2 className="font-serif text-xl text-stone-900 mb-1">
              {status === "already" ? "Oled juba meeskonnaliige" : "Tere tulemast meeskonda!"}
            </h2>
            <p className="text-sm text-stone-500">Suunan sind armatuurlauale…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h2 className="font-serif text-xl text-stone-900 mb-1">Kutse ei õnnestunud</h2>
            <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
            <a href={`${BASE_URL}/dashboard`} className="text-sm text-amber-700 underline">
              Mine armatuurlauale
            </a>
          </>
        )}
      </div>
    </Layout>
  );
}
