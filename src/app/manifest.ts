import type { MetadataRoute } from "next";

// Makes DELT installable (Add to Home screen) and is what the Android app wraps.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DELT · VIT mail, sorted",
    short_name: "DELT",
    description: "Your VIT inbox, sorted: exams, registrations and hackathons first.",
    id: "/",
    start_url: "/#/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17112B",
    theme_color: "#17112B",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?m=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
