"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isLoading, isPageNavigation, startLoading, subscribeLoading } from "@/lib/loading-feedback";
import { LoadingUi } from "@/components/loading-ui";

export function NavigationFeedback() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const pending = useSyncExternalStore(subscribeLoading, isLoading, () => false);
  const navigation = useRef<(() => void) | null>(null);
  const committed = useRef(`${pathname}?${search}`);
  useEffect(() => { committed.current = `${pathname}?${search}`; navigation.current?.(); navigation.current = null; }, [pathname, search]);
  useEffect(() => {
    const begin = () => { navigation.current?.(); navigation.current = startLoading(); };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor && isPageNavigation(anchor, new URL(window.location.href), event)) begin();
    };
    const submit = (event: SubmitEvent) => {
      if (!event.defaultPrevented && event.target instanceof HTMLFormElement && event.target.method.toLowerCase() === "get") begin();
    };
    const end = () => { navigation.current?.(); navigation.current = null; };
    const back = () => {
      const url = new URL(window.location.href);
      if (`${url.pathname}?${url.searchParams.toString()}` !== committed.current) begin(); else end();
    };
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit);
    window.addEventListener("popstate", back);
    window.addEventListener("pageshow", end);
    window.addEventListener("error", end);
    return () => {
      end(); document.removeEventListener("click", click, true); document.removeEventListener("submit", submit);
      window.removeEventListener("popstate", back); window.removeEventListener("pageshow", end); window.removeEventListener("error", end);
    };
  }, []);
  return pending ? <LoadingUi /> : null;
}
