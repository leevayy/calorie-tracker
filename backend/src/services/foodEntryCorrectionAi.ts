import { z } from "zod";
import { env } from "../env.ts";
import { configuredAiModelUri } from "./aiModel.ts";
import type { FoodEntryCorrectionClassifier } from "./foodEntryCorrection.ts";

const ChatCompletionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }),
    }),
  ),
});

const CORRECTION_SYSTEM_PROMPT = `You classify a correction instruction for one saved food entry.
Return exactly one JSON object and no prose.

Allowed operations:
1. Proportional nutrition change:
{"kind":"scale","factor":number,"portion"?:string}
- Use this whenever the instruction implies multiplying or dividing calories, serving quantity, or the whole nutrition record.
- Return only the factor. Never calculate replacement calories or nutrients yourself.
- Include portion only when the instruction explicitly implies a serving or quantity change.

2. Direct field correction:
{"kind":"patch","changes":{"name"?:string,"portion"?:string|null,"calories"?:number,"protein"?:number,"carbs"?:number,"fats"?:number,"fiber"?:number}}
- Include only fields the instruction clearly changes.
- All numbers must be finite and non-negative.

3. Unsafe, invalid, unsupported, or ambiguous instruction:
{"kind":"reject","reason":"ambiguous"|"unsupported"|"invalid"}

The current entry arrives as structured JSON. Do not infer it from display text.
Never change day or mealType; those are explicit UI selectors.`;

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI did not return JSON");
  return raw.slice(start, end + 1);
}

/** Production adapter for the external AI classifier seam. Model selection stays server-side. */
export const classifyFoodEntryCorrectionWithAi: FoodEntryCorrectionClassifier = async (input) => {
  if (!env.YANDEX_AI_STUDIO_API_KEY) {
    throw new Error("Yandex AI Studio API key is missing");
  }

  const authorization = env.YANDEX_AI_STUDIO_API_KEY.startsWith("AQVN")
    ? `Api-Key ${env.YANDEX_AI_STUDIO_API_KEY}`
    : `Bearer ${env.YANDEX_AI_STUDIO_API_KEY}`;
  const headers: HeadersInit = {
    Authorization: authorization,
    "Content-Type": "application/json",
  };
  if (env.YANDEX_FOLDER_ID) headers["x-folder-id"] = env.YANDEX_FOLDER_ID;

  const response = await fetch(env.YANDEX_AI_STUDIO_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: configuredAiModelUri(env.AI_MODEL_PREFERENCE),
      messages: [
        { role: "system", content: CORRECTION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      temperature: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`AI upstream error: ${response.status}`);
  }

  const completion = ChatCompletionSchema.parse(await response.json());
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("AI returned an empty response");
  return JSON.parse(extractFirstJsonObject(content)) as unknown;
};
