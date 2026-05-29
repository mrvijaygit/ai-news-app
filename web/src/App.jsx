import { useState, useEffect, useMemo } from 'react'
import styles from './App.module.css'

const FEED_URL =
  import.meta.env.VITE_FEED_URL ||
  'https://raw.githubusercontent.com/mrvijaygit/ai-news-app/master/storage/news-feed.json'

const COMPANY_COLORS = {
  'openai': '#10a37f',
  'anthropic': '#c96a2c',
  'google ai / gemini': '#4285f4',
  'google deepmind': '#0f9d58',
  'meta ai': '#1877f2',
  'mistral ai': '#e25b28',
  'xai': '#333333',
  'microsoft ai': '#00a4ef',
  'aws ai': '#ff9900',
  'nvidia ai': '#76b900',
  'hugging face': '#e07a0e',
  'cohere': '#39594d',
  'perplexity ai': '#1c9e8d',
}

function getCompanyColor(company) {
  const key = (company || '').toLowerCase()
  return COMPANY_COLORS[key] || '#6c757d'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function NewsCard({ item }) {
  const color = getCompanyColor(item.company)
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.badge} style={{ background: color }}>
          {item.company || item.source}
        </span>
        <span className={styles.cardDate}>{timeAgo(item.publishedAt)}</span>
      </div>
      <h2 className={styles.cardTitle}>
        <a href={item.link} target="_blank" rel="noopener noreferrer">
          {item.title}
        </a>
      </h2>
      {item.summary && <p className={styles.cardSummary}>{item.summary}</p>}
      <div className={styles.cardFooter}>
        <span className={styles.cardSource}>{item.source}</span>
        <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.readMore}>
          Read article →
        </a>
      </div>
    </article>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('All')
  const [sortOrder, setSortOrder] = useState('newest')

  useEffect(() => {
    fetch(FEED_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load feed (HTTP ${r.status})`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const companies = useMemo(() => {
    if (!data?.items?.length) return ['All']
    const set = new Set(data.items.map((i) => i.company || i.source).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [data])

  const filtered = useMemo(() => {
    if (!data?.items) return []
    let items = data.items

    if (selectedCompany !== 'All') {
      items = items.filter((i) => (i.company || i.source) === selectedCompany)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.summary?.toLowerCase().includes(q) ||
          i.company?.toLowerCase().includes(q)
      )
    }

    if (sortOrder === 'oldest') {
      items = [...items].sort((a, b) => {
        const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
        return da - db
      })
    }

    return items
  }, [data, selectedCompany, search, sortOrder])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🤖</span>
            <div>
              <h1 className={styles.brandTitle}>AI News Feed</h1>
              <p className={styles.brandSub}>Latest updates from top AI companies</p>
            </div>
          </div>
          {data && (
            <div className={styles.headerMeta}>
              <span>{data.items?.length ?? 0} articles collected</span>
              {data.updatedAt && <span>Updated {timeAgo(data.updatedAt)}</span>}
            </div>
          )}
        </div>
      </header>

      <div className={styles.filterBar}>
        <div className={styles.filterContent}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={styles.select}
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All companies' : c}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <main className={styles.main}>
        {loading && (
          <div className={styles.stateBox}>
            <div className={styles.spinner} />
            <p>Loading news feed...</p>
          </div>
        )}

        {error && (
          <div className={styles.stateBox}>
            <p className={styles.errorMsg}>⚠️ {error}</p>
            <p className={styles.errorHint}>
              The feed file may not exist yet — it is generated on the first GitHub Actions run.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className={styles.stateBox}>
            <p>
              No articles found
              {search || selectedCompany !== 'All' ? ' matching your filters' : ''}.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <p className={styles.resultCount}>
              {filtered.length} article{filtered.length !== 1 ? 's' : ''}
              {selectedCompany !== 'All' ? ` · ${selectedCompany}` : ''}
              {search ? ` · "${search}"` : ''}
            </p>
            <div className={styles.grid}>
              {filtered.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          Updated hourly via GitHub Actions ·{' '}
          <a href="https://github.com/mrvijaygit/ai-news-app" target="_blank" rel="noopener noreferrer">
            View source
          </a>
        </p>
      </footer>
    </div>
  )
}
