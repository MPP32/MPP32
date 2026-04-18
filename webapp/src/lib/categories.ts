// Single source of truth for submission categories.
// Values MUST match the backend enum in backend/src/types.ts (SUBMISSION_CATEGORIES).
// When adding/removing categories, update both this file and the backend enum.

export type CategoryGroup =
  | "AI & Machine Learning"
  | "Data & Intelligence"
  | "Crypto / Web3"
  | "Utility"
  | "Business"
  | "Developer Tools"
  | "Media & Entertainment"
  | "Other";

export interface Category {
  value: string; // kebab-case slug, matches backend enum
  label: string; // user-facing display name
  group: CategoryGroup;
}

// Ordered by group, alphabetical within each group.
export const CATEGORIES: Category[] = [
  // AI & Machine Learning
  { value: "ai-inference", label: "AI Inference / LLM", group: "AI & Machine Learning" },
  { value: "embeddings", label: "Embeddings", group: "AI & Machine Learning" },
  { value: "image-analysis", label: "Image Analysis / Vision", group: "AI & Machine Learning" },
  { value: "image-generation", label: "Image Generation", group: "AI & Machine Learning" },
  { value: "sentiment-analysis", label: "Sentiment Analysis", group: "AI & Machine Learning" },
  { value: "speech-stt", label: "Speech-to-Text (STT)", group: "AI & Machine Learning" },
  { value: "speech-tts", label: "Text-to-Speech (TTS)", group: "AI & Machine Learning" },
  { value: "summarization", label: "Summarization", group: "AI & Machine Learning" },
  { value: "translation", label: "Translation", group: "AI & Machine Learning" },

  // Data & Intelligence
  { value: "financial-data", label: "Financial Data", group: "Data & Intelligence" },
  { value: "geolocation", label: "Geolocation", group: "Data & Intelligence" },
  { value: "market-data", label: "Market Data", group: "Data & Intelligence" },
  { value: "news-feed", label: "News Feed", group: "Data & Intelligence" },
  { value: "real-estate", label: "Real Estate", group: "Data & Intelligence" },
  { value: "social-data", label: "Social Data", group: "Data & Intelligence" },
  { value: "sports-data", label: "Sports Data", group: "Data & Intelligence" },
  { value: "weather", label: "Weather", group: "Data & Intelligence" },
  { value: "web-scraping", label: "Web Scraping", group: "Data & Intelligence" },
  { value: "web-search", label: "Web Search", group: "Data & Intelligence" },

  // Crypto / Web3
  { value: "defi-analytics", label: "DeFi Analytics", group: "Crypto / Web3" },
  { value: "nft-intelligence", label: "NFT Intelligence", group: "Crypto / Web3" },
  { value: "on-chain-data", label: "On-Chain Data", group: "Crypto / Web3" },
  { value: "price-oracle", label: "Price Oracle", group: "Crypto / Web3" },
  { value: "risk-compliance", label: "Risk / Compliance", group: "Crypto / Web3" },
  { value: "token-scanner", label: "Token Scanner", group: "Crypto / Web3" },
  { value: "trading-signal", label: "Trading Signal", group: "Crypto / Web3" },
  { value: "wallet-intelligence", label: "Wallet Intelligence", group: "Crypto / Web3" },

  // Utility
  { value: "document-parsing", label: "Document Parsing", group: "Utility" },
  { value: "email-verification", label: "Email Verification", group: "Utility" },
  { value: "fraud-detection", label: "Fraud Detection", group: "Utility" },
  { value: "identity-kyc", label: "Identity / KYC", group: "Utility" },
  { value: "ocr", label: "OCR", group: "Utility" },
  { value: "phone-verification", label: "Phone Verification", group: "Utility" },
  { value: "sms-messaging", label: "SMS / Messaging", group: "Utility" },

  // Business
  { value: "advertising-data", label: "Advertising Data", group: "Business" },
  { value: "analytics", label: "Analytics", group: "Business" },
  { value: "crm-lookup", label: "CRM Lookup", group: "Business" },
  { value: "data-enrichment", label: "Data Enrichment (People / Company)", group: "Business" },
  { value: "seo-tools", label: "SEO Tools", group: "Business" },

  // Developer Tools
  { value: "code-intelligence", label: "Code Intelligence", group: "Developer Tools" },
  { value: "security-scanning", label: "Security Scanning", group: "Developer Tools" },
  { value: "uptime-monitoring", label: "Uptime Monitoring", group: "Developer Tools" },

  // Media & Entertainment
  { value: "gaming-data", label: "Gaming Data", group: "Media & Entertainment" },
  { value: "music-media", label: "Music / Media", group: "Media & Entertainment" },
  { value: "sports-odds", label: "Sports Odds", group: "Media & Entertainment" },

  // Other
  { value: "data-feed", label: "Data Feed", group: "Other" },
  { value: "other", label: "Other", group: "Other" },
];

// Ordered list of groups — use this to render sections in order.
export const CATEGORY_GROUPS: CategoryGroup[] = [
  "AI & Machine Learning",
  "Data & Intelligence",
  "Crypto / Web3",
  "Utility",
  "Business",
  "Developer Tools",
  "Media & Entertainment",
  "Other",
];

// Fast lookup by slug.
const CATEGORY_BY_VALUE: Record<string, Category> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.value] = c;
    return acc;
  },
  {} as Record<string, Category>
);

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function getCategoryLabel(value: string): string {
  const found = CATEGORY_BY_VALUE[value];
  if (found !== undefined) return found.label;
  return humanizeSlug(value);
}

export function getCategoryGroup(value: string): CategoryGroup | undefined {
  return CATEGORY_BY_VALUE[value]?.group;
}

export function getCategoriesByGroup(group: CategoryGroup): Category[] {
  return CATEGORIES.filter((c) => c.group === group);
}
