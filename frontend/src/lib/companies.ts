export type CompanySlug = 'mobb' | 'hhc'

export type CompanyConfig = {
  slug: CompanySlug
  spireId: string
  label: string
  dashboardTitle: string
}

export const DEFAULT_COMPANY: CompanySlug = 'mobb'

export const COMPANIES: Record<CompanySlug, CompanyConfig> = {
  mobb: {
    slug: 'mobb',
    spireId: 'MOB_MED2',
    label: 'MOBB',
    dashboardTitle: 'MOBB Medical Orders Dashboard',
  },
  hhc: {
    slug: 'hhc',
    spireId: 'HHC2',
    label: 'HHC',
    dashboardTitle: 'MOBB HHC Orders Dashboard',
  },
}

export function isCompanySlug(value: string | undefined | null): value is CompanySlug {
  return value === 'mobb' || value === 'hhc'
}

export function resolveCompanySlug(value: string | undefined | null): CompanySlug {
  return isCompanySlug(value) ? value : DEFAULT_COMPANY
}

export function companyConfig(slug: string | undefined | null): CompanyConfig {
  return COMPANIES[resolveCompanySlug(slug)]
}

export function dashCacheKey(slug: CompanySlug): string {
  return `san_dashboard_cache_${slug}`
}

export function pageCacheKey(base: string, slug: CompanySlug): string {
  return `${base}:${slug}`
}

const LAST_COMPANY_KEY = 'san_last_company'

/** Remember last company so sidebar links keep MOBB/HHC when leaving listing pages. */
export function rememberCompany(slug: CompanySlug): void {
  try {
    sessionStorage.setItem(LAST_COMPANY_KEY, slug)
  } catch {
    // ignore
  }
}

export function lastRememberedCompany(): CompanySlug {
  try {
    return resolveCompanySlug(sessionStorage.getItem(LAST_COMPANY_KEY))
  } catch {
    return DEFAULT_COMPANY
  }
}
