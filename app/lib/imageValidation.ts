import { IMAGE_RULES } from "./config";

export function validateImageFile(file: File): string | null {
  if (!IMAGE_RULES.acceptedTypes.includes(file.type as (typeof IMAGE_RULES.acceptedTypes)[number])) {
    return "Lütfen JPG, PNG veya WEBP formatında bir fotoğraf seçin.";
  }
  if (file.size > IMAGE_RULES.maxBytes) return "Fotoğraf 10 MB'dan küçük olmalıdır.";
  if (file.size === 0) return "Fotoğraf dosyası boş görünüyor.";
  return null;
}
