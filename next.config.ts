import type { NextConfig } from "next";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    APP_VERSION: packageJson.version,
    APP_CODENAME: packageJson.codename || "Marlin",
  },
};

export default nextConfig;
