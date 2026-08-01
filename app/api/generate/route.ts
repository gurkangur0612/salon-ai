import { NextResponse } from "next/server";
import { IMAGE_RULES, OPENAI_MODELS } from "@/app/lib/config";
import { findHairstyle, isHairstyleId } from "@/app/lib/hairstyles";
import { buildBarberEditPrompt } from "@/app/lib/prompts";
import type { EditMode } from "@/app/lib/types";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODES: EditMode[] = ["hair", "beard", "hair-and-beard"];

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function readPngInfo(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)) return null;
  const view = new DataView(buffer);
  const width = view.getUint32(16); const height = view.getUint32(20);
  const colorType = bytes[25];
  return { width, height, hasAlpha: colorType === 4 || colorType === 6 };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return fail("Görsel servisi yapılandırılmamış.", 500);

    let body: FormData;
    try { body = await request.formData(); }
    catch { return fail("İstek form verisi geçersiz.", 400); }
    const image = body.get("image"); const mask = body.get("mask");
    const hairstyleId = body.get("hairstyleId"); const editMode = body.get("editMode");
    const beardStyle = body.get("beardStyle"); const barberInstruction = body.get("barberInstruction");
    const imageWidth = Number(body.get("imageWidth")); const imageHeight = Number(body.get("imageHeight"));
    const editableRatio = Number(body.get("editableRatio"));
    const requestId = body.get("requestId");
    const retryStrength = body.get("retryStrength");

    if (!(image instanceof File) || !(mask instanceof File)) return fail("Fotoğraf veya düzenleme maskesi eksik.", 400);
    if (!IMAGE_RULES.acceptedTypes.includes(image.type as never) || image.size > IMAGE_RULES.maxBytes) return fail("Fotoğraf JPG, PNG veya WEBP ve 10 MB'dan küçük olmalıdır.", 400);
    if (mask.type !== "image/png") return fail("Maske PNG formatında olmalıdır.", 400);
    if (typeof editMode !== "string" || !MODES.includes(editMode as EditMode)) return fail("Geçersiz düzenleme modu.", 400);
    if (editMode !== "beard" && (typeof hairstyleId !== "string" || !isHairstyleId(hairstyleId))) return fail("Geçerli bir saç modeli seçin.", 400);
    if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth < 64 || imageHeight < 64) return fail("Fotoğraf boyut bilgisi geçersiz.", 400);
    if (!Number.isFinite(editableRatio) || editableRatio < 0.003 || editableRatio > 0.38) return fail("Maske güvenli düzenleme sınırlarını karşılamıyor.", 400);
    const maskBuffer = await mask.arrayBuffer();
    const maskInfo = readPngInfo(maskBuffer);
    if (!maskInfo || !maskInfo.hasAlpha || maskInfo.width !== imageWidth || maskInfo.height !== imageHeight) return fail("Maske ile fotoğraf boyutları veya alfa kanalı eşleşmiyor.", 400);
    const imageInfo = readPngInfo(await image.arrayBuffer());
    if (!imageInfo || imageInfo.width !== imageWidth || imageInfo.height !== imageHeight) return fail("Normalize fotoğraf ile maske piksel boyutları eşleşmiyor.", 400);

    const hairstyle = typeof hairstyleId === "string" ? findHairstyle(hairstyleId) : undefined;
    let prompt = buildBarberEditPrompt({
      hairstyleName: hairstyle?.name,
      hairstyleDescription: hairstyle?.description,
      editMode: editMode as EditMode,
      beardStyle: typeof beardStyle === "string" ? beardStyle.slice(0, 160) : undefined,
      barberInstruction: typeof barberInstruction === "string" ? barberInstruction.slice(0, 300) : undefined,
    });
    if (retryStrength === "maximum") prompt += "\n\nMANDATORY RETRY CORRECTION:\nThe prior edit was too subtle. Completely replace the existing hairstyle geometry inside the transparent region. Create an unmistakable silhouette change with clearly different top direction, fringe/front shape, volume and side lengths. This is a haircut reconstruction, not a retouch. Do not return a hairstyle resembling the input.";
    console.info("[Sanal Salon] OpenAI image edit request", {
      hairstyleId,
      hairstyleName: hairstyle?.name,
      barberInstruction,
      editMode,
      finalPrompt: prompt,
      editableRatio,
      requestId,
      imageSize: `${imageWidth}x${imageHeight}`,
    });
    let debugArtifacts: { maskPath: string; promptPath: string } | undefined;
    if (process.env.NODE_ENV === "development") {
      const debugDirectory = path.join(process.cwd(), "debug-output");
      await mkdir(debugDirectory, { recursive: true });
      const modeName = String(editMode);
      const maskPath = path.join(debugDirectory, `latest-${modeName}-mask.png`);
      const promptPath = path.join(debugDirectory, `latest-${modeName}-prompt.txt`);
      await Promise.all([
        writeFile(maskPath, Buffer.from(maskBuffer)),
        writeFile(promptPath, `hairstyleId=${String(hairstyleId)}\nresolvedHairstyle=${hairstyle?.name ?? "none"}\neditMode=${modeName}\neditableRatio=${editableRatio}\nsize=${imageWidth}x${imageHeight}\n\n${prompt}\n`, "utf8"),
      ]);
      debugArtifacts = { maskPath, promptPath };
    }
    const openAIForm = new FormData();
    openAIForm.append("model", OPENAI_MODELS.imageEdit);
    openAIForm.append("image[]", image, image.name || "portrait.jpg");
    openAIForm.append("mask", mask, "mask.png");
    openAIForm.append("prompt", prompt);
    openAIForm.append("output_format", "png");
    openAIForm.append("quality", "high");
    openAIForm.append("size", `${imageWidth}x${imageHeight}`);

    const response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: openAIForm });
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI image edit error", response.status, data?.error?.code);
      return fail(process.env.NODE_ENV === "development" && data?.error?.message
        ? `OpenAI edit hatası: ${data.error.message}`
        : "Önizleme şu anda oluşturulamadı. Lütfen biraz sonra tekrar deneyin.", response.status);
    }
    const base64 = data?.data?.[0]?.b64_json;
    if (!base64) return fail("Görsel servisi boş bir sonuç döndürdü.", 502);

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${base64}`,
      debug: process.env.NODE_ENV === "development" ? { imageWidth, imageHeight, maskWidth: maskInfo.width, maskHeight: maskInfo.height, editableRatio, hairstyleId, resolvedHairstyle: hairstyle?.name, prompt, debugArtifacts } : undefined,
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error("Sanal Salon generate error", error);
    return fail("Beklenmeyen bir sunucu hatası oluştu.", 500);
  }
}
