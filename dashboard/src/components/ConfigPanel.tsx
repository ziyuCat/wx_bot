import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, Server, Bot, Brain, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppConfig {
  puppet: { type: string; options: Record<string, unknown> }
  llm: {
    provider: string
    options: {
      model?: string
      baseURL?: string
      apiKey?: string
      [key: string]: unknown
    }
  }
  bot: {
    name: string
    maxContextMessages: number
  }
  downloader: {
    apiUrl: string
  }
}

export function ConfigPanel() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 表单状态
  const [downloaderApiUrl, setDownloaderApiUrl] = useState('')
  const [botName, setBotName] = useState('')
  const [maxContextMessages, setMaxContextMessages] = useState(10)
  const [llmModel, setLlmModel] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')

  // 加载配置
  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConfig(data)
      setDownloaderApiUrl(data.downloader?.apiUrl || '')
      setBotName(data.bot?.name || '')
      setMaxContextMessages(data.bot?.maxContextMessages || 10)
      setLlmModel((data.llm?.options?.model as string) || '')
      setLlmBaseUrl((data.llm?.options?.baseURL as string) || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  // 保存配置
  const saveConfig = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const updates: Record<string, unknown> = {}

    // 下载器配置
    if (downloaderApiUrl !== config?.downloader?.apiUrl) {
      updates.downloader = { apiUrl: downloaderApiUrl }
    }

    // 机器人配置
    if (botName !== config?.bot?.name || maxContextMessages !== config?.bot?.maxContextMessages) {
      updates.bot = { name: botName, maxContextMessages }
    }

    // LLM 配置
    if (llmModel !== config?.llm?.options?.model || llmBaseUrl !== config?.llm?.options?.baseURL) {
      updates.llm = { options: { model: llmModel, baseURL: llmBaseUrl } }
    }

    if (Object.keys(updates).length === 0) {
      setError('没有需要保存的更改')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setConfig(data.config)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    if (!config) return
    setDownloaderApiUrl(config.downloader?.apiUrl || '')
    setBotName(config.bot?.name || '')
    setMaxContextMessages(config.bot?.maxContextMessages || 10)
    setLlmModel((config.llm?.options?.model as string) || '')
    setLlmBaseUrl((config.llm?.options?.baseURL as string) || '')
    setError(null)
    setSuccess(false)
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Settings className="w-4 h-4 animate-pulse" />
          <span>加载配置中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/30">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">系统配置</h2>
          {config && (
            <span className="text-xs text-muted-foreground">
              (LLM: {config.llm?.provider || '—'})
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 错误提示 */}
        {error && (
          <div className="px-4 py-2.5 rounded-lg bg-red-400/10 border border-red-400/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div className="px-4 py-2.5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 text-xs">
            配置已保存成功
          </div>
        )}

        {/* 下载器 API 配置 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              视频解析服务
            </h3>
          </div>
          <div className="bg-background/50 border border-border/50 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                API 服务器地址
              </label>
              <input
                type="url"
                value={downloaderApiUrl}
                onChange={e => setDownloaderApiUrl(e.target.value)}
                placeholder="https://www.yyyc1000.site"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                用于解析抖音、B站等视频分享链接的后端服务地址
              </p>
            </div>
          </div>
        </div>

        {/* 机器人基本配置 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              机器人设置
            </h3>
          </div>
          <div className="bg-background/50 border border-border/50 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                机器人名称
              </label>
              <input
                type="text"
                value={botName}
                onChange={e => setBotName(e.target.value)}
                placeholder="WxBot"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                最大上下文消息数
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxContextMessages}
                onChange={e => setMaxContextMessages(parseInt(e.target.value, 10) || 10)}
                className="w-32 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                每个会话保留的最近消息条数（1-50）
              </p>
            </div>
          </div>
        </div>

        {/* LLM 配置 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              LLM 模型设置
            </h3>
            {config && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                API Key 由环境变量管理，此处不可修改
              </span>
            )}
          </div>
          <div className="bg-background/50 border border-border/50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  模型名称
                </label>
                <input
                  type="text"
                  value={llmModel}
                  onChange={e => setLlmModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  接口地址 (baseURL)
                </label>
                <input
                  type="url"
                  value={llmBaseUrl}
                  onChange={e => setLlmBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              注意：修改 LLM 提供商（mock/openai/qwen）需要修改配置文件并重启服务。此处仅可调整当前提供商的模型参数。
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={saveConfig}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              saving && "opacity-60 cursor-not-allowed"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={resetForm}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </button>
        </div>
      </div>
    </div>
  )
}
