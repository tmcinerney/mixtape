export type UrlClassification =
  | { type: 'video'; videoId: string }
  | { type: 'playlist'; listId: string }
  | { type: 'ambiguous'; videoId: string; listId: string }
  | { type: 'rejected'; reason: string }

// AIDEV-NOTE: WL = Watch Later, LL = Liked Videos — both are private and cannot be fetched via API
const REJECTED_LISTS = new Set(['WL', 'LL'])

export function classifyUrl(url: string): UrlClassification {
  const parsed = new URL(url)
  const videoId = parsed.searchParams.get('v') ?? parsed.pathname.split('/').pop() ?? ''
  const listId = parsed.searchParams.get('list')

  if (listId && REJECTED_LISTS.has(listId)) {
    return {
      type: 'rejected',
      reason: `${listId === 'WL' ? 'Watch Later' : 'Liked Videos'} playlists can't be imported`,
    }
  }
  if (listId && videoId && parsed.pathname.includes('watch')) {
    return { type: 'ambiguous', videoId, listId }
  }
  if (listId) {
    return { type: 'playlist', listId }
  }
  return { type: 'video', videoId }
}
