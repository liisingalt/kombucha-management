import React from "react";
import { Link, useLocation } from "wouter";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";

type LinkProps = React.ComponentProps<typeof Link>;

export function GuardedLink(props: LinkProps) {
  const { isDirty, requestNavigation } = useNavigationGuard();
  const [, setLocation] = useLocation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = "href" in props ? (props.href as string) : (props.to as string);
    if (!isDirty) {
      props.onClick?.(e);
      return;
    }
    e.preventDefault();
    requestNavigation(() => setLocation(href));
  };

  return (
    <Link {...props} onClick={handleClick} />
  );
}
