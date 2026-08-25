import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export default function ListingPagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  if (total === 0) {
    return (
      <div className="pagination-bar">
        <div className="pagination-info">0 records</div>
      </div>
    )
  }

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong> records
        {totalPages > 1 ? ` · Page ${safePage} of ${totalPages}` : ''}
      </div>
      {totalPages > 1 ? (
        <div className="pagination-controls">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <span className="pagination-page">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
