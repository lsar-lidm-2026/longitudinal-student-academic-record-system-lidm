export const env = {
  port: parseInt(Bun.env.PORT || "3001", 10),
  databaseUrl: Bun.env.DATABASE_URL || "postgres://asephs:hunterz@100.108.1.124:5432/lidm",

  // JWT
  jwtSecret: Bun.env.JWT_SECRET || "lsar-dev-secret-min-32-chars!!",
  jwtExpiresIn: Bun.env.JWT_EXPIRES_IN || "7d",

  // LLM — custom endpoint (OpenAI-compatible)
  llmApiKey: Bun.env.AI_LLM_API_KEY || Bun.env.LLM_API_KEY || "",
  llmBaseUrl: Bun.env.AI_LLM_BASE_URL || "https://9router.asepharyana.my.id/v1",
  llmModel: Bun.env.AI_LLM_MODEL || Bun.env.LLM_MODEL || "gpt-4o-mini",

  // ML
  mlEnabled: Bun.env.ML_ENABLED === "true",
  mlModelPath: Bun.env.ML_MODEL_PATH || "./models",
};
