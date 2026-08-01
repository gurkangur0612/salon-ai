import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Fotoğraf gönderilmedi.",
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

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageDataUrl = `data:${image.type};base64,${imageBuffer.toString(
      "base64"
    )}`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini",

          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: `
You are a professional barber consultation assistant.

Analyze only clearly visible physical characteristics in the portrait.

Do not identify the person.
Do not guess ethnicity, nationality, health, personality or sensitive traits.
Do not claim certainty when the image angle or lighting is insufficient.

Recommend hairstyles only from this allowed list:

Buzz Cut
Low Fade
Mid Fade
High Fade
French Crop
Crew Cut
Quiff
Pompadour
Slick Back
Undercut

Return all explanations in Turkish.

The analysis is an approximate cosmetic consultation, not a scientific or medical assessment.
                  `.trim(),
                },
              ],
            },

            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `
Analyze the visible face shape, forehead proportions and jawline.

Provide one short beard suggestion.

Recommend exactly five hairstyles from the allowed hairstyle list, ordered from most suitable to least suitable.

Keep every answer short, clear and useful for a barber.
                  `.trim(),
                },

                {
                  type: "input_image",
                  image_url: imageDataUrl,
                  detail: "high",
                },
              ],
            },
          ],

          text: {
            format: {
              type: "json_schema",
              name: "barber_analysis",
              strict: true,

              schema: {
                type: "object",

                properties: {
                  faceShape: {
                    type: "string",
                    description:
                      "Fotoğrafta görülen yaklaşık yüz şekli.",
                  },

                  forehead: {
                    type: "string",
                    description:
                      "Alın genişliği ve oranı hakkında kısa açıklama.",
                  },

                  jawline: {
                    type: "string",
                    description:
                      "Çene hattı hakkında kısa ve tarafsız açıklama.",
                  },

                  beardSuggestion: {
                    type: "string",
                    description:
                      "Yüz görünümüne uygun kısa sakal önerisi.",
                  },

                  recommendedHairstyles: {
                    type: "array",
                    description:
                      "En uygun beş saç modeli, en uygundan başlayarak.",

                    items: {
                      type: "string",
                      enum: [
                        "Buzz Cut",
                        "Low Fade",
                        "Mid Fade",
                        "High Fade",
                        "French Crop",
                        "Crew Cut",
                        "Quiff",
                        "Pompadour",
                        "Slick Back",
                        "Undercut",
                      ],
                    },

                    minItems: 5,
                    maxItems: 5,
                  },
                },

                required: [
                  "faceShape",
                  "forehead",
                  "jawline",
                  "beardSuggestion",
                  "recommendedHairstyles",
                ],

                additionalProperties: false,
              },
            },
          },
        }),
      }
    );

    const openAIData = await openAIResponse.json();

    if (!openAIResponse.ok) {
      const message =
        openAIData?.error?.message ||
        "Fotoğraf analizi gerçekleştirilemedi.";

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: openAIResponse.status }
      );
    }

    const outputText = openAIData?.output
      ?.flatMap(
        (item: { content?: Array<{ type?: string; text?: string }> }) =>
          item.content ?? []
      )
      ?.find(
        (content: { type?: string }) =>
          content.type === "output_text"
      )?.text;

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,
          error: "Yapay zekâ analiz sonucu göndermedi.",
        },
        { status: 502 }
      );
    }

    const analysis = JSON.parse(outputText);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("SalonAI analiz hatası:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Beklenmeyen bir analiz hatası oluştu.",
      },
      { status: 500 }
    );
  }
}