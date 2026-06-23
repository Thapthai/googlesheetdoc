export function buildColumnLetters(): string[] {
  const base = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const letters = [...base];
  for (const a of base) {
    for (const b of base) {
      letters.push(a + b);
    }
  }
  return letters;
}

export const COLUMN_LETTERS = buildColumnLetters();

export function colLetter(index: number): string {
  return COLUMN_LETTERS[index] ?? "A";
}
