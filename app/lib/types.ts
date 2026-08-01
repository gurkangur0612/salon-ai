export type EditMode = "hair" | "beard" | "hair-and-beard";

export interface FaceBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PreservationMetrics {
  protectedPixelPreservation: number;
  faceCenterPreservation: number;
  beardRegionPreservation: number;
  editableRegionChangedPixels: number;
  rawToFinalChangedPixels: number;
  width: number;
  height: number;
}

export interface HairstyleRecommendation {
  id: string;
  name: string;
  suitabilityScore: number;
  reason: string;
  barberInstruction: string;
}

export interface BarberAnalysis {
  faceBox: FaceBox;
  faceShape: string;
  forehead: string;
  jawline: string;
  existingHair: string;
  existingBeard: string;
  beardSuggestion: string;
  barberNotes: string[];
  recommendedHairstyles: HairstyleRecommendation[];
  limitations: string[];
}
