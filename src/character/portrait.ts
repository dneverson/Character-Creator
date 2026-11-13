// The character's portrait: a small square picture kept in the character as a data URL.
// What the app writes and what a file may hold are the same thing, checked here.

/** Side of the stored square, in pixels. */
export const PORTRAIT_SIZE = 256

/** The biggest picture file the editor accepts, in bytes. */
export const PORTRAIT_MAX_FILE_BYTES = 20 * 1024 * 1024

/** The longest data URL kept; a 256 pixel square is a tenth of this. */
export const PORTRAIT_MAX_LENGTH = 300_000

/** Encodings of the stored picture, in the order tried, and the quality of a lossy one. */
export const PORTRAIT_FORMATS = ['image/webp', 'image/jpeg'] as const
export const PORTRAIT_QUALITY = 0.85

const PORTRAIT_URL =
  /^data:image\/(?:webp|jpeg|png|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/

export const PORTRAIT_NOT_AN_IMAGE =
  'That file is not an image this browser can read. Choose a PNG, JPEG, WebP, GIF or AVIF picture.'
export const PORTRAIT_TOO_BIG = 'That picture is larger than 20 MB. Choose a smaller one.'
export const PORTRAIT_NOT_SAVED = 'The portrait could not be prepared. Try another image.'

/** Whether a value is a picture the character may keep as its portrait. */
export function isPortrait(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= PORTRAIT_MAX_LENGTH &&
    PORTRAIT_URL.test(value)
  )
}

/** Why a picked file cannot be used, judged by its size alone; undefined when it can. */
export function portraitFileProblem(bytes: number): string | undefined {
  return bytes > PORTRAIT_MAX_FILE_BYTES ? PORTRAIT_TOO_BIG : undefined
}
