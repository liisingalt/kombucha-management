import React from "react";
import { Link, useLocation } from "wouter";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";

type LinkProps = React.ComponentProps<typeof Link>;

export function GuardedLink({ href, onClick, children, ...props }: LinkProps) {
  const { isDirty, requestNavigation } = useNavigationGuard();
  const [, setLocation] = useLocation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) {
      onClick?.(e);
      return;
    }
    e.preventDefault();
    requestNavigation(() => setLocation(href as string));
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
