import { StatusPanel } from '@/components/StatusPanel'
import { LogConsole } from '@/components/LogConsole'
import { QrCodeDisplay } from '@/components/QrCodeDisplay'
import { ConfigPanel } from '@/components/ConfigPanel'
import { Sidebar, type NavTab } from '@/components/Sidebar'
import { useSSE } from '@/hooks/useSSE'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

function App() {
  const { logs, status, connected } = useSSE('/api/logs/stream')
  const [activeTab, setActiveTab] = useState<NavTab>('status')
  const [key, setKey] = useState(0)

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connected={connected}
      />

      {/* Main content area */}
      <div className="flex-1 ml-[--sidebar-width] min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border">
          <div className="px-6 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground/90">
                {activeTab === 'status' && '状态监控'}
                {activeTab === 'config' && '系统配置'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {connected ? '数据流正常' : '重连中...'}
              </div>
              <button
                onClick={() => setKey(k => k + 1)}
                className="p-1.5 rounded-md hover:bg-accent/10 transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 px-6 py-6">
          {activeTab === 'status' && (
            <div className="animate-fade-in space-y-6 max-w-5xl">
              <QrCodeDisplay status={status} />
              <StatusPanel status={status} />
              <LogConsole logs={logs} connected={connected} />
            </div>
          )}
          {activeTab === 'config' && (
            <div className="animate-fade-in max-w-4xl">
              <ConfigPanel />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 text-center border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/40">WxBot Dashboard · 实时监控面板</p>
        </footer>
      </div>
    </div>
  )
}

export default App
