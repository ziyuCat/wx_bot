import { BotStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Activity, Wifi, WifiOff, Cpu, Brain, Clock } from 'lucide-react'
import { LogoutButton } from './LogoutButton'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  starting: { label: '启动中', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  waiting_scan: { label: '等待扫码', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  logged_in: { label: '已登录', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  logged_out: { label: '已登出', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  error: { label: '异常', color: 'text-red-400', bg: 'bg-red-400/10' },
}

function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors">
      <div className={cn("p-2 rounded-md", accent || "bg-primary/10 text-primary")}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatMemory(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function StatusPanel({ status }: { status: BotStatus | null }) {
  if (!status) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>等待连接...</span>
        </div>
      </div>
    )
  }

  const cfg = statusConfig[status.state] || statusConfig.starting

  return (
    <div className="animate-slide-up">
      {/* Status banner */}
      <div className={cn(
        "flex items-center justify-between px-5 py-3 rounded-xl border mb-4",
        cfg.bg, "border-transparent"
      )}>
        <div className="flex items-center gap-3">
          {status.state === 'logged_in'
            ? <Wifi className="w-5 h-5 text-emerald-400" />
            : <WifiOff className="w-5 h-5 text-muted-foreground" />
          }
          <span className="font-semibold text-sm">Bot 状态</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
            cfg.bg, cfg.color
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {cfg.label}
          </span>
          <LogoutButton enabled={status.state === 'logged_in'} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard icon={Activity} label="Puppet" value={status.puppet || '-'} accent="bg-violet-400/10 text-violet-400" />
        <StatCard icon={Brain} label="LLM" value={status.llmProvider || '-'} accent="bg-cyan-400/10 text-cyan-400" />
        {status.loginUser && (
          <StatCard icon={Wifi} label="登录用户" value={status.loginUser} accent="bg-emerald-400/10 text-emerald-400" />
        )}
        {status.uptime != null && (
          <StatCard icon={Clock} label="运行时间" value={formatUptime(status.uptime)} accent="bg-amber-400/10 text-amber-400" />
        )}
        {status.memory && (
          <StatCard icon={Cpu} label="内存占用" value={formatMemory(status.memory.rss)} accent="bg-blue-400/10 text-blue-400" />
        )}
      </div>
    </div>
  )
}
