import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI API anahtarı bulunamadı.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    const image = formData.get("image");
    const hairstyle = formData.get("hairstyle");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Fotoğraf gönderilmedi.",
        },
        { status: 400 }
      );
    }

    if (typeof hairstyle !== "string" || !hairstyle.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Saç modeli seçilmedi.",
        },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Fotoğraf JPG, PNG veya WEBP formatında olmalıdır.",
        },
        { status: 400 }
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "Fotoğraf 10 MB'dan küçük olmalıdır.",
        },
        { status: 400 }
      );
    }

    const prompt = `
Edit the uploaded portrait so the person has a realistic ${hairstyle} haircut.

Preserve the person's identity, facial features, skin tone, beard, expression,
ears, head shape, skull proportions, camera angle, lighting, clothing and background.

Change only the scalp hair and hairstyle.

Keep a natural hairline, realistic hair strands, believable volume and accurate
three-dimensional head proportions.

Do not sharpen or reshape the face.
Do not make the jawline more angular.
Do not flatten or enlarge the head.
Do not change the person's age or identity.
Do not add text, logos, watermarks, accessories or additional people.

Create a photorealistic professional barber consultation preview.
    `.trim();

    const openAIFormData = new FormData();

    openAIFormData.append("model", "gpt-image-1.5");
    openAIFormData.append("image[]", image, image.name || "portrait.jpg");
    openAIFormData.append("prompt", prompt);
    openAIFormData.append("input_fidelity", "high");
    openAIFormData.append("quality", "low");
    openAIFormData.append("size", "1024x1024");
    openAIFormData.append("output_format", "jpeg");
    openAIFormData.append("output_compression", "85");

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
        {
          success: false,
          error: message,
        },
        { status: openAIResponse.status }
      );
    }

    const base64Image = openAIData?.data?.[0]?.b64_json;

    if (!base64Image) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI oluşturulan görseli göndermedi.",
        },
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