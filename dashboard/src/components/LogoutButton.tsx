import { useState } from 'react'
import { LogOut } from 'lucide-react'

interface Props {
  enabled: boolean
}

export function LogoutButton({ enabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!enabled) return null

  const handleLogout = async () => {
    if (!confirm('确定要断开连接吗？')) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/logout', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(data.error || `请求失败 (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '断开失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                   bg-red-400/10 text-red-400 hover:bg-red-400/20
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <LogOut className="w-3.5 h-3.5" />
        {loading ? '断开中...' : '断开连接'}
      </button>
    </div>
  )
}
