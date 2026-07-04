/** Cutoff pro mazání starých learning_events (GDPR data-minimisation). */
export function retentionCutoffIso(now: Date, days = 365): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
