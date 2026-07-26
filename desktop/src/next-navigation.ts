import { useEffect, useState } from "react";

const NAVIGATION_EVENT = "folio:navigate";

function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function useRouter() {
  return {
    push: navigate,
    replace(path: string) {
      window.history.replaceState({}, "", path);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
    },
  };
}

export function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname || "/");
  useEffect(() => {
    const update = () => setPathname(window.location.pathname || "/");
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATION_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);
  return pathname;
}
