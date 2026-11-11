/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permit development asset requests from devices on private LANs.
  allowedDevOrigins: [
    "10.*.*.*",
    "192.168.*.*",
    ...Array.from({ length: 16 }, (_, index) => `172.${index + 16}.*.*`)
  ],
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
