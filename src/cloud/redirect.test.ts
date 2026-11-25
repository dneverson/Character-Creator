import { describe, expect, it } from 'vitest'
import { sessionKey, signInRedirect, takeAuthCode } from './redirect'

describe('the sign-in link and the address bar', () => {
  it('leads back to the site wherever it is served from', () => {
    expect(signInRedirect('http://localhost:5183', '/')).toBe('http://localhost:5183/')
    expect(signInRedirect('https://dneverson.github.io', '/Character-Creator/')).toBe(
      'https://dneverson.github.io/Character-Creator/',
    )
  })

  it('names the setting the sign-in library keeps its session in', () => {
    expect(sessionKey('https://abcdef.supabase.co')).toBe('sb-abcdef-auth-token')
  })

  it('takes the code out of the address and leaves the place alone', () => {
    expect(takeAuthCode('https://x.io/Character-Creator/?code=abc&keep=1#/')).toEqual({
      code: 'abc',
      next: '/Character-Creator/?keep=1#/',
    })
    expect(takeAuthCode('https://x.io/Character-Creator/?code=abc')?.next).toBe(
      '/Character-Creator/',
    )
    expect(takeAuthCode('https://x.io/Character-Creator/#/account')).toBeNull()
  })
})
