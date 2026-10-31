/* The "Most popular" order of the practice library: the template that more different people
   practised in the last days comes first. The numbers come from GET /template-popularity
   (counts of people, not of drawings). */

/** How many people practised this template; 0 when the numbers are missing or do not list it. */
function countOf(counts: Record<string, number> | undefined, id: string): number {
  if (!counts || !Object.hasOwn(counts, id)) return 0 // an id like "constructor" is not a count
  const n = counts[id]
  return Number.isFinite(n) ? n : 0
}

/**
 * Comparator for `Array.prototype.sort`, most practised first. `sort` is stable, so templates with
 * the same count keep the order they came in (the API's own order). While the numbers are loading
 * or have failed, every count is 0 and the list stays in the API's order: no error is shown.
 */
export const byPopularity =
  (counts: Record<string, number> | undefined) =>
  (a: { id: string }, b: { id: string }): number =>
    countOf(counts, b.id) - countOf(counts, a.id)
