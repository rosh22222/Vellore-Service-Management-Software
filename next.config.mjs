import nextConstants from "next/constants.js";

/** @param {string} phase @returns {import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Development and production must never write into the same chunk cache.
  distDir: process.env.VFE_DIST_DIR ||
    (phase === nextConstants.PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
  poweredByHeader: false,
  // Server-rendered branding and PDFs read these files on Vercel/VPS too.
  outputFileTracingIncludes: {
    "/*": ["./public/vellore-logo-transparent.png", "./public/avatar.png"],
  },
  images: {
    // Versioned logo/avatar URLs intentionally include a content-hash query.
    localPatterns: [
      { pathname: "/vellore-logo-transparent.png" },
      { pathname: "/logo-VFE.png" },
      { pathname: "/avatar.png" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
});

export default nextConfig;
