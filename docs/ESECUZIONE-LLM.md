# Dove e come girano i job con Claude

I job **recap** e **report** usano un LLM; il job **promemoria** no. Il motore si sceglie con una variabile:

| `LLM_PROVIDER` | Motore | Serve | Costo |
|---|---|---|---|
| `LOCAL` (default, anche se non impostato) | Claude Code CLI con l'**abbonamento** Claude (Pro/Max) | login di Claude Code oppure `CLAUDE_CODE_OAUTH_TOKEN` | nessuno in più: usa i limiti dell'abbonamento |
| `API_KEY` | API Anthropic a consumo | `ANTHROPIC_API_KEY` (carta di credito sulla Console) | pochi centesimi a giro |

In modalità `LOCAL` il job lancia `claude -p` in una sessione "pulita": nessuno strumento, niente `CLAUDE.md`, memoria o plugin della macchina. L'output è JSON validato come con l'API. La variabile `ANTHROPIC_API_KEY`, se presente, viene tolta al processo di Claude Code, così non si paga mai a consumo per sbaglio.

`LLM_MODEL` vale per entrambe le modalità (in `LOCAL` accetta anche gli alias `sonnet`, `opus`, `haiku`).

Ci sono tre modi per far girare i job. **Consiglio l'opzione A**: non dipende da un PC acceso.

---

## Il token dell'abbonamento (serve per A e B)

Su un computer con Claude Code installato e l'abbonamento attivo:

```bash
npm install -g @anthropic-ai/claude-code   # se non c'è già
claude setup-token
```

Si apre il browser per il login e il comando stampa un token di lunga durata (`sk-ant-oat...`). È il valore di `CLAUDE_CODE_OAUTH_TOKEN`. Trattalo come una password: dà accesso all'abbonamento.

> Da verificare: l'uso dell'abbonamento personale per un processo aziendale automatico va controllato nei termini d'uso Anthropic del piano che usate. Con un piano Team/Enterprise il problema non si pone.

---

## A. GitHub Actions con l'abbonamento (consigliata)

Gli stessi workflow di sempre, ma Claude Code gira dentro GitHub Actions con il token dell'abbonamento. Nessun PC da tenere acceso, nessuna carta.

1. Codice su `main` e `main` branch di default (vedi `docs/TESTING.md`, passo 2.1).
2. **Settings → Secrets and variables → Actions → Secrets**:
   - `CLAUDE_CODE_OAUTH_TOKEN` = il token di `claude setup-token`
   - `TELEGRAM_BOT_TOKEN`
3. **Variables**:
   - `SCHEDULE_ON_ACTIONS` = `true` (accende i cron: recap il 25, promemoria 27 e 29, report l'ultimo giorno)
   - facoltative: `LLM_PROVIDER` (default `LOCAL`), `LLM_MODEL`
4. Prova subito: **Actions → Recap mensile → Run workflow**, modalità `LOCAL`, mese `2026-09`.

Il workflow installa Claude Code (`npm install -g @anthropic-ai/claude-code`) e lo usa con il token. Per passare all'API basta scegliere `API_KEY` nel "Run workflow", oppure la variabile `LLM_PROVIDER=API_KEY`, e aggiungere il secret `ANTHROPIC_API_KEY`.

Il token dura a lungo ma non per sempre: se il job fallisce con un errore di autenticazione, rigeneralo con `claude setup-token` e aggiorna il secret.

---

## B. Routine locale sul PC di un collega

I job girano con `cron` sul PC dove Claude Code è già installato e loggato. GitHub Actions non serve (lascia `SCHEDULE_ON_ACTIONS` non impostata, così non ci sono doppioni).

### Una volta sola

```bash
git clone https://github.com/UmbertoDev/reportAziendale.git
cd reportAziendale
npm ci
claude --version        # Claude Code deve esserci
```

Crea `.env` nella cartella del repo:

```bash
DATA_REPO=UmbertoDev/reportAziendale
DATA_BRANCH=data
TIMEZONE=Europe/Rome
LLM_PROVIDER=LOCAL
GITHUB_TOKEN=github_pat_...            # token fine-grained, Contents read/write (docs/TESTING.md 1.3)
TELEGRAM_BOT_TOKEN=7123456789:AAH...
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...  # consigliato: cron non sempre vede il login del portachiavi (macOS)
# LLM_MODEL=sonnet
```

### Prova a mano

```bash
scripts/local/run-job.sh recap 2026-09
tail -n 50 logs/recap.log
```

Lo script aggiorna il codice (`git pull` di `main`), installa le dipendenze, carica `.env` ed esegue il job. Il log finisce in `logs/<job>.log`.

### Pianificazione

```bash
crontab -e
```

e incolla le righe di `scripts/local/crontab.example`, con il percorso giusto. Gli orari sono quelli locali del PC:

- recap dal 25 al 28 alle 09:00: se il PC era spento il 25 recupera nei giorni seguenti, e i recap già fatti vengono saltati;
- promemoria il 27 e il 29;
- report dal 28 al 31 alle 18:00: procede solo l'ultimo giorno del mese.

Limiti di questa opzione:
- il PC deve essere acceso e sveglio a quell'ora. Se il report dell'ultimo giorno salta, si recupera a mano: `scripts/local/run-job.sh report 2026-09`;
- su macOS `cron` può aver bisogno dell'accesso completo al disco se il repo sta in Documenti o Scrivania (Impostazioni → Privacy e sicurezza → Accesso completo al disco → aggiungi `/usr/sbin/cron`), oppure tieni il repo in un'altra cartella.

---

## C. API Anthropic (alternativa già pronta)

Tutto come prima: `LLM_PROVIDER=API_KEY` e `ANTHROPIC_API_KEY` (dalla Console, con carta). Vale sia per Actions sia per la routine locale.

---

## Riepilogo

| | A. Actions + abbonamento | B. Routine locale | C. API |
|---|---|---|---|
| Carta di credito | no | no | sì |
| PC acceso | no | sì | no |
| Configurazione | 2 secret + 1 variabile | cron + `.env` sul PC | 1 secret |
| Consumo | limiti abbonamento | limiti abbonamento | a consumo |
