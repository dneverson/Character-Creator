// A picture of a book, drawn where the text puts it. The images are a separate, very
// large store: they come from the image repository of the content source (the same one
// the covers come from, never from this site), and a picture is fetched only when it is
// about to scroll into view. Its space is reserved from the size the text gives, so the
// text does not jump when it arrives. When it cannot be had, its place says so in words.
// A click opens it larger (see ImageViewer.tsx); a map lists the areas drawn on it, each
// a link to the heading of that area.

import { useContext, useRef, useState } from 'react'
import Spinner from 'react-bootstrap/Spinner'
import { useVisible } from '../hooks/useVisible'
import { EntryContext, type ImageEntry } from '../text/entryContext'
import { TaggedText } from '../text/TaggedText'
import { stripTags } from '../text/tags'
import { placeOfTarget } from './address'
import { sortAreas } from './areas'
import { BookLink } from './BookLink'
import { ImageViewer } from './ImageViewer'
import { labelOf, pathOf, useImageSource } from './imageSource'

/** How far before a picture comes into view it starts to load. */
const PRELOAD_MARGIN = '600px 0px'

/** The areas drawn on a map, each with the heading it points to, and the way to the parent map. */
function MapPlaces({ image }: { image: ImageEntry }) {
  const context = useContext(EntryContext)
  const { doc, ids } = context ?? {}
  if (!doc || !ids) return null
  const areas = sortAreas(
    (image.mapRegions ?? []).flatMap((region) => {
      const target = ids.get(region.area)
      return target ? [{ key: region.area, target }] : []
    }),
  )
  const parent = image.mapParent ? ids.get(image.mapParent.id) : undefined
  if (areas.length === 0 && !parent) return null
  return (
    <div className="book-map-places">
      {parent && (
        <p className="book-map-parent">
          Player version of{' '}
          <BookLink place={placeOfTarget(doc, parent)}>{parent.name}</BookLink>
        </p>
      )}
      {areas.length > 0 && (
        <>
          <p className="book-map-title">Areas on this map</p>
          <ul className="book-map-areas">
            {areas.map(({ key, target }) => (
              <li key={key}>
                <BookLink place={placeOfTarget(doc, target)}>{target.name}</BookLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function BookImage({
  image,
  root,
  group,
}: {
  image: ImageEntry
  /** The area that scrolls the text, which decides when a picture is near. */
  root: Element | null
  /** The pictures of the gallery this one is in, which the viewer steps through. */
  group?: ImageEntry[]
}) {
  const path = pathOf(image)
  const frame = useRef<HTMLDivElement>(null)
  const near = useVisible(frame, { root, rootMargin: PRELOAD_MARGIN })
  const source = useImageSource(path)
  const [loaded, setLoaded] = useState(false)
  const [viewing, setViewing] = useState(false)
  const unavailable = !source.src
  const title = labelOf(image)
  const label = title ? stripTags(title) : 'Illustration'
  const known = image.width && image.height ? image.width / image.height : undefined
  const classes = [
    'book-figure',
    image.imageType && `book-figure-${image.imageType}`,
    image.style && `book-figure-${image.style}`,
    image.expectsLightBackground && 'is-light-ground',
  ]
    .filter(Boolean)
    .join(' ')
  const widest = image.maxWidth ?? image.width

  return (
    <figure className={classes} id={image.id ? `book-image-${image.id}` : undefined}>
      <div
        ref={frame}
        className={`book-figure-frame${loaded ? ' is-loaded' : ''}`}
        style={{
          aspectRatio: known && !unavailable ? String(known) : undefined,
          maxWidth: widest ? `min(${widest}px, 100%)` : undefined,
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
              <button
                type="button"
                className="book-figure-open"
                aria-label={`Open ${label} larger`}
                onClick={() => setViewing(true)}
              >
                <img
                  key={source.attempt}
                  src={source.src}
                  alt={image.altText ?? label}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setLoaded(true)}
                  onError={source.onError}
                />
              </button>
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
      <MapPlaces image={image} />
      {viewing && (
        <ImageViewer
          images={group && group.includes(image) ? group : [image]}
          start={group && group.includes(image) ? group.indexOf(image) : 0}
          onClose={() => setViewing(false)}
        />
      )}
    </figure>
  )
}
