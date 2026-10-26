function cleanSlice(text: string): boolean {
  return text.trim() === text && !text.includes("  ");
}

export function affectedLineNumbers(code: string, evidence: string): readonly number[] {
  const lines = code.split("\n");
  if (evidence.length === 0) return [];
  const direct = lines.flatMap((line, index) => (line.includes(evidence) ? [index + 1] : []));
  if (direct.length > 0) return direct;

  const marked = new Set<number>();
  for (let start = 0; start < evidence.length; start += 1) {
    const longest = Math.min(evidence.length - start, 80);
    for (let length = longest; length >= 8; length -= 1) {
      const slice = evidence.slice(start, start + length);
      if (!cleanSlice(slice)) continue;
      const hits = lines.flatMap((line, index) => (line.includes(slice) ? [index + 1] : []));
      if (hits.length === 0) continue;
      for (const line of hits) marked.add(line);
      break;
    }
  }
  return [...marked].sort((left, right) => left - right);
}
