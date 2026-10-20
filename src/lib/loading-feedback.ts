const jobs = new Set<symbol>();
const listeners = new Set<() => void>();
export function subscribeLoading(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function isLoading() { return jobs.size > 0; }
export function startLoading() {
  const job = Symbol("loading"); jobs.add(job); listeners.forEach(listener => listener());
  return () => { if (jobs.delete(job)) listeners.forEach(listener => listener()); };
}

export function isPageNavigation(anchor: HTMLAnchorElement, current: URL, event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return false;
  const target = new URL(anchor.href, current);
  if (target.pathname.startsWith("/api/")) return false;
  return target.origin === current.origin && (target.pathname !== current.pathname || target.search !== current.search);
}
