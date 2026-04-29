import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  readLoginOAuthFlow,
  sanitizeLoginReturnTo,
  storeLoginOAuthCallback,
} from '../auth/oauth-login-flow'

export default function OAuthCallbackPage({ channel }: { channel: string }) {
  const navigate = useNavigate()
  const handledRef = useRef(false)
  const [message, setMessage] = useState('登录中，请稍候…')

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const notifyOpener = () => {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`oauth_${channel}`)
        bc.postMessage({ code, error, state })
        bc.close()
      }
      window.close()
    }

    const redirectToFallback = () => {
      setMessage('登录状态已失效，正在返回…')
      window.setTimeout(() => {
        navigate('/', { replace: true })
      }, 1200)
    }

    if (channel !== 'jaccount') {
      notifyOpener()
      return
    }

    const flow = readLoginOAuthFlow()
    if (flow?.mode !== 'redirect') {
      notifyOpener()
      if (!window.opener) {
        redirectToFallback()
      }
      return
    }

    const returnTo = sanitizeLoginReturnTo(flow.returnTo)
    storeLoginOAuthCallback({ code, createdAt: Date.now(), error, state })
    navigate(returnTo, { replace: true })
  }, [channel, navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
