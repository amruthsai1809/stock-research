import { z } from "zod";
import type { AiProviderId, AiResearchMemo, StockIntelligenceScore } from "../domain/types";

export type AiMemoRequest = {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  score: StockIntelligenceScore;
};

const MemoPayloadSchema = z.object({
  headline: z.string().min(1).max(140),
  summary: z.string().min(1).max(900),
  bullCase: z.array(z.string().min(1)).max(4),
  bearCase: z.array(z.string().min(1)).max(4),
  watchItems: z.array(z.string().min(1)).max(4),
  verdict: z.string().min(1).max(400),
});

export interface AiMemoGateway {
  generate(request: AiMemoRequest): Promise<AiResearchMemo>;
}

export function buildEvidencePacket(score: StockIntelligenceScore) {
  return {
    company: { symbol: score.symbol, name: score.companyName },
    methodology: { strategy: score.strategy, score: score.score, grade: score.grade, confidence: score.confidence },
    lenses: { quality: score.quality, opportunity: score.opportunity, resilience: score.resilience },
    valuation: { fairValue: score.fairValue, marginOfSafetyPercent: score.marginOfSafety },
    factors: score.factors.map((factor) => ({
      name: factor.label,
      score: factor.score,
      effectiveWeight: Number(factor.effectiveWeight.toFixed(1)),
      status: factor.status,
      asOf: factor.asOf,
      unavailableReason: factor.unavailableReason,
      evidence: factor.evidence.map(({ label, value, direction, detail }) => ({ label, value, direction, detail })),
    })),
    dataAsOf: score.dataAsOf,
  };
}

function promptFor(score: StockIntelligenceScore) {
  return `You are an evidence-disciplined equity research editor. Analyze only the supplied deterministic evidence packet. Do not change, recompute, or invent scores. Do not add facts, news, price targets, analyst ratings, or current events that are absent. Explicitly distinguish reported evidence from model interpretation. A missing factor stays missing. This is research prioritization, not personalized investment advice.\n\nReturn only valid JSON with this exact shape: {"headline":"...","summary":"...","bullCase":["..."],"bearCase":["..."],"watchItems":["..."],"verdict":"..."}. Use at most 3 bullets in each array and plain language.\n\nEVIDENCE_PACKET:\n${JSON.stringify(buildEvidencePacket(score))}`;
}

function parseMemo(text: string, request: AiMemoRequest): AiResearchMemo {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let input: unknown;
  try { input = JSON.parse(cleaned); } catch { throw new Error("The model returned an unreadable response. Try again or choose another model."); }
  const parsed = MemoPayloadSchema.safeParse(input);
  if (!parsed.success) throw new Error("The model response did not match the research-memo contract.");
  return { ...parsed.data, generatedAt: new Date().toISOString(), provider: request.provider, model: request.model };
}

async function checkedJson(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? JSON.stringify((payload as { error: unknown }).error).slice(0, 260)
      : `HTTP ${response.status}`;
    throw new Error(`AI provider rejected the request: ${message}`);
  }
  return payload;
}

export class BrowserAiMemoGateway implements AiMemoGateway {
  async generate(request: AiMemoRequest) {
    if (!request.apiKey.trim()) throw new Error("Enter an API key for the selected provider.");
    if (!request.model.trim()) throw new Error("Enter a model ID.");
    if (request.provider === "openai") return this.openAi(request);
    if (request.provider === "anthropic") return this.anthropic(request);
    return this.gemini(request);
  }

  private async openAi(request: AiMemoRequest) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.apiKey}` },
      body: JSON.stringify({ model: request.model, input: promptFor(request.score), store: false, reasoning: { effort: "low" }, max_output_tokens: 1400 }),
    });
    const payload = await checkedJson(response) as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no text output.");
    return parseMemo(text, request);
  }

  private async anthropic(request: AiMemoRequest) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: request.model, max_tokens: 1400, messages: [{ role: "user", content: promptFor(request.score) }] }),
    });
    const payload = await checkedJson(response) as { content?: Array<{ type?: string; text?: string }> };
    const text = payload.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("Anthropic returned no text output.");
    return parseMemo(text, request);
  }

  private async gemini(request: AiMemoRequest) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": request.apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: promptFor(request.score) }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1400 } }),
    });
    const payload = await checkedJson(response) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) throw new Error("Gemini returned no text output.");
    return parseMemo(text, request);
  }
}

export function buildLocalMemo(score: StockIntelligenceScore): AiResearchMemo {
  const best = score.factors.filter((factor) => factor.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const weakest = score.factors.filter((factor) => factor.score != null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  return {
    headline: `${score.companyName}: ${score.grade.toLowerCase()} evidence, ${score.confidence}% coverage`,
    summary: `${score.symbol} scores ${score.score}/100 under the ${score.strategy} strategy. The strongest measured factor is ${best?.label.toLowerCase() ?? "not available"}; the principal constraint is ${weakest?.label.toLowerCase() ?? "not available"}. This summary is generated locally from the same disclosed factor math shown on screen.`,
    bullCase: score.positives,
    bearCase: score.cautions,
    watchItems: score.factors.filter((factor) => factor.status === "unavailable").map((factor) => `Add verified ${factor.label.toLowerCase()} coverage before increasing confidence.`).slice(0, 3),
    verdict: `Treat this as a research-priority signal, not a prediction. Verify the source filings and test whether the ${intelligenceStrategyLabel(score.strategy)} assumptions match your own time horizon.`,
    generatedAt: new Date().toISOString(),
    provider: "local",
    model: "deterministic-template-v1",
  };
}

function intelligenceStrategyLabel(value: StockIntelligenceScore["strategy"]) {
  return value.replace("-", " ");
}
