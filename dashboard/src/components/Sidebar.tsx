import { cn } from '@/lib/utils'
import { Bot, Activity, Settings } from 'lucide-react'

export type NavTab = 'status' | 'config'

interface SidebarProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  connected: boolean
}

const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
  { id: 'status', label: '状态监控', icon: Activity },
  { id: 'config', label: '系统配置', icon: Settings },
]

export function Sidebar({ activeTab, onTabChange, connected }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[--sidebar-width] flex flex-col bg-sidebar border-r border-sidebar-border select-none z-20">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">WxBot</h1>
          <p className="text-[10px] text-muted-foreground leading-tight">微信机器人</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const active = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group',
                active
                  ? 'bg-sidebar-accent text-primary font-medium'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 shrink-0 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground/80'
              )} />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1 h-4 rounded-full bg-primary nav-active-indicator" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer - connection status */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            connected ? 'bg-emerald-400 shadow-[0_0_6px_hsl(145,76%,42%)]' : 'bg-red-400'
          )} />
          <span className="text-xs text-muted-foreground">
            {connected ? '已连接' : '未连接'}
          </span>
        </div>
      </div>
    </aside>
  )
}
