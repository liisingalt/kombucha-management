import React, { createContext, useCallback, useContext, useState } from "react";
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

type NavigationGuardContextType = {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  requestNavigation: (navigate: () => void) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  isDirty: false,
  setIsDirty: () => {},
  requestNavigation: (navigate) => navigate(),
});

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const requestNavigation = useCallback(
    (navigate: () => void) => {
      if (isDirty) {
        setPendingNav(() => navigate);
      } else {
        navigate();
      }
    },
    [isDirty]
  );

  const confirmNav = () => {
    const nav = pendingNav;
    setIsDirty(false);
    setPendingNav(null);
    nav?.();
  };

  const cancelNav = () => {
    setPendingNav(null);
  };

  return (
    <NavigationGuardContext.Provider value={{ isDirty, setIsDirty, requestNavigation }}>
      {children}
      <AlertDialog open={pendingNav !== null} onOpenChange={(open) => !open && cancelNav()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Muudatused salvestamata</AlertDialogTitle>
            <AlertDialogDescription>
              Kas soovid lahkuda? Salvestamata muudatused lähevad kaduma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNav}>Jää lehele</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNav}>Lahku lehelt</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}
