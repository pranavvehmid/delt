import type { MetadataRoute } from "next";

// Makes DELT installable (Add to Home screen) and is what the Android app wraps.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DELT",
    short_name: "DELT",
    description: "Sorts your VIT mail so exams, registrations, fees and deadlines stay at the top.",
    id: "/",
    start_url: "/#/inbox",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAFAF9",
    theme_color: "#FAFAF9",
    icons: [
      { src: "/icons/192?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?m=1&v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
