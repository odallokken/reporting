/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // @react-pdf/renderer relies on dynamic font/asset loading and does not
  // work correctly when traced/bundled by Next.js. Keep it as an external
  // server package so it is required from node_modules at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
