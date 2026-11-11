import { act } from '@testing-library/react'

/**
 * Let every data load that a render started finish inside `act()`.
 *
 * Sections load their data on mount. A test that asserts straight after rendering
 * ends while those loads are still pending, so their state updates land after the
 * test and React reports them as not wrapped in `act()`. Awaiting this after the
 * first assertion flushes the pending loads, and lets the test assert again on the
 * loaded state.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}
