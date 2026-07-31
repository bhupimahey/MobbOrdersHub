type PageLoaderProps = {
  label?: string
  /** Full-viewport centered loader (auth bootstrap / route suspense) */
  full?: boolean
}

export default function PageLoader({
  label = 'Loading',
  full = false,
}: PageLoaderProps) {
  return (
    <div
      className={`page-loader ${full ? 'page-loader--full' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="page-loader-inner">
        <div className="page-loader-ring" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="page-loader-label">
          {label}
          <span className="page-loader-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      </div>
    </div>
  )
}
