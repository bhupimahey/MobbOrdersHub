import { useNavigate, useParams } from 'react-router-dom'
import {
  COMPANIES,
  rememberCompany,
  resolveCompanySlug,
  type CompanySlug,
} from '../lib/companies'

type Props = {
  /** Route base without company, e.g. "/dashboard" or "/orders" */
  basePath: '/dashboard' | '/orders'
  disabled?: boolean
}

export default function CompanySwitcher({ basePath, disabled = false }: Props) {
  const { company: companyParam } = useParams()
  const navigate = useNavigate()
  const selected = resolveCompanySlug(companyParam)

  const select = (slug: CompanySlug) => {
    if (disabled || slug === selected) return
    rememberCompany(slug)
    navigate(`${basePath}/${slug}`)
  }

  return (
    <div className="company-switcher" role="group" aria-label="Company">
      <div className="company-switcher-label">Company</div>
      <div className="company-switcher-buttons">
        {(Object.keys(COMPANIES) as CompanySlug[]).map((slug) => {
          const cfg = COMPANIES[slug]
          const active = slug === selected
          return (
            <button
              key={slug}
              type="button"
              className={`company-switcher-btn ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => select(slug)}
            >
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
