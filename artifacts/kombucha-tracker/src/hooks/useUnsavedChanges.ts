import { useEffect } from "react";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";

export function useUnsavedChanges(isDirty: boolean) {
  const { setIsDirty } = useNavigationGuard();

  useEffect(() => {
    setIsDirty(isDirty);
  }, [isDirty, setIsDirty]);

  useEffect(() => {
    return () => {
      setIsDirty(false);
    };
  }, [setIsDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
