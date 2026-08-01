import type { EditMode } from "./types";

export function buildBarberEditPrompt(input: {
  hairstyleName?: string;
  hairstyleDescription?: string;
  beardStyle?: string;
  editMode: EditMode;
  barberInstruction?: string;
}) {
  const hairTask = input.editMode !== "beard"
    ? `Replace and reconstruct the current scalp hair inside the transparent mask as a clearly visible ${input.hairstyleName} haircut. Do not preserve the current hairstyle, silhouette, top direction or side lengths. Style definition: ${input.hairstyleDescription ?? ""}. Barber execution: ${input.barberInstruction ?? ""}. A structural haircut transformation is mandatory: the silhouette, fringe or front direction, top volume and side/fade lengths must visibly match the requested style and be unmistakably different from the current hairstyle.`
    : "Do not alter scalp hair in any way.";
  const beardTask = input.editMode !== "hair"
    ? `Apply only this beard treatment: ${input.beardStyle || "a natural, face-suitable tidy beard"}.`
    : "Do not alter, remove, add, recolor, or restyle any facial hair.";

  return `PRIMARY TASK:
Change only the selected hairstyle and/or beard according to editMode (${input.editMode}).
${hairTask}
${beardTask}

IDENTITY LOCK:
Keep the exact same person. Do not alter face, beard, skin, ears, expression, clothing or background. Preserve exact facial geometry, face proportions and head pose. Preserve eyes, eyebrows, nose, lips, teeth, cheeks, jaw geometry, ears, skin tone, skin texture, moles and all distinctive facial details. Do not beautify or reshape the face.

SCENE LOCK:
Preserve background, clothes, body, neck, camera angle, crop, composition, lighting, shadows and image dimensions.

HAIR REQUIREMENTS:
Match the natural hair color. Fit the haircut to the existing head perspective and scalp. Produce realistic strands, density, hairline, temple and fade transitions, gravity and shadows. Do not invent a new skull shape.
Do not merely retouch, sharpen, recolor or add texture to the existing hair. Rebuild the haircut geometry inside the editable region.
For French Crop: apply a clearly visible French Crop haircut with a short textured top, controlled forward fringe and clean faded sides. Keep all forehead skin outside the transparent mask unchanged.
For Quiff: create visibly elevated front volume swept upward and slightly backward with realistic side transitions.
For Low Fade: create a clearly visible low fade concentrated just above the ears and temples while retaining natural top texture.
For Undercut: create a strong visible contrast between longer top hair and closely cut sides with a clean transition.

BEARD REQUIREMENTS:
Only apply when requested. Preserve lips, nose, cheek structure and jaw geometry. Keep density, strand direction, color and lighting photorealistic.

NEGATIVE INSTRUCTIONS:
Do not beautify, retouch, smooth skin, change age or expression, reshape the face or head, enlarge eyes, alter nose or lips, change body, clothes or background, or add accessories, text, logos, watermarks or people. Pixels outside the transparent edit area must remain unchanged.`;
}
