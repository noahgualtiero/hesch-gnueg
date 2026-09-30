# Rezept-Import einrichten (Cloudflare Worker + OpenAI)

Damit Gnueg Rezepte per Link oder Screenshot auslesen kann, braucht es einen kleinen,
kostenlosen Cloudflare Worker. Er hält deinen OpenAI-Schlüssel geheim und leitet die
Anfragen an OpenAI weiter. Dauer: etwa 10 Minuten.

## 1. OpenAI-API-Schlüssel

1. Auf **platform.openai.com** anmelden (ein ChatGPT-Abo genügt nicht, die API ist separat).
2. Unter **Billing** Guthaben aufladen, z. B. 5 USD. Ein Rezept kostet mit gpt-4o-mini weniger als einen Rappen.
3. Optional unter **Limits** ein Monatslimit setzen, z. B. 2 USD.
4. Unter **API keys** einen neuen Schlüssel erstellen und kopieren (beginnt mit `sk-`).

## 2. Cloudflare Worker anlegen

1. Auf **dash.cloudflare.com** kostenlos registrieren bzw. anmelden.
2. Links **Workers & Pages** öffnen, dann **Create** → **Create Worker**.
3. Als Namen z. B. `gnueg-rezept` eingeben und **Deploy** klicken.
4. **Edit code** klicken, den gesamten Inhalt von `rezept-worker.js` (in diesem Ordner) einfügen
   und den vorhandenen Code ersetzen. Dann **Deploy**.

## 3. Variablen setzen

Im Worker unter **Settings → Variables and Secrets** drei Einträge anlegen:

| Name | Typ | Wert |
|---|---|---|
| `OPENAI_API_KEY` | Secret | dein Schlüssel aus Schritt 1 |
| `APP_TOKEN` | Secret | ein selbst gewählter Zugangscode, z. B. 20 zufällige Zeichen |
| `ALLOWED_ORIGIN` | Text | `https://noahgualtiero.github.io` |

Danach speichern bzw. erneut **Deploy**.

Die Worker-Adresse steht oben im Worker, z. B. `https://gnueg-rezept.DEINNAME.workers.dev`.

## 4. In der App eintragen

1. In Gnueg **+ Nahrungsmittel** → **Rezept per Link oder Screenshot** antippen.
2. Worker-Adresse und Zugangscode (`APP_TOKEN`) eintragen und speichern.
   Das ist nur einmal nötig, die Angaben bleiben auf deinem iPhone gespeichert.

## Sicherheit

- Der OpenAI-Schlüssel steht nur im Worker, nie in der App oder auf GitHub.
- Der Worker antwortet nur Anfragen von deiner GitHub-Seite und nur mit dem richtigen Zugangscode.
- Wird der Zugangscode bekannt, ändere einfach `APP_TOKEN` im Worker und in der App.
