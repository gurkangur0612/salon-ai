import type { EditMode, FaceBox } from "./types";
import { getHairMaskProfile } from "./hairstyles";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL = "/mediapipe/wasm";

type Point = { x: number; y: number };
export type MaskResult = {
  blob: Blob;
  previewUrl: string;
  overlayUrl: string;
  normalizedImage: Blob;
  normalizedPreviewUrl: string;
  width: number;
  height: number;
  editableRatio: number;
  opaqueRatio: number;
  featherRatio: number;
  warning: "mask too narrow" | "mask too wide" | null;
};

let landmarkerPromise: Promise<import("@mediapipe/tasks-vision").FaceLandmarker> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        numFaces: 2,
      });
    })();
  }
  return landmarkerPromise;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Fotoğraf tarayıcıda açılamadı.")); };
    image.src = url;
  });
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
  ctx.fill();
}

function bounds(points: Point[], width: number, height: number) {
  const xs = points.map((point) => point.x * width);
  const ys = points.map((point) => point.y * height);
  const left = Math.min(...xs); const right = Math.max(...xs);
  const top = Math.min(...ys); const bottom = Math.max(...ys);
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Maske PNG olarak hazırlanamadı.")),
    "image/png",
  ));
}

function makeOverlay(image: HTMLCanvasElement, mask: HTMLCanvasElement) {
  const overlay = document.createElement("canvas");
  overlay.width = mask.width; overlay.height = mask.height;
  const ctx = overlay.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const maskPixels = mask.getContext("2d")!.getImageData(0, 0, mask.width, mask.height);
  const red = ctx.getImageData(0, 0, mask.width, mask.height);
  for (let i = 0; i < red.data.length; i += 4) {
    const editWeight = 1 - maskPixels.data[i + 3] / 255;
    red.data[i] = Math.round(red.data[i] * (1 - editWeight * 0.55) + 239 * editWeight * 0.55);
    red.data[i + 1] = Math.round(red.data[i + 1] * (1 - editWeight * 0.55) + 68 * editWeight * 0.55);
    red.data[i + 2] = Math.round(red.data[i + 2] * (1 - editWeight * 0.55) + 68 * editWeight * 0.55);
  }
  ctx.putImageData(red, 0, 0);
  return overlay.toDataURL("image/png");
}

function normalizedDimensions(width: number, height: number) {
  let scale = Math.min(1, 2048 / Math.max(width, height));
  let targetWidth = Math.max(16, Math.round((width * scale) / 16) * 16);
  let targetHeight = Math.max(16, Math.round((height * scale) / 16) * 16);
  const minimumPixels = 655_360;
  if (targetWidth * targetHeight < minimumPixels) {
    scale *= Math.sqrt(minimumPixels / (targetWidth * targetHeight));
    targetWidth = Math.round((width * scale) / 16) * 16;
    targetHeight = Math.round((height * scale) / 16) * 16;
  }
  return { width: targetWidth, height: targetHeight };
}

