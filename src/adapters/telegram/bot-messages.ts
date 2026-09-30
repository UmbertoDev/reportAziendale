/** Testi mostrati dal bot, in un solo punto. */
export const BotMessages = {
  welcome: (userId: number) =>
    `Ciao! Scrivimi le attività della giornata e le salvo nel tuo diario.\n` +
    `Il tuo ID Telegram è ${userId}: comunicalo a chi gestisce il bot per essere abilitato.`,
  saved: "Salvato nel diario ✅",
  unknownUser: (userId: number) =>
    `Non sei ancora abilitato. Comunica il tuo ID Telegram (${userId}) a chi gestisce il bot.`,
  emptyMessage: "Il messaggio è vuoto, non ho salvato nulla.",
  error: "Si è verificato un errore, riprova tra poco.",
  review: {
    confirmed: "Grazie, recap confermato ✅",
    "already-confirmed": "Il recap era già confermato 👍",
    integrated: "Integrazione salvata nel recap ✅",
    "recap-not-found": "Non trovo un recap per quel mese.",
    "unknown-user": "Non sei abilitato a questa operazione.",
  },
} as const;
