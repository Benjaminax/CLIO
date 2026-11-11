import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.designclio.readingplatform",
  appName: "CLIO",
  webDir: "dist",
  server: {
    androidScheme: "http",
    cleartext: true,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "LIGHT",
      hidden: false,
    },
  },
};

export default config;
