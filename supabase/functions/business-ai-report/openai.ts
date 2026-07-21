import type { AiNarrative, ReportLanguage } from './types.ts';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function outputText(payload: Record<string, unknown>) {
  const direct = text(payload.output_text);
  if (direct) return direct;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const row = part as Record<string, unknown>;
      if (row.type === 'output_text' && text(row.text)) return text(row.text);
    }
  }
  return '';
}

function cleanList(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, 6);
}

export async function createOpenAiNarrative(params: {
  language: ReportLanguage;
  reportInput: unknown;
}): Promise<AiNarrative | null> {
  const apiKey = text(Deno.env.get('OPENAI_API_KEY'));
  const model = text(Deno.env.get('OPENAI_REPORT_MODEL'));
  if (!apiKey || !model) return null;

  const languageInstruction = params.language === 'en'
    ? 'Write in professional English.'
    : 'Viết bằng tiếng Việt chuyên nghiệp, dễ hiểu.';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: [
        'You are the Deals68 source-grounded business profile analyst.',
        languageInstruction,
        'Use only the supplied payload.',
        'Never create or infer unsupported numbers, valuations, ownership, legal validity or verification status.',
        'Keep self-declared information clearly separate from document-backed facts.',
        'Do not give an investment recommendation.',
        'When evidence is insufficient, say so directly.',
      ].join(' '),
      input: JSON.stringify(params.reportInput),
      max_output_tokens: 1800,
      text: {
        format: {
          type: 'json_schema',
          name: 'deals68_business_report_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['executive_summary', 'strengths', 'risks', 'recommendations'],
            properties: {
              executive_summary: { type: 'string', minLength: 1, maxLength: 1800 },
              strengths: {
                type: 'array',
                maxItems: 6,
                items: { type: 'string', minLength: 1, maxLength: 500 },
              },
              risks: {
                type: 'array',
                maxItems: 6,
                items: { type: 'string', minLength: 1, maxLength: 500 },
              },
              recommendations: {
                type: 'array',
                maxItems: 6,
                items: { type: 'string', minLength: 1, maxLength: 500 },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn('OpenAI report analysis unavailable', response.status, body.slice(0, 500));
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const raw = outputText(payload);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const summary = text(parsed.executive_summary);
    if (!summary) return null;
    return {
      executive_summary: summary.slice(0, 1800),
      strengths: cleanList(parsed.strengths),
      risks: cleanList(parsed.risks),
      recommendations: cleanList(parsed.recommendations),
    };
  } catch (error) {
    console.warn('OpenAI report JSON parse failed', error);
    return null;
  }
}
