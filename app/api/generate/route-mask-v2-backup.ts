import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "OpenAI API anahtarı bulunamadı." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const hairstyle = formData.get("hairstyle");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Fotoğraf gönderilmedi." },
        { status: 400 }
      );
    }

    if (typeof hairstyle !== "string" || !hairstyle.trim()) {
      return NextResponse.json(
        { success: false, error: "Saç modeli seçilmedi." },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        { success: false, error: "Fotoğraf JPG, PNG veya WEBP olmalıdır." },
        { status: 400 }
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Fotoğraf 10 MB'dan küçük olmalıdır." },
        { status: 400 }
      );
    }

    const prompt = `
Create a photorealistic barber consultation edit of the uploaded portrait.

PRIMARY TASK:
Change only the scalp hair into a realistic ${hairstyle} haircut.

IDENTITY LOCK — MUST REMAIN UNCHANGED:
- Keep the exact same person and identity.
- Preserve the exact face geometry and facial proportions.
- Preserve eyes, eyebrows, nose, lips, cheeks, jawline, chin, forehead, ears and skin texture.
- Preserve facial expression, gaze direction, age, skin tone, facial hair and beard.
- Preserve skull size, head width, head depth and three-dimensional head shape.
- Preserve camera angle, pose, lighting, clothing and background.

HAIR EDIT RULES:
- Modify only the hair above the natural hairline and the side/back scalp hair.
- Keep the natural hairline position and temple shape.
- Use realistic individual hair strands, believable density and natural volume.
- Make the haircut anatomically consistent with the existing head shape.
- Blend side transitions naturally without changing ears, forehead or face.

STRICTLY FORBIDDEN:
- Do not beautify, retouch, smooth or sharpen the face.
- Do not make the jawline sharper or wider.
- Do not change nose size, eye shape, lip shape or facial symmetry.
- Do not flatten, enlarge, narrow or reshape the head.
- Do not change body, clothing, background or image composition.
- Do not add text, logos, watermarks, accessories or extra people.

The final image must look like the original unedited photo with only the hairstyle changed.
    `.trim();

    const openAIFormData = new FormData();

    openAIFormData.append("model", "gpt-image-2");
    openAIFormData.append("image[]", image, image.name || "portrait.jpg");
    openAIFormData.append("prompt", prompt);
    openAIFormData.append("output_format", "jpeg");
    openAIFormData.append("output_compression", "90");

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: openAIFormData,
      }
    );

    const openAIData = await openAIResponse.json();

    if (!openAIResponse.ok) {
      const message =
        openAIData?.error?.message ||
        "OpenAI görsel oluşturma işlemi başarısız oldu.";

      return NextResponse.json(
        { success: false, error: message },
        { status: openAIResponse.status }
      );
    }

    const base64Image = openAIData?.data?.[0]?.b64_json;

    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: "OpenAI oluşturulan görseli göndermedi." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      image: `data:image/jpeg;base64,${base64Image}`,
    });
  } catch (error) {
    console.error("SalonAI API hatası:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Beklenmeyen bir sunucu hatası oluştu.",
      },
      { status: 500 }
    );
  }
}
