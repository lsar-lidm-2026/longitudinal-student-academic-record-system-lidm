export const env = {
  port: parseInt(Bun.env.PORT || "3001", 10),
  databaseUrl: Bun.env.DATABASE_URL || "",

  // JWT — wajib di .env
  jwtSecret: Bun.env.JWT_SECRET || "",
  jwtExpiresIn: Bun.env.JWT_EXPIRES_IN || "7d",

  // LLM — custom endpoint (OpenAI-compatible)
  llmApiKey: Bun.env.AI_LLM_API_KEY || "",
  llmBaseUrl: Bun.env.AI_LLM_BASE_URL || "",
  llmModel: Bun.env.AI_LLM_MODEL || "",

  // Analytics / Clustering
  clusteringEnabled: Bun.env.CLUSTERING_ENABLED === "true",
  modelPath: Bun.env.MODEL_PATH || "./models",
  clusterRetrainIntervalMs: parseInt(Bun.env.CLUSTER_RETRAIN_INTERVAL || "21600000", 10),
};
