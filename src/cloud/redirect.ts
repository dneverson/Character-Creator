// How the emailed sign-in link and the app's address bar meet. The app keeps its place in
// the hash (#/...), so the link comes back with a one-time `code` in the query part of the
// address, which is read once and taken out of the address. The hash is never given to the
// sign-in library.

/** Where the sign-in link leads: the site's own address, wherever it is served from. */
export function signInRedirect(origin: string, baseUrl: string): string {
  return `${origin}${baseUrl}`
}

/** The device setting the sign-in library keeps a session in, for a project's address. */
export function sessionKey(projectUrl: string): string {
  return `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`
}

/**
 * The one-time code a sign-in link came back with, if the address holds one. `next` is
 * the same address with the code taken out; the hash is left as it is, so the user lands
 * where the address already pointed (the link leads to the site's own address, which has
 * none, so that is the Characters list).
 */
export function takeAuthCode(address: string): { code: string; next: string } | null {
  const url = new URL(address)
  const code = url.searchParams.get('code')
  if (!code) return null
  url.searchParams.delete('code')
  return { code, next: `${url.pathname}${url.search}${url.hash}` }
}
