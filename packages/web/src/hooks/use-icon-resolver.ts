import { useMemo } from 'react'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { useYotoQuery } from './use-yoto-query'

/**
 * Fetches all display icons and builds a ref→URL lookup map.
 *
 * AIDEV-NOTE: Yoto stores icons as "yoto:#mediaId" refs in chapter.display.icon16x16.
 * This hook resolves those refs to renderable URLs by fetching the full icon list.
 * The list is cached via useYotoQuery so it's only fetched once per session.
 */
export function useIconResolver() {
  const { data: icons } = useYotoQuery<DisplayIcon[]>((sdk) => sdk.icons.getDisplayIcons())

  const refToUrl = useMemo(() => {
    if (!icons) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const icon of icons) {
      map.set(`yoto:#${icon.mediaId}`, icon.url)
    }
    return map
  }, [icons])

  return {
    /** Resolve a yoto:#mediaId ref to a display URL. Returns undefined if not found. */
    resolve: (ref: string | undefined) => (ref ? refToUrl.get(ref) : undefined),
    loaded: icons !== null,
  }
}
