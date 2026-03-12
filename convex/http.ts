import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ─── Translation API rotation ─────────────────────────────────────────────────
// Routes translations through server-side (uses Convex IP, not user IP)
// so free-tier rate limits are per-server instead of per-user.

const LIBRE_HOSTS = [
  "https://libretranslate.com",
  "https://translate.argosopentech.com",
  "https://translate.terraprint.co",
];

const LINGVA_HOSTS = [
  "https://lingva.ml",
  "https://lingva.thedaviddelta.com",
];

// Module-level index persists across warm invocations
let _apiIdx = 0;

async function tryMyMemory(text: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${lang}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText)
      return data.responseData.translatedText as string;
  } catch { /* skip */ }
  return null;
}

async function tryLibre(text: string, lang: string): Promise<string | null> {
  for (const host of LIBRE_HOSTS) {
    try {
      const res = await fetch(`${host}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: "auto", target: lang, format: "text" }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.translatedText) return data.translatedText as string;
    } catch { /* try next */ }
  }
  return null;
}

async function tryLingva(text: string, lang: string): Promise<string | null> {
  for (const host of LINGVA_HOSTS) {
    try {
      const res = await fetch(
        `${host}/api/v1/auto/${lang}/${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.translation) return data.translation as string;
    } catch { /* try next */ }
  }
  return null;
}

function normLang(lang: string): string {
  const map: Record<string, string> = { "pt-BR": "pt", "zh-CN": "zh" };
  return map[lang] ?? lang.split("-")[0];
}

http.route({
  path: "/translate",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    let body: { text?: string; targetLang?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
    }

    const { text, targetLang } = body;
    if (!text?.trim() || !targetLang) {
      return new Response(JSON.stringify({ error: "Missing text or targetLang" }), { status: 400, headers: corsHeaders });
    }

    const lang = normLang(targetLang);
    const providers = [tryMyMemory, tryLibre, tryLingva];
    const start = _apiIdx % providers.length;
    const ordered = [...providers.slice(start), ...providers.slice(0, start)];

    for (let i = 0; i < ordered.length; i++) {
      const result = await ordered[i](text, lang);
      if (result) {
        _apiIdx = (start + i + 1) % providers.length;
        return new Response(JSON.stringify({ translation: result, provider: i }), { status: 200, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: "All providers failed" }), { status: 503, headers: corsHeaders });
  }),
});

// CORS preflight for /translate
http.route({
  path: "/translate",
  method: "OPTIONS",
  handler: httpAction(async () =>
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    })
  ),
});

export default http;
