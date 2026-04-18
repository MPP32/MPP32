import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { submissionsRouter } from "./routes/submissions";
import { proxyRouter } from "./routes/proxy";
import { logger } from "hono/logger";

const app = new Hono();

// CORS middleware — validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/mpp32\.org$/,
  /^https:\/\/www\.mpp32\.org$/,
  /^https:\/\/[a-z0-9-]+\.mpp32\.org$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/submissions", submissionsRouter);
app.route("/api/proxy", proxyRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
