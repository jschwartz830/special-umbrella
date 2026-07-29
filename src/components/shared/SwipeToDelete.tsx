import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

export function SwipeToDelete({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [offset, setOffset] = useState(0)
  const swipingRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const directionRef = useRef<'h' | 'v' | null>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const REVEAL = 68

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startXRef.current
      const dy = e.touches[0].clientY - startYRef.current
      if (directionRef.current === null) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) directionRef.current = 'h'
        else if (Math.abs(dy) > 4) directionRef.current = 'v'
      }
      if (directionRef.current === 'h') {
        e.preventDefault()
        setOffset(Math.max(Math.min(dx, 0), -REVEAL))
      }
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 rounded-r-xl"
        style={{ width: REVEAL, opacity: offset < 0 ? 1 : 0, pointerEvents: offset < 0 ? 'auto' : 'none' }}
      >
        <button onClick={onDelete} aria-label="Delete" className="w-full h-full flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>
      </div>
      <div
        ref={innerRef}
        style={{ transform: `translateX(${offset}px)`, transition: swipingRef.current ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={e => {
          startXRef.current = e.touches[0].clientX
          startYRef.current = e.touches[0].clientY
          directionRef.current = null
          swipingRef.current = true
        }}
        onTouchEnd={() => {
          swipingRef.current = false
          directionRef.current = null
          setOffset(prev => (prev <= -(REVEAL / 2) ? -REVEAL : 0))
        }}
      >
        {children}
      </div>
    </div>
  )
}
