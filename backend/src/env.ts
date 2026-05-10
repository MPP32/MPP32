import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const solanaAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

const envSchema = z.object({
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional().default("development"),
  TEMPO_RECIPIENT_ADDRESS: z.string().startsWith("0x").min(42).max(42).optional().default("0x2a87Da867d725aA8853dc88548Ad6C64bBb456c1"),
  TEMPO_CURRENCY_ADDRESS: z.string().startsWith("0x").min(42).max(42).optional().default("0x20c0000000000000000000000000000000000000"),
  MPP_PRICE: z.string().optional().default("0.008"),
  MPP_SECRET_KEY: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().optional(),
  BACKEND_URL: z.string().url().optional(),
  X402_RECIPIENT_ADDRESS: solanaAddress.optional().default("9Pa8yUe8k1aRAoS1J8T5d4Mc4zXH2QTKiHE7wibowt6S"),
  X402_FACILITATOR_URL: z.string().url().optional().default("https://x402.org/facilitator"),
  X402_ENABLED: z.enum(["true", "false"]).optional().default("true"),
  SOLANA_RPC_URL: z.string().url().optional().default("https://api.mainnet-beta.solana.com"),
  M32_TOKEN_MINT: z.string().optional().default("6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump"),
  AP2_ENABLED: z.enum(["true", "false"]).optional().default("true"),
  AP2_REQUIRE_MANDATE: z.enum(["true", "false"]).optional().default("false"),
  ACP_ENABLED: z.enum(["true", "false"]).optional().default("true"),
  AGTP_ENABLED: z.enum(["true", "false"]).optional().default("true"),
  CONTACT_NOTIFY_EMAIL: z.string().email().optional(),
});

// Known committed/example secret values that MUST be rotated before production.
// If any of these are seen with NODE_ENV=production we refuse to boot.
const INSECURE_COMMITTED_SECRETS = new Set<string>([
  "a2f9c468167f264b43f2f23496d4929354b17cca890887e257e3941e14f8161b",
  "mpp-default-secret-change-in-production",
  "change-me",
  "dev",
  "development",
  "test",
]);

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);

    const isProduction = parsed.NODE_ENV === "production";
    const fatalErrors: string[] = [];
    const warnings: string[] = [];

    if (isProduction) {
      if (!parsed.MPP_SECRET_KEY) {
        fatalErrors.push(
          "MPP_SECRET_KEY is required in production. Generate with: openssl rand -hex 32",
        );
      } else if (INSECURE_COMMITTED_SECRETS.has(parsed.MPP_SECRET_KEY)) {
        fatalErrors.push(
          "MPP_SECRET_KEY matches a known committed/example value. Rotate it before deploying. Generate with: openssl rand -hex 32",
        );
      }

      if (!parsed.RESEND_API_KEY) {
        warnings.push(
          "RESEND_API_KEY is missing. Email delivery will fail and recovery codes will NOT be logged in production.",
        );
      }

      if (!parsed.BACKEND_URL) {
        warnings.push("BACKEND_URL is not set. Webhooks and absolute URLs may default to localhost.");
      }
    } else if (parsed.MPP_SECRET_KEY && INSECURE_COMMITTED_SECRETS.has(parsed.MPP_SECRET_KEY)) {
      warnings.push(
        "MPP_SECRET_KEY is the default committed value — fine in dev, but rotate it before deploying to production.",
      );
    } else if (!parsed.MPP_SECRET_KEY) {
      warnings.push("MPP_SECRET_KEY is not set — using a development fallback. Set this in production.");
    }

    if (warnings.length) {
      for (const w of warnings) console.warn(`⚠️  ${w}`);
    }

    if (fatalErrors.length) {
      console.error("❌ Production environment validation failed:");
      for (const err of fatalErrors) console.error(`  - ${err}`);
      process.exit(1);
    }

    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends Partial<z.infer<typeof envSchema>> {}
  }
}