export async function createHairBeardMask(
  imageFile: File | Blob,
  mode: EditMode,
  fallbackFaceBox?: FaceBox,
  hairstyleId?: string,
): Promise<MaskResult> {
  if (typeof window === "undefined") throw new Error("Maske yalnızca tarayıcıda hazırlanabilir.");
  const image = await loadImage(imageFile);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Fotoğraf boyutları okunamadı.");
  const { width, height } = normalizedDimensions(image.naturalWidth, image.naturalHeight);

  // Drawing the browser-decoded image normalizes EXIF orientation. This exact
  // PNG is sent to OpenAI and later used for pixel-for-pixel compositing.
  const normalized = document.createElement("canvas");
  normalized.width = width; normalized.height = height;
  normalized.getContext("2d")!.drawImage(image, 0, 0, width, height);
  const normalizedImage = await canvasBlob(normalized);
  const normalizedPreviewUrl = normalized.toDataURL("image/png");

  let landmarkPoints: Point[] | null = null;
  if (fallbackFaceBox) {
    const { left, top, right, bottom } = fallbackFaceBox;
    if ([left, top, right, bottom].every(Number.isFinite) && left < right && top < bottom) {
      landmarkPoints = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
    }
  }
  if (!landmarkPoints) {
    try {
      const detector = await getLandmarker();
      const result = detector.detect(image);
      if (result.faceLandmarks.length > 1) throw new Error("Birden fazla yüz algılandı. Lütfen tek kişi içeren bir fotoğraf yükleyin.");
      landmarkPoints = result.faceLandmarks[0] ?? null;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Birden fazla")) throw error;
    }
  }
  if (!landmarkPoints) throw new Error("Fotoğrafta yüz bulunamadı. Önce Berber Danışmanı analizini çalıştırın.");

  const face = bounds(landmarkPoints, width, height);
  const faceRatio = (face.width * face.height) / (width * height);
  if (faceRatio < 0.035) throw new Error("Yüz fotoğrafta çok küçük. Daha yakın çekilmiş bir portre yükleyin.");

  const mask = document.createElement("canvas");
  mask.width = width; mask.height = height;
  const ctx = mask.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.filter = "blur(3px)";
  // destination-out uses the source alpha as its eraser strength; the source
  // must therefore be opaque to produce a genuinely transparent edit area.
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.globalCompositeOperation = "destination-out";

  const cx = (face.left + face.right) / 2;
  if (mode === "hair" || mode === "hair-and-beard") {
    const profile = getHairMaskProfile(hairstyleId);
    // Model-specific room for top volume, forward fringe and narrow side fades.
    ellipse(ctx, cx, face.top - face.height * profile.verticalOffset, face.width * profile.horizontalRadius, face.height * profile.verticalRadius);
  }
  if (mode === "beard" || mode === "hair-and-beard") {
    ellipse(ctx, cx, face.top + face.height * 0.73, face.width * 0.39, face.height * 0.31);
  }
  ctx.restore();

  // Re-protect the face. Hair-only mode explicitly seals the full beard,
  // moustache, skin, forehead, facial features and jaw region.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255,255,255,1)";
  if (mode === "hair") {
    ellipse(ctx, cx, face.top + face.height * 0.53, face.width * 0.49, face.height * 0.53);
  } else {
    ellipse(ctx, cx, face.top + face.height * 0.4, face.width * 0.38, face.height * 0.32);
    ellipse(ctx, cx, face.top + face.height * 0.68, face.width * 0.17, face.height * 0.11);
  }
  ellipse(ctx, face.left + face.width * 0.02, face.top + face.height * 0.48, face.width * 0.1, face.height * 0.22);
  ellipse(ctx, face.right - face.width * 0.02, face.top + face.height * 0.48, face.width * 0.1, face.height * 0.22);

  const pixels = ctx.getImageData(0, 0, width, height);
  let transparent = 0; let opaque = 0; let feather = 0;
  for (let i = 3; i < pixels.data.length; i += 4) {
    if (pixels.data[i] === 0) transparent += 1;
    if (pixels.data[i] === 255) opaque += 1;
    if (pixels.data[i] > 0 && pixels.data[i] < 255) feather += 1;
  }
  const editableRatio = transparent / (width * height);
  if (!transparent || !opaque || editableRatio < 0.003 || editableRatio > 0.38) {
    throw new Error("Güvenli bir saç/sakal maskesi oluşturulamadı. Başka bir portre deneyin.");
  }

  const pixelCount = width * height;
  const warning = mode !== "beard" && editableRatio < 0.05
    ? "mask too narrow"
    : mode !== "beard" && editableRatio > 0.25
      ? "mask too wide"
      : null;
  return {
    blob: await canvasBlob(mask), previewUrl: makeOverlay(normalized, mask), overlayUrl: makeOverlay(normalized, mask), normalizedImage, normalizedPreviewUrl,
    width, height, editableRatio, opaqueRatio: opaque / pixelCount, featherRatio: feather / pixelCount, warning,
  };
}
