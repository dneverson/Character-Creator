// The address of a shared character: `<origin><base>#/shared/<token>`. The token is the
// whole secret, made by the database (128 random bits as hexadecimal digits).

import { appConfig } from '../config/app'

const { route, tokenLength } = appConfig.cloud.share

const TOKEN = new RegExp(`^[0-9a-f]{${tokenLength}}$`)

/** Whether `text` is shaped like a share token. */
export function isShareToken(text: string): boolean {
  return TOKEN.test(text)
}

/** The link to give someone: the site's own address, wherever it is served from. */
export function shareLink(origin: string, baseUrl: string, token: string): string {
  return `${origin}${baseUrl}#/${route}/${token}`
}

/** The hash a shared character is opened at. */
export function sharedHash(token: string): string {
  return `#/${route}/${token}`
}

/** The hash segment that names a shared character's address. */
export const SHARED_ROUTE = route
