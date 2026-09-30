// Gnueg – Rezept-Worker (Cloudflare Workers)
// Nimmt einen Rezept-Link oder ein Rezept-Bild entgegen und liefert Nährwerte pro Portion.
// Variablen in Cloudflare (Settings → Variables and Secrets):
//   OPENAI_API_KEY  (Secret)  dein OpenAI-API-Schlüssel
//   APP_TOKEN       (Secret)  frei gewählter Zugangscode, den du in der App einträgst
//   ALLOWED_ORIGIN  (Text)    z. B. https://noahgualtiero.github.io

const MODEL = "gpt-4o-mini";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "servings", "portion_grams", "per_portion", "ingredients", "source", "note"],
  properties: {
    name: { type: "string", description: "Name des Rezepts auf Deutsch" },
    servings: { type: "number", description: "Anzahl Portionen laut Rezept, sonst Schätzung" },
    portion_grams: { type: "number", description: "Geschätztes Gewicht einer Portion in Gramm" },
    per_portion: {
      type: "object",
      additionalProperties: false,
      required: ["kcal", "protein", "carbs", "fat"],
      properties: {
        kcal: { type: "number" }, protein: { type: "number" },
        carbs: { type: "number" }, fat: { type: "number" }
      }
    },
    ingredients: { type: "array", items: { type: "string" }, description: "Zutaten mit Mengen, kurz" },
    source: { type: "string", enum: ["angegeben", "geschaetzt"],
              description: "angegeben, wenn das Rezept selbst Nährwerte nennt; sonst geschaetzt" },
    note: { type: "string", description: "Kurzer Hinweis auf Unsicherheiten, sonst leer" }
  }
};

const SYSTEM = `Du bist Ernährungsberater. Du bekommst ein Rezept (Text oder Bild).
Ermittle Name, Anzahl Portionen, Gewicht einer Portion und die Nährwerte PRO PORTION
(kcal, Protein g, Kohlenhydrate g, Fett g). Nennt das Rezept selbst Nährwerte, übernimm diese
(source = "angegeben"), sonst berechne sie aus Zutaten und Mengen mit üblichen Nährwerttabellen
(source = "geschaetzt"). Antworte auf Deutsch. Ist kein Rezept erkennbar, setze name auf "",
alle Zahlen auf 0 und erkläre es in note.`;

function cors(env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}

// Rezept-Seite laden und auf das Wesentliche kürzen (JSON-LD bevorzugt, sonst Text)
async function pageText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Gnueg Rezept-Import)", "Accept": "text/html" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Seite nicht erreichbar (${res.status})`);
  const html = await res.text();
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1]).filter(s => /Recipe/i.test(s)).join("\n").slice(0, 20000);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim().slice(0, 15000);
  return (ld ? `Strukturierte Rezeptdaten (JSON-LD):\n${ld}\n\n` : "") + `Seitentext:\n${text}`;
}

async function askOpenAI(env, content) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "rezept", strict: true, schema: SCHEMA } },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI-Fehler ${res.status}`);
  return JSON.parse(data.choices[0].message.content);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405, headers);

    // Zugriffsschutz: erlaubte Herkunft und Zugangscode
    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin !== env.ALLOWED_ORIGIN)
      return json({ error: "Herkunft nicht erlaubt." }, 403, headers);
    if (!env.APP_TOKEN || request.headers.get("X-App-Token") !== env.APP_TOKEN)
      return json({ error: "Zugangscode falsch." }, 401, headers);
    if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY fehlt im Worker." }, 500, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400, headers); }

    try {
      let content;
      if (body.url) {
        if (!/^https?:\/\//i.test(body.url)) return json({ error: "Bitte einen gültigen Link angeben." }, 400, headers);
        content = [{ type: "text", text: `Rezept von ${body.url}\n\n${await pageText(body.url)}` }];
      } else if (body.image) {
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(body.image) || body.image.length > 8_000_000)
          return json({ error: "Bild ungültig oder zu gross." }, 400, headers);
        content = [{ type: "text", text: "Hier ist ein Screenshot oder Foto eines Rezepts." },
                   { type: "image_url", image_url: { url: body.image } }];
      } else if (body.text) {
        content = [{ type: "text", text: String(body.text).slice(0, 15000) }];
      } else {
        return json({ error: "Link, Bild oder Text fehlt." }, 400, headers);
      }
      const result = await askOpenAI(env, content);
      return json(result, 200, headers);
    } catch (e) {
      return json({ error: e.message || "Unbekannter Fehler." }, 502, headers);
    }
  }
};
