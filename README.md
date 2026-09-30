# Report Aziendale

Workflow che raccoglie i messaggi dei venditori su **Telegram** e produce ogni mese un **report PPT** per venditore.

```
Venditore ──Telegram──▶ Bot (Cloudflare Worker) ──commit──▶ branch `data`: diario/YYYY-MM/YYYY-MM-DD-<persona>.md
                                                                 │
  25 del mese   GitHub Action "Recap mensile" ── LLM ──▶ recap/YYYY-MM/<persona>.md ──Telegram──▶ "Ti torna?" [Conferma] [Integra]
  27 e 29       GitHub Action "Promemoria"    ──────────▶ sollecito a chi non ha confermato
  ultimo giorno GitHub Action "Report PPT"    ── LLM ──▶ report/YYYY-MM/YYYY-MM-<persona>.pptx (dal template)
```

Nessun server da gestire: il bot è un Worker gratuito; le elaborazioni girano su GitHub Actions o su una routine locale, con Claude Code in abbonamento (default) o con l'API Anthropic. Dettagli in [docs/ESECUZIONE-LLM.md](docs/ESECUZIONE-LLM.md).

## Scelte di default

| Tema | Scelta | Dove cambiarla |
|---|---|---|
| Repo | Un solo repo: codice su `main`, dati sul branch `data` (commit automatici) | variabile `DATA_BRANCH` |
| LLM | `LOCAL` (default): Claude Code CLI con l'abbonamento, nessuna chiave API. `API_KEY`: API Anthropic a consumo. Entrambi dietro `LlmClient` | `LLM_PROVIDER`, `LLM_MODEL`, `src/adapters/llm/` |
| Recap non confermato | Il report esce lo stesso, con "NON confermato dal venditore" in copertina | `src/application/build-monthly-report.ts` |
| Template PPT | Segnaposto generato da `npm run template:generate` | `templates/report-mensile.pptx` o variabile `REPORT_TEMPLATE` |
| Report | Un PPT per venditore | `DataLayout.reportFile` |
| Fuso orario | `Europe/Rome` (giorno del diario e "ultimo giorno del mese") | `TIMEZONE` |

## Struttura

```
src/
  domain/        YearMonth, LocalDateTime, Person, DiaryFormatter, MonthlyRecap, DataLayout
  ports/         FileStore, PeopleDirectory, LlmClient, RecapNotifier, PresentationRenderer, ContextRepository, Clock
  application/   AppendMessageToDiary, GenerateMonthlyRecap, ReviewRecap, SendRecapReminders, BuildMonthlyReport
  adapters/      github (API contents), telegram (handler, notifier), llm (Anthropic), pptx (template), config
  entrypoints/   worker/ (webhook Telegram), jobs/ (recap, promemoria, report)
context/         contesto aziendale e istruzioni per l'LLM (le "skill" del progetto)
templates/       template PPT con segnaposto {{nome}}
```

Pattern usati: Ports & Adapters, Repository (`FileStore`), Strategy + Factory (fornitore LLM), Chain of Responsibility (gestori degli update Telegram), Observer (`RecapGeneratedListener`), Value Object immutabili nel dominio.

## Template PPT

Il renderer cerca nelle slide i segnaposto `{{nome}}`:

- `mese`, `venditore`, `stato_recap` li compila il codice;
- tutti gli altri li compila l'LLM, con risposta JSON validata sui segnaposto effettivamente presenti.

Per usare il template aziendale basta inserire i segnaposto nelle caselle di testo e salvarlo in `templates/`. Un paragrafo che contiene solo un segnaposto diventa un elenco se il valore ha più righe (ogni riga eredita la formattazione, per esempio il punto elenco). Aggiornare `context/istruzioni-report.md` con il significato dei nuovi segnaposto.

## Configurazione

### 1. Bot Telegram

1. Crea il bot con [@BotFather](https://t.me/BotFather) e salva il token.
2. Ogni venditore apre il bot e scrive `/start`: il bot risponde con il suo ID Telegram.

### 2. Branch dati

Crea il branch `data` (una volta) con l'anagrafica venditori in `config/persone.json`:

```json
[
  { "slug": "mario", "nome": "Mario Rossi", "telegramUserId": 123456789 }
]
```

`slug` va nei nomi dei file (solo `a-z`, `0-9`, `-`). Esempio in `docs/esempio-persone.json`.

### 3. Secret e variabili

Nessun segreto nel repo.

| Nome | Tipo | Dove | Uso |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | secret | Worker + Actions | Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | secret | Worker | verifica che le chiamate arrivino da Telegram |
| `GITHUB_TOKEN` | secret | Worker | token fine-grained, solo questo repo, permesso *Contents: read and write* |
| `ANTHROPIC_API_KEY` | secret | Actions | recap e report |
| `DATA_REPO`, `DATA_BRANCH`, `TIMEZONE` | variabili | `wrangler.toml` | già impostate |
| `DATA_BRANCH`, `TIMEZONE`, `LLM_MODEL`, `REPORT_TEMPLATE` | variabili (facoltative) | Actions → Variables | override dei default |

Nelle Actions `GITHUB_TOKEN` è quello automatico del workflow.

### 4. Deploy del Worker

```bash
npm ci
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
npm run worker:deploy
```

Poi registra il webhook (sostituisci URL del Worker, token e secret):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://report-aziendale-bot.<account>.workers.dev/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","callback_query"]'
```

### 5. Job schedulati

I workflow in `.github/workflows/` partono da soli (orari in UTC) e si possono lanciare a mano da *Actions → Run workflow*, indicando il mese `YYYY-MM`. Nota: GitHub esegue i cron solo dal branch di default.

## Test end-to-end

Guida passo passo, chiavi comprese, per provare il giro completo con dati finti: [docs/TESTING.md](docs/TESTING.md).

## Sviluppo

```bash
npm ci
npm run build      # typecheck
npm test           # unit + e2e
npm run test:unit
npm run test:e2e
npm run release    # standard-version: bump versione + CHANGELOG
```

Commit in stile [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`...), un commit per funzionalità.
