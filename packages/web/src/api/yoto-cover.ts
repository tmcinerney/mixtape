// AIDEV-NOTE: Cover image upload, per yoto.dev/myo/uploading-cover-images.
//
// A cover is NOT a track icon. The two are separate concepts in Yoto's schema:
//   metadata.cover.imageL   -> the card artwork shown in the app. A plain URL.
//   display.icon16x16       -> 16x16 pixel art shown ON THE PLAYER while a track
//                              plays. Must match ^yoto:#[a-zA-Z0-9_-]{43}$.
// The create-playlist dialog used to offer the icon picker for cover art, which is
// the wrong asset entirely — and `metadata.icon` is not even in the card schema.
const YOTO_API_BASE = 'https://api.yotoplay.com'

export interface CoverImage {
  mediaId: string
  mediaUrl: string
}

/**
 * Upload a cover image and return its media URL, ready for metadata.cover.imageL.
 *
 * `autoconvert=true` lets Yoto resize and re-encode to its cover dimensions, so the
 * user can pick any reasonable image rather than having to prepare one.
 */
export async function uploadCoverImage(file: Blob, token: string): Promise<CoverImage> {
  const url = new URL(`${YOTO_API_BASE}/media/coverImage/user/me/upload`)
  url.searchParams.set('autoconvert', 'true')
  url.searchParams.set('coverType', 'default')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // AIDEV-NOTE: The raw image is the body — not multipart, despite the endpoint
      // name. Content-Type must be the image's own type.
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Cover upload failed: ${res.status}${detail ? ` ${detail}` : ''}`)
  }

  const data = (await res.json()) as { coverImage?: Partial<CoverImage> }
  const mediaUrl = data.coverImage?.mediaUrl
  if (!mediaUrl) {
    throw new Error('Cover upload succeeded but returned no mediaUrl')
  }

  return { mediaId: data.coverImage?.mediaId ?? '', mediaUrl }
}
