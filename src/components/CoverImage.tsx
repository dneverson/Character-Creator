// A cover image that enlarges into a lightbox modal on click. Reusable across
// detail panes (book, and later class/background) so every "hero" image gets the
// same click-to-enlarge affordance.
//
// The full image comes straight from the content source, so it can be slow or
// fail. A cover is therefore never blank: while it is on its way the thumbnail
// stands in (when there is one), otherwise a spinner; when it cannot be had a
// plain placeholder says so.

import { useRef, useState, type CSSProperties } from 'react'
import Modal from 'react-bootstrap/Modal'
import Spinner from 'react-bootstrap/Spinner'
import type { CoverThumb } from '../content/useCoverThumb'

interface Props {
  /** URLs of the full image, tried in order: the next one answers when one fails. */
  sources: string[]
  alt: string
  /** Inline (un-enlarged) image width in px. Overridden by any size in `imgStyle`. */
  width?: number
  /**
   * The image's small thumbnail, when it has one. It is shown while the full image
   * loads and when the full image cannot be had; with `compact` it is all that is
   * shown inline.
   */
  thumb?: CoverThumb
  /**
   * Show only the thumbnail inline (a table row). The full image is then fetched
   * when the lightbox opens, not before.
   */
  compact?: boolean
  /** Extra inline-image style (e.g. a grid's fixed height); merged last. */
  imgStyle?: CSSProperties
  className?: string
  /**
   * In a roving-tabindex grid (src/components/table): make the enlarge button not
   * a natural tab stop (`tabIndex -1`) and tag it so the grid's arrow navigation
   * can move focus onto it as its own zone. Off elsewhere (e.g. the detail pane),
   * where the button is an ordinary tab stop.
   */
  rovingTarget?: boolean
}

/** The full image: which source is being tried, and whether it has arrived. */
function useFullImage(sources: string[]) {
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  return {
    src: sources[index],
    status:
      index >= sources.length
        ? ('unavailable' as const)
        : loaded
          ? ('ready' as const)
          : ('loading' as const),
    onLoad: () => setLoaded(true),
    // This source failed: move on to the next one.
    onError: () => {
      setLoaded(false)
      setIndex((current) => current + 1)
    },
  }
}

/** Remount when the image itself changes, so no loading state carries over. */
export function CoverImage(props: Props) {
  return <Cover key={props.sources[0]} {...props} />
}

function Cover({
  sources,
  alt,
  width = 120,
  thumb,
  compact = false,
  imgStyle,
  className,
  rovingTarget = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const full = useFullImage(sources)
  // The enlarged view's own close button. Focused once the lightbox has opened
  // so a second Enter (or Esc) closes it - the "Enter opens, Enter again closes"
  // toggle the owner wanted, working the same whether the lightbox was opened by
  // a grid row's image zone or the detail pane's cover.
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const fullInline = !compact && full.status === 'ready'
  const inlineSrc = fullInline
    ? full.src
    : thumb?.status === 'ready'
      ? thumb.url
      : undefined
  const pending = thumb?.status === 'loading' || (!compact && full.status === 'loading')
  const boxStyle: CSSProperties = { width, aspectRatio: '3 / 4', ...imgStyle }

  return (
    <>
      {inlineSrc ? (
        <button
          type="button"
          className="p-0 border-0 bg-transparent"
          style={{ flexShrink: 0, lineHeight: 0 }}
          // Stop the click here so an enclosing clickable row (e.g. the books grid)
          // does not also react; the button's only job is to open the lightbox.
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          // In a grid the row is the single tab stop; this button is reachable via
          // the grid's arrow navigation instead (data-nav-target marks it as that
          // row's image zone). Elsewhere it stays an ordinary tab stop.
          tabIndex={rovingTarget ? -1 : undefined}
          data-nav-target={rovingTarget ? 'image' : undefined}
          aria-label={`Enlarge ${alt}`}
          title="Click to enlarge"
        >
          <img
            src={inlineSrc}
            alt={alt}
            className={className}
            style={{ width, height: 'auto', cursor: 'zoom-in', ...imgStyle }}
          />
        </button>
      ) : (
        <span
          className={`d-inline-flex align-items-center justify-content-center text-body-secondary ${className ?? ''}`}
          style={{ flexShrink: 0, ...boxStyle }}
          title={pending ? undefined : 'Cover not available'}
        >
          {pending ? (
            <Spinner size="sm" animation="border" role="status">
              <span className="visually-hidden">Loading {alt}</span>
            </Spinner>
          ) : (
            <>
              <span aria-hidden="true">-</span>
              <span className="visually-hidden">{alt} not available</span>
            </>
          )}
        </span>
      )}
      {/* Fetch the full image out of sight until it can replace the stand-in. While
          the lightbox is open its own image does the fetching, so that only one
          element ever reports on a source. */}
      {!compact && !open && full.status === 'loading' && (
        <img src={full.src} alt="" hidden onLoad={full.onLoad} onError={full.onError} />
      )}
      <Modal
        show={open}
        onHide={() => setOpen(false)}
        centered
        size="lg"
        // Focus the close button once the open transition finishes so Enter and
        // Esc both close the lightbox from the keyboard (Enter-again-to-close).
        onEntered={() => closeBtnRef.current?.focus()}
      >
        <Modal.Body className="p-2">
          <button
            ref={closeBtnRef}
            type="button"
            className="p-0 border-0 bg-transparent d-block w-100"
            style={{ lineHeight: full.status === 'unavailable' ? undefined : 0 }}
            // Stop the close click here too: React routes synthetic events through
            // the component tree, so a portalled modal's click still bubbles into
            // an enclosing clickable row (the books grid). Without this, closing
            // the lightbox would also fire the row's click and open the detail.
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            aria-label="Close enlarged image"
          >
            {full.status === 'unavailable' ? (
              <span className="d-block text-body-secondary py-5">
                The full-size cover could not be loaded.
              </span>
            ) : (
              <>
                {full.status === 'loading' && (
                  <span
                    className="d-flex align-items-center justify-content-center"
                    style={{ minHeight: '12rem' }}
                  >
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading {alt}</span>
                    </Spinner>
                  </span>
                )}
                <img
                  src={full.src}
                  alt={alt}
                  hidden={full.status === 'loading'}
                  className="w-100 rounded"
                  style={{ height: 'auto', cursor: 'zoom-out' }}
                  onLoad={full.onLoad}
                  onError={full.onError}
                />
              </>
            )}
          </button>
        </Modal.Body>
      </Modal>
    </>
  )
}
