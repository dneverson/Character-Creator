// A picture of a book, drawn where the text puts it. The images are a separate, very
// large store: they come from the image repository of the content source (the same one
// the covers come from, never from this site), and a picture is fetched only when it is
// about to scroll into view. Its space is reserved from the size the text gives, so the
// text does not jump when it arrives. When it cannot be had, its place says so in words.

import { useRef, useState } from 'react'
import Spinner from 'react-bootstrap/Spinner'
import { coverUrls } from '../content/covers'
import { useVisible } from '../hooks/useVisible'
import { TaggedText } from '../text/TaggedText'
import { stripTags } from '../text/tags'
import type { ImageEntry } from '../text/entryContext'

/** How far before a picture comes into view it starts to load. */
const PRELOAD_MARGIN = '600px 0px'

export function BookImage({
  image,
  root,
}: {
  image: ImageEntry
  /** The area that scrolls the text, which decides when a picture is near. */
  root: Element | null
}) {
  const path = image.href?.type === 'internal' ? image.href.path : undefined
  const frame = useRef<HTMLDivElement>(null)
  const near = useVisible(frame, { root, rootMargin: PRELOAD_MARGIN })
  const sources = path ? coverUrls(path) : []
  const [failed, setFailed] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const unavailable = failed >= sources.length
  const title = image.title
  const label = title ? stripTags(title) : 'Illustration'
  const known = image.width && image.height ? image.width / image.height : undefined

  return (
    <figure
      className={`book-figure${image.imageType ? ` book-figure-${image.imageType}` : ''}`}
    >
      <div
        ref={frame}
        className={`book-figure-frame${loaded ? ' is-loaded' : ''}`}
        style={{
          aspectRatio: known && !unavailable ? String(known) : undefined,
          maxWidth: image.width ? `min(${image.width}px, 100%)` : undefined,
        }}
      >
        {unavailable ? (
          <p className="book-figure-missing">
            {path
              ? 'This picture could not be loaded.'
              : 'This picture is not in the content.'}
          </p>
        ) : (
          <>
            {!loaded && (
              <Spinner
                className="book-figure-spinner"
                animation="border"
                size="sm"
                role="status"
              >
                <span className="visually-hidden">Loading {label}</span>
              </Spinner>
            )}
            {near && (
              <img
                // A new address (the next host) is a new request.
                key={failed}
                src={sources[failed]}
                alt={image.altText ?? label}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed((count) => count + 1)}
              />
            )}
          </>
        )}
      </div>
      {(title || image.credit) && (
        <figcaption>
          {title && <TaggedText text={title} />}
          {image.credit && (
            <span className="book-figure-credit"> Art: {image.credit}</span>
          )}
        </figcaption>
      )}
    </figure>
  )
}
