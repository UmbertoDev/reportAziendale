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
} as const;
