import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

const SHOW_AFTER_PX = 320

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      setVisible(y > SHOW_AFTER_PX)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      className={`back-to-top ${visible ? 'is-visible' : ''}`}
      onClick={scrollTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
    >
      <ChevronUp size={22} strokeWidth={2.25} />
    </button>
  )
}
