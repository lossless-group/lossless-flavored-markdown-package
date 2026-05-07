/** Format a Date as e.g. "May 3, 2026" — used in changelog teasers + detail. */
export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Compact ISO yyyy-mm-dd. Used as the dateline above titles. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
