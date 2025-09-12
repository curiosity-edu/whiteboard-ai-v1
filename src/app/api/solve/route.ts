// src/app/api/solve/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
const MODEL = "gpt-4o"; // vision-capable

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(500, { error: "OPENAI_API_KEY missing." });

    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return json(400, { error: "No 'image' file in form-data." });
    if (!file.type.startsWith("image/")) return json(400, { error: `Invalid type: ${file.type}` });

    const arr = await file.arrayBuffer();
    if (arr.byteLength === 0) return json(400, { error: "Empty image." });

    const dataUrl = `data:${file.type};base64,${Buffer.from(arr).toString("base64")}`;
    const client = new OpenAI({ apiKey });

    // Decide style from the image text:
    // - If the prompt explicitly asks to "explain", "why", "show work/steps", "derive/prove/justify",
    //   produce a natural, concise explanation (result first, then 2–4 short sentences).
    // - Otherwise, produce a work-only solution: a sequence of algebraic steps, one per line,
    //   with minimal labels (<= 6 words) and no extra prose.
    //
    // Always return ONLY valid JSON: { "message": "<final response text>" }
    const rsp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" } as any,
      messages: [
        {
          role: "system",
          content:
            "You are a careful math solver that reads problems from images. " +
            "You must decide the response style from the problem itself:\n" +
            "- If the image explicitly asks for an explanation (e.g., 'explain', 'why', 'show steps/work', 'derive', 'prove', 'justify'), " +
            "  provide a natural, concise explanation: start with the result, then 2–4 short sentences that explain how.\n" +
            "- Otherwise, return a work-only solution: a sequence of line-by-line algebraic transformations with minimal labels (<= 6 words). " +
            "  No paragraphs, no extra commentary. Finish with the final answer on the last line.\n" +
            "Prefer plain text math like 2x^2 + 7x + 5 = 0; use LaTeX fragments only when clearer.\n" +
            "Keep within ~120 words unless the image explicitly asks for detailed explanation.\n" +
            'Return ONLY valid JSON of the form: { "message": "<final response text>" }.',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Read the math in this image and respond using the rules above. " +
                'Return ONLY JSON: { "message": "<final response text>" }',
            },
            { type: "image_url", image_url: { url: dataUrl } } as any,
          ],
        },
      ],
    });

    const raw = rsp.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (!raw) return json(502, { error: "Model returned no content." });
      // Fallback: wrap non-JSON as the message.
      return json(200, { message: raw });
    }

    const message = (parsed?.message ?? "").toString().trim();

    // Optional: legacy passthroughs if the model ever includes them.
    const answerPlain = (parsed?.answer_plain ?? "").toString().trim();
    const answerLatex = (parsed?.answer_latex ?? "").toString().trim();
    const explanation = (parsed?.explanation ?? "").toString().trim();

    return json(200, { message, answerPlain, answerLatex, explanation });
  } catch (err: any) {
    const message =
      err?.response?.data?.error?.message || err?.message || "Unknown server error.";
    console.error("solve route error:", err);
    return json(500, { error: message });
  }
}
