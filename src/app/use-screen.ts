"use client";

// Where you are in the app and what kind of screen it's on.
import { useEffect, useState } from "react";
import { transition } from "./motion";

export type Route = { tab: "inbox" | "deadlines"; mailId: string | null };

function readRoute(): Route {
  const h = typeof location === "undefined" ? "" : location.hash;
  const m = h.match(/^#\/mail\/(.+)$/);
  if (m) return { tab: (sessionStorage.getItem("delt-tab") as Route["tab"]) || "inbox", mailId: decodeURIComponent(m[1]) };
  return { tab: h.startsWith("#/deadlines") ? "deadlines" : "inbox", mailId: null };
}

/** The route lives in the URL hash, so the phone's Back button closes a mail. */
export function useRoute() {
  const [route, setRoute] = useState<Route>({ tab: "inbox", mailId: null });
  useEffect(() => {
    // opening/closing a mail and switching tabs animate (see motion.ts); the first read doesn't
    let first = true;
    const on = () => {
      if (first) return (first = false), setRoute(readRoute());
      transition(() => setRoute(readRoute()));
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function goTab(tab: Route["tab"]) {
  sessionStorage.setItem("delt-tab", tab);
  location.hash = `#/${tab}`;
  window.scrollTo({ top: 0 });
}

/** #48: wide screens read mail in a pane beside the list. */
export function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1000px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** #50: tell touch users once that rows can be swiped. */
export function useSwipeHint() {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    try {
      setHint(window.matchMedia("(pointer: coarse)").matches && !localStorage.getItem("delt-swipe-hint"));
    } catch {}
  }, []);
  const dismiss = () => {
    setHint(false);
    try {
      localStorage.setItem("delt-swipe-hint", "1");
    } catch {}
  };
  return [hint, dismiss] as const;
}

export const PULL_AT = 72;

/** #51: pull down at the top of the list to check for mail (touch screens). */
export function usePullToRefresh(enabled: boolean, onPull: () => void) {
  const [pull, setPull] = useState(0);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    let startY: number | null = null, dist = 0;
    const down = (e: TouchEvent) => {
      startY = window.scrollY <= 0 && enabled ? e.touches[0].clientY : null;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY === null) return;
      dist = Math.max(0, Math.min(120, (e.touches[0].clientY - startY) * 0.5));
      setPull(dist);
    };
    const up = () => {
      if (startY !== null && dist >= PULL_AT) onPull();
      startY = null;
      dist = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [enabled, onPull]);
  return pull;
}
