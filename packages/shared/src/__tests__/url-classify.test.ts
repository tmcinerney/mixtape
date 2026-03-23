import { describe, expect, it } from 'vitest'
import { classifyUrl } from '../url-classify'

describe('classifyUrl', () => {
  it('detects single video', () => {
    expect(classifyUrl('https://www.youtube.com/watch?v=abc123')).toEqual({
      type: 'video',
      videoId: 'abc123',
    })
  })
  it('detects youtu.be short URL', () => {
    expect(classifyUrl('https://youtu.be/abc123')).toEqual({ type: 'video', videoId: 'abc123' })
  })
  it('detects playlist', () => {
    expect(classifyUrl('https://www.youtube.com/playlist?list=PLabc')).toEqual({
      type: 'playlist',
      listId: 'PLabc',
    })
  })
  it('detects ambiguous (video + playlist)', () => {
    expect(classifyUrl('https://www.youtube.com/watch?v=abc&list=PLxyz')).toEqual({
      type: 'ambiguous',
      videoId: 'abc',
      listId: 'PLxyz',
    })
  })
  it('rejects Watch Later', () => {
    const result = classifyUrl('https://www.youtube.com/watch?v=abc&list=WL')
    expect(result).toEqual({ type: 'rejected', reason: expect.stringContaining('Watch Later') })
  })
  it('rejects Liked Videos', () => {
    const result = classifyUrl('https://www.youtube.com/watch?v=abc&list=LL')
    expect(result).toEqual({ type: 'rejected', reason: expect.stringContaining('Liked Videos') })
  })
})
