export const BARBER_HAIRSTYLES = [
  { id: "buzz-cut", name: "Buzz Cut", description: "Kısa, sade ve bakımı kolay; baş formunu öne çıkarır." },
  { id: "low-fade", name: "Low Fade", description: "Kulak çevresinden başlayan yumuşak ve doğal geçiş." },
  { id: "mid-fade", name: "Mid Fade", description: "Dengeli, modern ve belirgin orta seviye geçiş." },
  { id: "high-fade", name: "High Fade", description: "Yanlarda yüksekten başlayan keskin ve güçlü görünüm." },
  { id: "french-crop", name: "French Crop", description: "Kısa üst, dokulu yapı ve öne yönlenen perçem." },
  { id: "crew-cut", name: "Crew Cut", description: "Klasik, düzenli ve kolay şekillenen kısa kesim." },
  { id: "quiff", name: "Quiff", description: "Ön bölümü hacimli, yukarı ve geriye şekillenen model." },
  { id: "pompadour", name: "Pompadour", description: "Önde kontrollü yükseklik ve klasik hacim." },
  { id: "slick-back", name: "Slick Back", description: "Saçın geriye tarandığı temiz ve şık görünüm." },
  { id: "undercut", name: "Undercut", description: "Kısa yanlar ile daha uzun üst arasında güçlü kontrast." },
] as const;

export type HairstyleId = (typeof BARBER_HAIRSTYLES)[number]["id"];

export type HairMaskProfile = {
  horizontalRadius: number;
  verticalRadius: number;
  verticalOffset: number;
};

const DEFAULT_HAIR_MASK_PROFILE: HairMaskProfile = {
  horizontalRadius: 0.76,
  verticalRadius: 0.65,
  verticalOffset: 0.18,
};

export const HAIR_MASK_PROFILES: Partial<Record<HairstyleId, HairMaskProfile>> = {
  "french-crop": { horizontalRadius: 0.84, verticalRadius: 0.69, verticalOffset: 0.20 },
  quiff: { horizontalRadius: 0.82, verticalRadius: 0.78, verticalOffset: 0.25 },
  undercut: { horizontalRadius: 0.84, verticalRadius: 0.66, verticalOffset: 0.18 },
  "low-fade": { horizontalRadius: 0.74, verticalRadius: 0.60, verticalOffset: 0.13 },
};

export function getHairMaskProfile(id?: string): HairMaskProfile {
  return id && isHairstyleId(id) ? HAIR_MASK_PROFILES[id] ?? DEFAULT_HAIR_MASK_PROFILE : DEFAULT_HAIR_MASK_PROFILE;
}

export const BARBER_HAIRSTYLE_NAMES = BARBER_HAIRSTYLES.map((style) => style.name);

export function findHairstyle(id: string) {
  return BARBER_HAIRSTYLES.find((style) => style.id === id);
}

export function isHairstyleId(value: string): value is HairstyleId {
  return BARBER_HAIRSTYLES.some((style) => style.id === value);
}
