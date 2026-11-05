import type { NextConfig } from "next";

// Security headers for every page and API answer (#34).
// - frame-ancestors 'none' / X-Frame-Options: no other site can load DELT in a hidden frame
//   and trick a student into tapping something (clickjacking).
// - The CSP allows only DELT's own scripts, styles, fonts and connections, plus GitHub's API for
//   the Android app's update check. Next.js needs inline scripts for its page data, so
//   script-src keeps 'unsafe-inline' but no outside script can load. Mail content is shown in a
//   sandboxed frame with its own stricter policy (mail-view.tsx).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // https: images are needed for 'Load images' in a mail (the mail frame inherits this policy and
  // adds its own stricter one that blocks them until asked, #32)
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com",
  "frame-src 'self' about: data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  // no upgrade-insecure-requests: HSTS already forces https, and in WebKit it also upgrades
  // http://localhost, which broke every Safari-engine test (#34 follow-up)
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
