import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";

const ENV_FILE_NAME = ".env";

// Loads a simple .env file from the project root (no dotenv dependency needed).
function loadEnvFile(): void {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(currentDir, ENV_FILE_NAME);
    if (fs.existsSync(candidate)) {
      for (const rawLine of fs.readFileSync(candidate, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
      return;
    }
    currentDir = path.dirname(currentDir);
  }
}

loadEnvFile();

// =======local config========
// const d = (fileUrl: string) => path.dirname(fileURLToPath(fileUrl));
// const srcDir = d(import.meta.url); // apis/src
// const apisDir = path.dirname(srcDir); // apis/
// export const repoRoot = path.resolve(apisDir, ".."); // project root

// =======production========
const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.basename(currentDir) === "src"
  ? path.resolve(currentDir, "..")
  : path.resolve(currentDir, "..");

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? "4000"),
  jwtSecret: process.env.JWT_SECRET || "unicore-dev-secret-change-me-in-production",
  jwtExpiresHours: Number(process.env.JWT_EXPIRES_IN_HOURS ?? "12"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  // Lazy: evaluated per accessor so tests can override DATABASE_PATH at runtime.
  get databasePath(): string {
    const configured = process.env.DATABASE_PATH || "db/data/unicore.db";
    return path.isAbsolute(configured)
      ? configured
      : path.join(repoRoot, configured);
  },
};

// Do not crash the CLI tools (migrate/seed) on JWT misconfig; warn once instead.
if (config.jwtSecret.length < 16) {
  console.warn("[config] JWT_SECRET is short or unset — set a strong value in .env");
}

export function signToken(payload: { sub: number; role: string; email: string }): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: `${config.jwtExpiresHours}h`,
  });
}

export const frontendDistPath = path.join(repoRoot, "frontend", "dist");
