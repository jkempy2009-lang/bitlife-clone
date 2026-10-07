"use client";

import { useEffect } from "react";

/** Registers the offline cache in production builds only (a service worker in dev would cache stale bundles). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
