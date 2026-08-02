import { NextResponse } from "next/server";
import { BARBER_HAIRSTYLES } from "@/app/lib/hairstyles";
import { IMAGE_RULES, OPENAI_MODELS } from "@/app/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return fail("Analiz servisi yapılandırılmamış.", 500);
    const formData = await request.formData();

const image = formData.get("image");
const rightImage = formData.get("rightImage");
const leftImage = formData.get("leftImage");
const backImage = formData.get("backImage");
const topImage = formData.get("topImage");
    if (!(image instanceof File)) return fail("Fotoğraf gönderilmedi.", 400);
    if (!IMAGE_RULES.acceptedTypes.includes(image.type as never) || image.size > IMAGE_RULES.maxBytes) return fail("Fotoğraf JPG, PNG veya WEBP ve 10 MB'dan küçük olmalıdır.", 400);

    const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
    const names = BARBER_HAIRSTYLES.map((item) => item.name);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODELS.analysis,
        input: [
          { role: "system", content: [{ type: "input_text", text: `Profesyonel bir erkek berberi stil danışmanısın. Yalnızca fotoğrafta açıkça görülen kozmetik özellikleri, kısa ve kullanışlı Türkçe ile değerlendir. Kimlik, yaş, ırk, etnik köken, milliyet, sağlık, kişilik, din, cinsel yönelim veya başka hassas özellikleri çıkarma. Tıbbi teşhis koyma. Emin olmadığın noktaları limitations alanına yaz. Önerileri yalnızca verilen katalogdan seç: ${names.join(", ")}.` }] },
          { role: "user", content: [{ type: "input_text", text: "Görünür yüz formu, alın, çene hattı, mevcut saç ve sakalı değerlendir. Tam olarak beş farklı saç modeli öner; her biri için puan, gerekçe ve berber talimatı ver." }, { type: "input_image", image_url: dataUrl, detail: "high" }] },
        ],
        text: { format: { type: "json_schema", name: "barber_analysis", strict: true, schema: {
          type: "object", properties: {
            faceBox: { type: "object", properties: {
              left: { type: "number", minimum: 0, maximum: 1 }, top: { type: "number", minimum: 0, maximum: 1 },
              right: { type: "number", minimum: 0, maximum: 1 }, bottom: { type: "number", minimum: 0, maximum: 1 },
            }, required: ["left", "top", "right", "bottom"], additionalProperties: false },
            faceShape: { type: "string" }, forehead: { type: "string" }, jawline: { type: "string" },
            existingHair: { type: "string" }, existingBeard: { type: "string" }, beardSuggestion: { type: "string" },
            barberNotes: { type: "array", items: { type: "string" } }, limitations: { type: "array", items: { type: "string" } },
            recommendedHairstyles: { type: "array", minItems: 5, maxItems: 5, items: { type: "object", properties: {
              id: { type: "string", enum: BARBER_HAIRSTYLES.map((item) => item.id) },
              name: { type: "string", enum: names }, suitabilityScore: { type: "integer", minimum: 0, maximum: 100 },
              reason: { type: "string" }, barberInstruction: { type: "string" },
            }, required: ["id", "name", "suitabilityScore", "reason", "barberInstruction"], additionalProperties: false } },
          }, required: ["faceBox", "faceShape", "forehead", "jawline", "existingHair", "existingBeard", "beardSuggestion", "barberNotes", "recommendedHairstyles", "limitations"], additionalProperties: false,
        } } },
      }),
    });
    const data = await response.json();
    if (!response.ok) { console.error("OpenAI analysis error", response.status, data?.error?.code); return fail("Fotoğraf analizi şu anda tamamlanamadı. Lütfen tekrar deneyin.", response.status); }
    const output = data?.output?.flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? []).find((item: { type?: string }) => item.type === "output_text")?.text;
    if (!output) return fail("Analiz servisi boş bir sonuç döndürdü.", 502);
    return NextResponse.json({ success: true, analysis: JSON.parse(output) });
  } catch (error) {
    console.error("Sanal Salon analyze error", error);
    return fail("Beklenmeyen bir analiz hatası oluştu.", 500);
  }
}
