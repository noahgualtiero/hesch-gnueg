# Rezept-Import einrichten (Cloudflare Worker + OpenAI)

Damit Gnueg Rezepte per Link oder Screenshot auslesen und Zutaten auf Fotos erkennen kann,
braucht es einen kleinen, kostenlosen Cloudflare Worker. Er lädt Rezeptseiten und leitet
die Anfragen an OpenAI weiter.

Jede Person nutzt dabei ihren **eigenen OpenAI-API-Schlüssel**. Er wird nur in der App
auf dem eigenen Gerät gespeichert und bei jeder Anfrage mitgeschickt. Der Worker speichert
ihn nicht. So bezahlt jede Person ihre eigene Nutzung, und der Worker muss nur einmal
eingerichtet werden.

## 1. Worker anlegen (einmalig, nur die Person, die ihn betreibt)

1. Auf **dash.cloudflare.com** kostenlos registrieren bzw. anmelden.
2. Links **Workers & Pages** öffnen, dann **Create** → **Create Worker**.
3. Als Namen z. B. `gnueg-rezept` eingeben und **Deploy** klicken.
4. **Edit code** klicken, den gesamten Inhalt von `rezept-worker.js` (in diesem Ordner) einfügen
   und den vorhandenen Code ersetzen. Dann **Deploy**.
5. Unter **Settings → Variables and Secrets** eine Variable anlegen:

| Name | Typ | Wert |
|---|---|---|
| `ALLOWED_ORIGIN` | Text | `https://noahgualtiero.github.io` |

Die Worker-Adresse steht oben im Worker, z. B. `https://gnueg-rezept.DEINNAME.workers.dev`.
Trägt man sie in `index.html` bei `DEFAULT_WORKER` ein, ist sie in der App schon vorausgefüllt.

Variablen aus der alten Version (`OPENAI_API_KEY`, `APP_TOKEN`) werden nicht mehr gebraucht
und können gelöscht werden.

## 2. Eigenen OpenAI-API-Schlüssel erstellen (jede Person)

1. Auf **platform.openai.com** anmelden (ein ChatGPT-Abo genügt nicht, die API ist separat).
2. Unter **Billing** Guthaben aufladen, z. B. 5 USD. Ein Rezept kostet mit gpt-4o-mini weniger als einen Rappen.
3. Unter **Limits** ein tiefes Monatslimit setzen, z. B. 2 USD.
4. Unter **API keys** einen neuen Schlüssel erstellen und kopieren (beginnt mit `sk-`).

## 3. In der App eintragen

1. In Gnueg **+ Nahrungsmittel** → **Rezept per Link oder Screenshot** antippen.
2. Worker-Adresse und den eigenen OpenAI-Schlüssel eintragen und speichern.
   Das ist nur einmal nötig, die Angaben bleiben auf dem Gerät gespeichert.

## Sicherheit

- Der Schlüssel liegt nur auf dem eigenen Gerät. Wer das entsperrte Gerät hat, könnte ihn auslesen.
  Darum bei OpenAI ein tiefes Ausgabenlimit setzen.
- Der Worker antwortet nur Anfragen von der GitHub-Seite der App.
- Geht ein Schlüssel verloren, ihn auf platform.openai.com löschen und einen neuen erstellen.
