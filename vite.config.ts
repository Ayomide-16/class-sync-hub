// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const certPath = path.join(process.cwd(), ".cert");
const keyPath = path.join(process.cwd(), ".key");

// Auto-generate self-signed certificates for HTTPS on first run
function ensureCertificates() {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
  }

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=localhost"`,
      { stdio: "pipe" }
    );
    console.log(
      "✓ Generated self-signed SSL certificate for localhost (valid 1 year)"
    );
    return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
  } catch (error) {
    console.warn(
      "⚠ Could not generate HTTPS certificate. Running with HTTP instead."
    );
    console.warn(
      "  To enable HTTPS locally, install OpenSSL or use mkcert: https://github.com/FiloSottile/mkcert"
    );
    return null;
  }
}

const https = ensureCertificates();

export default defineConfig({
  vite: https
    ? {
        server: {
          https,
          middlewareMode: false,
        },
      }
    : {},
});
