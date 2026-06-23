import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: [
    "@txnlab/use-wallet-react",
    "@perawallet/connect",
    "@blockshake/defly-connect",
    "lute-connect",
  ],
};

export default nextConfig;
