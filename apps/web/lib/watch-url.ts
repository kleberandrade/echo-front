/** Names select a public stream; they do not grant access or authenticate an agent. */
export function watchTarget(baseUrl: string, candidate: string | string[] | undefined) {
  const agent =
    typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 48
      ? candidate
      : undefined;
  const url = new URL(baseUrl);
  if (agent) url.searchParams.set('agent', agent);
  else url.searchParams.delete('agent');
  return { agent, url: url.toString() };
}
