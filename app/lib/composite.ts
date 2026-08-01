import type { EditMode, FaceBox, PreservationMetrics } from "./types";

function loadSource(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
    image.onload = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error("Sonuç görseli birleştirilemedi.")); };
    image.src = typeof source === "string" ? source : objectUrl!;
  });
}

function sameRgb(a: Uint8ClampedArray, b: Uint8ClampedArray, index: number) {
  return a[index] === b[index] && a[index + 1] === b[index + 1] && a[index + 2] === b[index + 2];
}

function regionPreservation(
  original: Uint8ClampedArray,
  final: Uint8ClampedArray,
  width: number,
  height: number,
  region: { left: number; top: number; right: number; bottom: number },
) {
  const isNormalized =
  region.left >= 0 &&
  region.top >= 0 &&
  region.right <= 1 &&
  region.bottom <= 1;

const left = Math.max(
  0,
  Math.floor(isNormalized ? region.left * width : region.left),
);
const right = Math.min(
  width,
  Math.ceil(isNormalized ? region.right * width : region.right),
);
const top = Math.max(
  0,
  Math.floor(isNormalized ? region.top * height : region.top),
);
const bottom = Math.min(
  height,
  Math.ceil(isNormalized ? region.bottom * height : region.bottom),
);
  let total = 0; let equal = 0;
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
    const index = (y * width + x) * 4; total += 1;
    if (sameRgb(original, final, index)) equal += 1;
  }
  return total ? equal / total : 0;
}

export async function compositeImages(input: {
  original: Blob;
  editedDataUrl: string;
  mask: Blob;
  faceBox: FaceBox;
  mode: EditMode;
}): Promise<{ dataUrl: string; metrics: PreservationMetrics }> {
  const [originalImage, editedImage, maskImage] = await Promise.all([
    loadSource(input.original), loadSource(input.editedDataUrl), loadSource(input.mask),
  ]);
  const width = originalImage.naturalWidth; const height = originalImage.naturalHeight;
  if (
    editedImage.naturalWidth !== width || editedImage.naturalHeight !== height ||
    maskImage.naturalWidth !== width || maskImage.naturalHeight !== height
  ) throw new Error(`Görsel boyutları eşleşmiyor: orijinal ${width}×${height}, ham sonuç ${editedImage.naturalWidth}×${editedImage.naturalHeight}, maske ${maskImage.naturalWidth}×${maskImage.naturalHeight}.`);

  const read = (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height);
  };
  const originalPixels = read(originalImage);
  const editedPixels = read(editedImage);
  const maskPixels = read(maskImage);
  const finalPixels = new ImageData(new Uint8ClampedArray(originalPixels.data), width, height);

  let protectedTotal = 0; let protectedEqual = 0; let rawFinalChanged = 0;
  let editableTotal = 0; let editableChanged = 0;
  for (let index = 0; index < finalPixels.data.length; index += 4) {
    const alpha = maskPixels.data[index + 3];
    const editWeight = 1 - alpha / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      finalPixels.data[index + channel] = editWeight === 0
        ? originalPixels.data[index + channel]
        : editWeight === 1
          ? editedPixels.data[index + channel]
          : Math.round(originalPixels.data[index + channel] * (1 - editWeight) + editedPixels.data[index + channel] * editWeight);
    }
    finalPixels.data[index + 3] = originalPixels.data[index + 3];
    if (alpha === 255) {
      protectedTotal += 1;
      if (sameRgb(originalPixels.data, finalPixels.data, index)) protectedEqual += 1;
    }
    if (alpha === 0) {
      editableTotal += 1;
      const meaningfulDelta = Math.max(
        Math.abs(originalPixels.data[index] - finalPixels.data[index]),
        Math.abs(originalPixels.data[index + 1] - finalPixels.data[index + 1]),
        Math.abs(originalPixels.data[index + 2] - finalPixels.data[index + 2]),
      );
      if (meaningfulDelta > 12) editableChanged += 1;
    }
    if (!sameRgb(editedPixels.data, finalPixels.data, index)) rawFinalChanged += 1;
  }

  const face = input.faceBox;
  const faceWidth = face.right - face.left; const faceHeight = face.bottom - face.top;
  const faceCenter = {
    left: face.left + faceWidth * 0.14, right: face.right - faceWidth * 0.14,
    top: face.top + faceHeight * 0.22, bottom: face.bottom - faceHeight * 0.12,
  };
  const beardRegion = {
    left: face.left + faceWidth * 0.12, right: face.right - faceWidth * 0.12,
    top: face.top + faceHeight * 0.56, bottom: face.bottom,
  };
  const metrics: PreservationMetrics = {
    protectedPixelPreservation: protectedTotal ? protectedEqual / protectedTotal : 0,
    faceCenterPreservation: regionPreservation(originalPixels.data, finalPixels.data, width, height, faceCenter),
    beardRegionPreservation: regionPreservation(originalPixels.data, finalPixels.data, width, height, beardRegion),
    editableRegionChangedPixels: editableTotal ? editableChanged / editableTotal : 0,
    rawToFinalChangedPixels: rawFinalChanged / (width * height), width, height,
  };
  if (input.mode === "hair" && (
    metrics.protectedPixelPreservation < 0.995 ||
    metrics.faceCenterPreservation < 0.998 ||
    metrics.beardRegionPreservation < 0.998
  )) throw new Error(`Kimlik koruma doğrulaması başarısız: korunan %${(metrics.protectedPixelPreservation * 100).toFixed(3)}, yüz %${(metrics.faceCenterPreservation * 100).toFixed(3)}, sakal %${(metrics.beardRegionPreservation * 100).toFixed(3)}.`);

  const output = document.createElement("canvas"); output.width = width; output.height = height;
  output.getContext("2d")!.putImageData(finalPixels, 0, 0);
  return { dataUrl: output.toDataURL("image/png"), metrics };
}
