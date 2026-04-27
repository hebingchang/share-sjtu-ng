import { useEffect } from 'react'

export default function OAuthCallbackPage({ channel }: { channel: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const bc = new BroadcastChannel(`oauth_${channel}`)
    bc.postMessage({ code })
    bc.close()
    window.close()
  }, [channel])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted">登录中，窗口将自动关闭…</p>
    </div>
  )
}
