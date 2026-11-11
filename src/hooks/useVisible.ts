import { useEffect, useState, type RefObject } from 'react'

/**
 * Whether the element has been on screen yet. Turns true the first time any part
 * of it is visible and stays true, so work that should wait until something can
 * be seen (loading an image, say) starts once and is never undone. A browser
 * without `IntersectionObserver` reports everything as visible.
 */
export function useVisible(ref: RefObject<Element | null>): boolean {
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    const element = ref.current
    if (visible || !element) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, visible])

  return visible
}
