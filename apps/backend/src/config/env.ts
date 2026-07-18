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

  /** Validasi LLM config — true if all required LLM env vars are set */
  llmConfigured: (): boolean => {
    return !!(Bun.env.AI_LLM_API_KEY && Bun.env.AI_LLM_BASE_URL && Bun.env.AI_LLM_MODEL);
  },

  // S3 / Object Storage
  s3Endpoint: Bun.env.S3_ENDPOINT || "",
  s3AccessKey: Bun.env.S3_ACCESS_KEY || "",
  s3SecretKey: Bun.env.S3_SECRET_KEY || "",
  s3Region: Bun.env.S3_DEFAULT_REGION || "us-east-1",
  s3Bucket: Bun.env.S3_BUCKET || "lsar",

  /** Validasi S3 config */
  s3Configured: (): boolean => {
    return !!(Bun.env.S3_ENDPOINT && Bun.env.S3_ACCESS_KEY && Bun.env.S3_SECRET_KEY);
  },

  // Analytics / Clustering
  clusteringEnabled: Bun.env.CLUSTERING_ENABLED === "true",
  modelPath: Bun.env.MODEL_PATH || "./models",
  clusterRetrainIntervalMs: parseInt(Bun.env.CLUSTER_RETRAIN_INTERVAL || "21600000", 10),
};
