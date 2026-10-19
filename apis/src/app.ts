import express from "express";
import fs from "node:fs";
import swaggerUi from "swagger-ui-express";
import { config, frontendDistPath } from "./config.js";
import { swaggerSpec } from "./swagger.js";
import {
  authRoutes,
  dashboardRoutes,
  departmentRoutes,
  employeeRoutes,
  financeRoutes,
  importRoutes,
  programmeRoutes,
  settingsRoutes,
  studentRoutes,
  userRoutes,
} from "./routes/index.js";
import { ApiError, notFound } from "./lib/errors.js";
import { loadUser } from "./auth/middleware.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "5mb", strict: false }));
app.use(express.urlencoded({ extended: true }));

// Manual, minimal CORS (no dependency)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin === config.corsOrigin || process.env.CORS_ORIGIN === "*")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "false");
  }
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.sendStatus(204);
  }
  next();
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/openapi.json", (_req, res) => res.json(swaggerSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true, customSiteTitle: "UniCore API Docs" }));

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/programmes", programmeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/import", importRoutes);
// CSV export lives under /api/export (same handlers, different mounted resource name)
app.use("/api/export", importRoutes);

app.use("/api", (_req, _res, next) => next(notFound("Endpoint not found")));

// Consistent JSON error responses + centralized handling
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details ?? undefined, status: err.status } });
    return;
  }
  // SQLite constraint / generic server error — never leak sensitive info
  const message =
    err instanceof Error &&
    /UNIQUE constraint failed: students\.email/.test(err.message)
      ? "Email is already used by another student"
      : err instanceof Error && /UNIQUE constraint/.test(err.message)
        ? "A record with the same unique value already exists"
        : "Internal server error";
  if (err instanceof Error && !(err instanceof ApiError) && process.env.NODE_ENV !== "test") {
    console.error("[error]", err.message);
  }
  res.status(500).json({ error: { message, status: 500 } });
};
app.use(errorHandler);

// Static frontend when built (single-server deployment)
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.status(200);
    res.type("text/html");
    res.sendFile(`${frontendDistPath}/index.html`);
  });
}

export default app;
