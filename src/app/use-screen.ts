"use client";

// Where you are in the app and what kind of screen it's on.
import { startTransition, useEffect, useRef, useState } from "react";
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
  const current = useRef(route);
  useEffect(() => {
    // #77: each change takes the cheapest smooth path. A page-wide view transition makes React
    // render synchronously before anything moves (90–170ms on a mid-range phone), so:
    // - opening a mail or switching tabs: render in small chunks React can pause, so frames keep
    //   coming; the mail panel then animates itself in (one GPU layer)
    // - closing a mail: the snapshot slide-out, which is cheap
    let first = true;
    const on = () => {
      const next = readRoute(), prev = current.current;
      current.current = next;
      if (first) return (first = false), setRoute(next);
      if (prev.mailId && !next.mailId) return transition(() => setRoute(next));
      startTransition(() => setRoute(next));
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
