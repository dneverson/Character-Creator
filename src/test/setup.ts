import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import { useContentSettings } from '../content/settings'

// jsdom does not implement Blob.text(); back it with FileReader so file-import
// code paths (which call `file.text()`) are testable.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

// jsdom does not implement scrollIntoView; stub it so focus-management code
// (which keeps the cursor row in view) runs without throwing under tests.
if (
  typeof Element !== 'undefined' &&
  typeof Element.prototype.scrollIntoView !== 'function'
) {
  Element.prototype.scrollIntoView = function (): void {}
}

// jsdom does not implement matchMedia; provide a minimal stub for theme logic.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom computes no transition timing: it reports an empty string where a browser
// reports the CSS initial value "0s". React-Bootstrap parses those values to time
// its transitions, and an empty string turns into NaN passed to setTimeout. Report
// the initial values so a transition resolves the way it does in a browser that
// has no transition styles.
if (typeof window !== 'undefined') {
  const TRANSITION_INITIAL: Record<string, string> = {
    'transition-duration': '0s',
    'transition-delay': '0s',
  }
  const computeStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = (element, pseudoElement) => {
    const style = computeStyle(element, pseudoElement)
    const read = style.getPropertyValue.bind(style)
    style.getPropertyValue = (property) =>
      read(property) || (TRANSITION_INITIAL[property] ?? '')
    return style
  }
}

// jsdom does not implement Blob.arrayBuffer() either; back it with FileReader so
// code that reads picked files as bytes is testable.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

// Unit tests never touch the network. A test that needs a response stubs `fetch`
// itself; anything else gets a clear failure instead of a real request.
globalThis.fetch = () =>
  Promise.reject(new Error('Network access is disabled in unit tests'))

// Unit tests run on the free rules unless a test switches the full content on,
// so no test reaches for the content source by accident.
beforeEach(() => {
  useContentSettings.setState({ fullContent: false })
})
