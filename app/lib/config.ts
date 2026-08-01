export const OPENAI_MODELS = {
  analysis: "gpt-5-mini",
  imageEdit: "gpt-image-2",
} as const;

export const IMAGE_RULES = {
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 10 * 1024 * 1024,
} as const;
