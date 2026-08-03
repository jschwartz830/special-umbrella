import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const REORDER_INDEX_ATTRIBUTE = 'data-reorder-index'

/** Pointer-based list reordering that works with a mouse, pen, or touch screen. */
export function useDragReorder(onReorder: (fromIdx: number, toIdx: number) => void) {
  const activeIndexRef = useRef<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const startDrag = useCallback((index: number, event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return

    event.preventDefault()
    activeIndexRef.current = index
    dropIndexRef.current = index
    activePointerRef.current = event.pointerId
    setDragIndex(index)
    setDropIndex(index)
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (activeIndexRef.current === null || activePointerRef.current !== event.pointerId) return

    event.preventDefault()
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(`[${REORDER_INDEX_ATTRIBUTE}]`)
    const nextIndex = Number(target?.getAttribute(REORDER_INDEX_ATTRIBUTE))

    if (!Number.isInteger(nextIndex) || nextIndex === dropIndexRef.current) return

    // Keep the list still while the pointer is down. Moving the captured handle's
    // DOM node during a drag can cancel subsequent pointer events in some browsers,
    // which made a gesture stop after a single position. The highlighted target
    // moves instead, and the data is reordered once when the gesture finishes.
    dropIndexRef.current = nextIndex
    setDropIndex(nextIndex)
  }, [])

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (activePointerRef.current !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (activeIndexRef.current !== null && dropIndexRef.current !== null && activeIndexRef.current !== dropIndexRef.current) {
      onReorder(activeIndexRef.current, dropIndexRef.current)
    }
    activeIndexRef.current = null
    dropIndexRef.current = null
    activePointerRef.current = null
    setDragIndex(null)
    setDropIndex(null)
  }, [onReorder])

  return { dragIndex, dropIndex, startDrag, moveDrag, endDrag }
}
