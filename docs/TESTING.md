# Guida al test end-to-end

Questa guida porta dal repo appena clonato a un **giro completo funzionante**:

> messaggio su Telegram → diario nel branch `data` → recap generato da Claude → conferma dal pulsante → PPT a fine mese

Si possono usare dati finti. Non serve aspettare il 25 o la fine del mese: ogni job si lancia a mano indicando il mese.

## Indice

0. [Test senza chiavi (2 minuti)](#0-test-senza-chiavi-2-minuti)
1. [Chiavi: cosa serve e dove prenderle](#1-chiavi-cosa-serve-e-dove-prenderle)
2. [Preparare il repo GitHub](#2-preparare-il-repo-github)
3. [Il bot in locale, senza deploy](#3-il-bot-in-locale-senza-deploy)
4. [Il bot online con Cloudflare](#4-il-bot-online-con-cloudflare)
5. [Recap del 25, promemoria e conferma](#5-recap-del-25-promemoria-e-conferma)
6. [Report PPT di fine mese](#6-report-ppt-di-fine-mese)
7. [Lanciare i job da GitHub Actions](#7-lanciare-i-job-da-github-actions)
8. [Checklist del giro completo](#8-checklist-del-giro-completo)
9. [Problemi frequenti](#9-problemi-frequenti)

---

## 0. Test senza chiavi (2 minuti)

Il primo controllo non richiede nessun account. Il test end-to-end simula tutto il giro in memoria: finti GitHub, Telegram e LLM, ma PPT vero generato dal template.

```bash
npm ci
npm test           # 72 test: unitari + 1 end-to-end
npm run test:e2e   # solo il giro completo simulato
```

Se passa, il codice funziona. Le sezioni successive collegano i servizi reali.

---

## 1. Chiavi: cosa serve e dove prenderle

| Chiave | A cosa serve | Dove si prende | Costo |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Il bot riceve e invia messaggi | Telegram, [@BotFather](https://t.me/BotFather) | gratis |
| `TELEGRAM_WEBHOOK_SECRET` | Il Worker accetta solo chiamate di Telegram | La inventi tu (comando sotto) | gratis |
| `GITHUB_TOKEN` | Il bot e i job scrivono nel branch `data` | GitHub, token *fine-grained* | gratis |
| `CLAUDE_CODE_OAUTH_TOKEN` | Recap e testi del PPT con l'abbonamento Claude (modalità `LOCAL`, default) | `claude setup-token` | incluso nell'abbonamento |
| `ANTHROPIC_API_KEY` | Solo in alternativa, modalità `API_KEY` | [console.anthropic.com](https://console.anthropic.com) | a consumo, serve la carta |
| Account Cloudflare | Ospita il bot (Worker) | [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) | gratis |
| Il tuo ID Telegram | Abilitarti nell'anagrafica | Te lo dice il bot con `/start`, oppure [@userinfobot](https://t.me/userinfobot) | gratis |

### 1.1 Token del bot Telegram

1. Su Telegram apri **@BotFather** e scrivi `/newbot`.
2. Scegli un nome (es. `Report Test`) e uno username che finisce in `bot` (es. `report_umbe_test_bot`).
3. BotFather risponde con un token tipo `7123456789:AAH...`: questo è `TELEGRAM_BOT_TOKEN`.
4. Apri il tuo bot (link `t.me/<username>`) e premi **Avvia**. Senza questo passo il bot non può scriverti per primo, quindi il recap non ti arriverebbe.

### 1.2 Secret del webhook

Stringa casuale, solo lettere, numeri, `_` e `-`:

```bash
openssl rand -hex 32
```

### 1.3 Token GitHub

1. Vai su **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** ([link diretto](https://github.com/settings/personal-access-tokens/new)).
2. *Repository access*: **Only select repositories** → `reportAziendale`.
3. *Permissions → Repository permissions → Contents*: **Read and write**. Nient'altro.
4. Scadenza a piacere (per il test bastano 30 giorni).

Questo token serve al bot e all'esecuzione locale dei job. Su GitHub Actions i job usano il token automatico del workflow, quindi lì non va inserito.

### 1.4 Claude per recap e report (senza carta)

Il default è la modalità `LOCAL`: i job usano Claude Code con l'abbonamento Claude, senza chiave API.

- **In locale**, sul PC dove sei già loggato in Claude Code, non serve altro.
- **Su GitHub Actions o in una routine cron**, genera un token dell'abbonamento:

```bash
claude setup-token     # stampa un token sk-ant-oat...
```

Quel valore è `CLAUDE_CODE_OAUTH_TOKEN`. Tutte le opzioni (Actions, routine locale, API) sono spiegate in [ESECUZIONE-LLM.md](ESECUZIONE-LLM.md).

In alternativa, con la carta: `LLM_PROVIDER=API_KEY` e una chiave `ANTHROPIC_API_KEY` presa da [console.anthropic.com](https://console.anthropic.com) (Settings → API keys).

Per consumare meno durante i test: `LLM_MODEL=sonnet` (o `haiku`).

### 1.5 Il tuo ID Telegram

Due strade:
- scrivi `/start` al tuo bot (dopo il passo 3 o 4): risponde con il tuo ID;
- oppure scrivi a [@userinfobot](https://t.me/userinfobot).

---

## 2. Preparare il repo GitHub

### 2.1 Codice su `main` e branch di default

Il codice va portato su `main` (fast-forward dal branch di sviluppo):

```bash
git fetch origin
git push origin origin/claude/telegram-report-workflow-8gzhys:main
```

Poi su GitHub: **Settings → General → Default branch → `main`**. È necessario perché GitHub mostra "Run workflow" e lancia i cron solo per i workflow presenti sul branch di default.

### 2.2 Creare il branch `data` con l'anagrafica

Il branch `data` contiene solo dati e parte vuoto (senza il codice). Sostituisci l'ID con il tuo:

```bash
git clone https://github.com/UmbertoDev/reportAziendale.git report-data
cd report-data
git switch --orphan data
mkdir -p config
cat > config/persone.json <<'EOF'
[
  { "slug": "umbe", "nome": "Umbe Test", "telegramUserId": 123456789 }
]
EOF
git add config/persone.json
git commit -m "chore: anagrafica venditori di test"
git push -u origin data
```

`slug` finisce nei nomi dei file: solo minuscole, numeri e `-`.

Se non conosci ancora il tuo ID, crea il file con un numero qualsiasi e correggilo dopo il `/start`: il bot rilegge l'anagrafica a ogni messaggio.

---

## 3. Il bot in locale, senza deploy

Serve a vedere il primo pezzo del giro (messaggio → commit) senza Cloudflare. Il "messaggio Telegram" lo simuli con `curl`; la risposta del bot arriva comunque sul tuo Telegram vero.

### 3.1 Variabili locali

Nella root del repo crea `.dev.vars` (è già in `.gitignore`):

```ini
TELEGRAM_BOT_TOKEN=7123456789:AAH...
TELEGRAM_WEBHOOK_SECRET=la-stringa-generata
GITHUB_TOKEN=github_pat_...
```

`DATA_REPO`, `DATA_BRANCH` e `TIMEZONE` sono già in `wrangler.toml`.

### 3.2 Avvio

```bash
npm run worker:dev        # server locale su http://localhost:8787
curl http://localhost:8787/health   # risponde "ok"
```

### 3.3 Simulare un messaggio

In un altro terminale (metti il tuo ID in `from.id` e `chat.id`):

```bash
curl -X POST http://localhost:8787/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: la-stringa-generata" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": { "id": 123456789 },
      "chat": { "id": 123456789, "type": "private" },
      "text": "Visita cliente Alfa, interessati alla linea B. Richiamare lunedì."
    }
  }'
```

Risultato atteso:
- `curl` risponde `ok`;
- su Telegram il bot ti scrive **"Salvato nel diario ✅"**;
- sul branch `data` compare un commit `diario: umbe <data> <ora>` con il file `diario/AAAA-MM/AAAA-MM-GG-umbe.md`.

Ripeti con 3-4 messaggi diversi: sono il materiale per il recap.

Con un ID non presente in `persone.json` il bot risponde che non sei abilitato: anche questo è un test utile.

---

## 4. Il bot online con Cloudflare

Serve per scrivere davvero dal telefono e per i pulsanti Conferma/Integra del recap.

```bash
npx wrangler login                          # apre il browser, accedi a Cloudflare
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
npm run worker:deploy
```

Il deploy stampa l'URL, tipo `https://report-aziendale-bot.<tuo-account>.workers.dev`. Collega Telegram al Worker:

```bash
TOKEN=7123456789:AAH...
SECRET=la-stringa-generata
URL=https://report-aziendale-bot.<tuo-account>.workers.dev/telegram/webhook

curl "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -d "url=$URL" \
  -d "secret_token=$SECRET" \
  -d 'allowed_updates=["message","callback_query"]'

# verifica: "url" valorizzato e nessun "last_error_message"
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

Ora scrivi al bot dal telefono: `/start` (ti dà l'ID), poi qualche messaggio. Ognuno diventa un commit sul branch `data`.

Log in tempo reale del Worker: `npx wrangler tail`.

> Dopo il `setWebhook`, Telegram manda gli update solo al Worker online. Per tornare al test locale con `curl` non serve toccare nulla: `curl` chiama direttamente `localhost`.

---

## 5. Recap del 25, promemoria e conferma

### 5.1 Variabili per i job in locale

Crea `.env` nella root (già in `.gitignore`):

```bash
DATA_REPO=UmbertoDev/reportAziendale
DATA_BRANCH=data
TIMEZONE=Europe/Rome
GITHUB_TOKEN=github_pat_...
TELEGRAM_BOT_TOKEN=7123456789:AAH...
LLM_PROVIDER=LOCAL          # Claude Code con l'abbonamento; API_KEY per l'API a consumo
# CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...   # solo se su questo PC Claude Code non è loggato
# ANTHROPIC_API_KEY=sk-ant-...            # solo con LLM_PROVIDER=API_KEY
# LLM_MODEL=sonnet                        # facoltativo, per consumare meno nei test
```

Caricale nella shell:

```bash
set -a && source .env && set +a
```

### 5.2 Generare il recap subito

`MONTH` indica il mese da elaborare (quello dei messaggi che hai scritto):

```bash
MONTH=2026-09 npm run job:recap
```

Risultato atteso:
- in console, un riepilogo con `"status": "generated"` per la tua persona;
- sul branch `data`, il file `recap/2026-09/umbe.md` con `stato: proposto`;
- su Telegram, il messaggio **"📋 Recap 2026-09 … Ti torna come recap?"** con i pulsanti **✅ Conferma** e **✍️ Integra**.

Il job non rigenera un recap che esiste già. Per rifarlo: `MONTH=2026-09 OVERWRITE=true npm run job:recap`.

### 5.3 Promemoria (simula il 27 e il 29)

Prima di confermare:

```bash
MONTH=2026-09 npm run job:reminder
```

Arriva **"⏰ Promemoria: il recap 2026-09 non è ancora confermato…"** con gli stessi pulsanti. Chi ha già confermato non riceve nulla.

### 5.4 Conferma o integrazione

Richiede il Worker online (sezione 4), perché il tocco sul pulsante arriva al webhook.

- **✍️ Integra**: il bot chiede il testo. Rispondi a quel messaggio (Telegram apre già la risposta). Il testo finisce in `recap/2026-09/umbe.md` sotto "Integrazioni della persona", **non** nel diario, e il recap diventa `confermato`.
- **✅ Conferma**: il file passa a `stato: confermato` e il bot risponde "Grazie, recap confermato ✅".

Per provare anche il caso "non confermato" del report, lascia un recap senza conferma (per esempio aggiungi una seconda persona finta in `persone.json` con un ID qualsiasi e qualche diario creato a mano).

---

## 6. Report PPT di fine mese

Con `MONTH` impostato il job salta il controllo "è l'ultimo giorno del mese":

```bash
MONTH=2026-09 npm run job:report
```

Risultato atteso:
- in console, `"status": "generated"` con il percorso del file;
- sul branch `data`, `report/2026-09/2026-09-umbe.pptx`.

Per aprirlo: su GitHub apri il file nel branch `data` e premi **Download raw**, oppure `git pull` nel clone `report-data`.

In copertina trovi "Stato recap: confermato dal venditore" oppure "NON confermato dal venditore".

Senza `MONTH` il job controlla la data: se oggi non è l'ultimo giorno del mese stampa "nulla da fare" ed esce. È il comportamento del cron.

---

## 7. Lanciare i job da GitHub Actions

Dopo il passo 2.1 (codice su `main`, `main` branch di default):

1. **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLAUDE_CODE_OAUTH_TOKEN` (modalità `LOCAL`, default)
   - `TELEGRAM_BOT_TOKEN`
   - `ANTHROPIC_API_KEY` solo se vuoi usare la modalità `API_KEY`
2. (Facoltativo) scheda **Variables**: `SCHEDULE_ON_ACTIONS=true` per accendere i cron, `LLM_PROVIDER`, `LLM_MODEL`, `DATA_BRANCH`, `TIMEZONE`, `REPORT_TEMPLATE`.
3. **Actions** → scegli il workflow → **Run workflow** → scegli `LOCAL` o `API_KEY` e nel campo mese scrivi `2026-09`:
   - *Recap mensile* (con l'opzione "rigenera" se il recap esiste già)
   - *Promemoria conferma recap*
   - *Report mensile PPT*
4. Il log di ogni esecuzione mostra lo stesso riepilogo JSON dell'esecuzione locale.

Qui `GITHUB_TOKEN` non va creato: è quello automatico del workflow, che ha già i permessi di scrittura.

Calendario automatico (orari UTC, solo con `SCHEDULE_ON_ACTIONS=true`): recap il 25 alle 07:00, promemoria il 27 e il 29 alle 07:00, report dal 28 al 31 alle 16:00 (procede solo l'ultimo giorno). In alternativa i job possono girare con una routine sul PC di un collega: [ESECUZIONE-LLM.md](ESECUZIONE-LLM.md).

---

## 8. Checklist del giro completo

| # | Passo | Come verifichi |
|---|---|---|
| 1 | `npm test` verde | 72 test passati |
| 2 | Branch `data` con `config/persone.json` | visibile su GitHub |
| 3 | Messaggio al bot | "Salvato nel diario ✅" + commit `diario: ...` |
| 4 | Recap | messaggio con pulsanti + `recap/AAAA-MM/<slug>.md` in `stato: proposto` |
| 5 | Promemoria | messaggio ⏰ solo a chi non ha confermato |
| 6 | Conferma o Integra | `stato: confermato` (ed eventuale sezione integrazioni) |
| 7 | Report | `report/AAAA-MM/AAAA-MM-<slug>.pptx` apribile, copertina con stato recap |

---

## 9. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| `curl` risponde `Forbidden` | Header secret diverso da `TELEGRAM_WEBHOOK_SECRET` | Stesso valore in `.dev.vars` / `wrangler secret` e nell'header o nel `setWebhook` |
| Il bot dice "Non sei ancora abilitato" | Il tuo ID non è in `persone.json` sul branch `data` | Correggi l'ID (numero, senza virgolette) |
| Il bot risponde "Si è verificato un errore" | Chiamata a GitHub fallita | `npx wrangler tail`: 404 = branch `data` mancante o `DATA_REPO` errato; 401/403 = token senza *Contents: Read and write* |
| Nessuna risposta del bot | Webhook non registrato o in errore | `getWebhookInfo`: guarda `last_error_message` |
| Il recap non arriva su Telegram | Non hai mai premuto **Avvia** sul bot | Apri il bot, premi Avvia, rilancia con `OVERWRITE=true` |
| Job recap: `skipped` / `no-diary` | Nessun diario in quel mese per quella persona | Controlla `MONTH` e la cartella `diario/AAAA-MM/` |
| Job recap: `skipped` / `already-exists` | Recap già generato | `OVERWRITE=true` |
| Job report: `skipped` / `no-recap` | Manca il recap del mese | Lancia prima il job recap |
| Job: `Variabile d'ambiente mancante` | `.env` non caricato | `set -a && source .env && set +a` nella stessa shell |
| `Claude Code CLI fallita`, "Not logged in" o errore di autenticazione | Modalità `LOCAL` senza login né token | `claude` loggato sul PC, oppure `CLAUDE_CODE_OAUTH_TOKEN` (rigeneralo con `claude setup-token` se scaduto) |
| `Impossibile avviare claude` | CLI non installata o non nel `PATH` | `npm install -g @anthropic-ai/claude-code`, oppure `CLAUDE_BIN=/percorso/claude` |
| Errore Anthropic 401 (modalità `API_KEY`) | Chiave errata | Rigenera la chiave in Console |
| Errore Anthropic 400 sul credito | Credito esaurito | Console → Billing |
| "Run workflow" non compare | Workflow non presenti sul branch di default | Passo 2.1 |
| Pulsanti Conferma/Integra senza effetto | Worker non online o webhook non collegato | Sezione 4 |
