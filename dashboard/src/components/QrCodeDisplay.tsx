import { useState, useEffect } from 'react'
import { BotStatus } from '@/types'
import { QrCode, ExternalLink } from 'lucide-react'
import QRCode from 'qrcode'

export function QrCodeDisplay({ status }: { status: BotStatus | null }) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    if (status?.qrcode) {
      QRCode.toDataURL(status.qrcode, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setDataUrl)
        .catch(() => setDataUrl(''))
    } else {
      setDataUrl('')
    }
  }, [status?.qrcode])

  if (!status || status.state !== 'waiting_scan' || !status.qrcode) return null

  return (
    <div className="animate-slide-up bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-semibold">微信扫码登录</h2>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* QR Code Image - locally generated */}
        {dataUrl ? (
          <div className="bg-white rounded-xl p-3 shadow-lg">
            <img
              src={dataUrl}
              alt="微信登录二维码"
              className="w-48 h-48"
            />
          </div>
        ) : (
          <div className="bg-background rounded-xl p-3 border border-border flex items-center justify-center w-48 h-48">
            <span className="text-muted-foreground text-xs">生成中...</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          打开微信 → 扫一扫 → 扫描上方二维码确认登录
        </p>

        {status.qrcodeImageUrl && (
          <a
            href={status.qrcodeImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            在浏览器中打开二维码
          </a>
        )}
      </div>
    </div>
  )
}
