"use client";

// #61: rows render only the parts the current look shows, so these hooks say which look is on
// and whether the device has a mouse to hover with.
import { useSyncExternalStore } from "react";

export type Look = "minimal" | "glyph" | "grid";

function onLook(cb: () => void) {
  const watch = new MutationObserver(cb);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-look"] });
  return () => watch.disconnect();
}
const readLook = (): Look => {
  const l = document.documentElement.dataset.look;
  return l === "glyph" || l === "grid" ? l : "minimal";
};

export function useLook(): Look {
  return useSyncExternalStore(onLook, readLook, () => "minimal");
}

const HOVER = "(hover: hover)";
function onHover(cb: () => void) {
  const mq = window.matchMedia(HOVER);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useCanHover(): boolean {
  return useSyncExternalStore(onHover, () => window.matchMedia(HOVER).matches, () => false);
}
