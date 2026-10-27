export function isNearBottom(metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }, threshold = 80): boolean {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= threshold
}
