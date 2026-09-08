import rawSamples from './sampleTickets.json';

export const sampleTickets = rawSamples.map((t, idx) => ({
  id: t.id || (t['Sr no.'] ? `sr-${t['Sr no.']}` : `t-${idx + 1}`),
  ...t,
}));
