export const CHECKLIST_TITLE_LIMIT = 42;

export function splitChecklistText(text: string) {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= CHECKLIST_TITLE_LIMIT) {
    return { title: clean };
  }

  const boundary = clean.lastIndexOf(' ', CHECKLIST_TITLE_LIMIT);
  const splitAt = boundary > 18 ? boundary : CHECKLIST_TITLE_LIMIT;

  return {
    title: clean.slice(0, splitAt).trim(),
    description: clean.slice(splitAt).trim(),
  };
}
