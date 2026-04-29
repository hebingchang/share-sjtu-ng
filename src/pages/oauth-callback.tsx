import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  clearLoginOAuthFlow,
  readLoginOAuthFlow,
  sanitizeLoginReturnTo,
} from '../auth/oauth-login-flow'
import { useAuth } from '../auth/use-auth'
import { constants } from '../env'
import type { Response } from '../types/rpc'

export default function OAuthCallbackPage({ channel }: { channel: string }) {
  const { setToken } = useAuth()
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

    if (channel !== 'jaccount') {
      notifyOpener()
      return
    }

    const flow = readLoginOAuthFlow()
    if (flow?.mode !== 'redirect') {
      notifyOpener()
      return
    }

    const returnTo = sanitizeLoginReturnTo(flow.returnTo)
    const returnToLoginPage = (nextMessage: string) => {
      setMessage(nextMessage)
      window.setTimeout(() => {
        navigate(returnTo, { replace: true })
      }, 1200)
    }

    clearLoginOAuthFlow()

    if (error) {
      returnToLoginPage('jAccount 登录没有完成，正在返回…')
      return
    }

    if (!code) {
      returnToLoginPage('jAccount 没有返回授权码，正在返回…')
      return
    }

    if (!state || state !== flow.state) {
      returnToLoginPage('登录状态已失效，正在返回…')
      return
    }

    fetch(
      `${constants.API_URL}/auth/jaccount/authorize?` + new URLSearchParams({ code }),
      { method: 'GET', credentials: 'include' },
    )
      .then((response) => response.json() as Promise<Response<string>>)
      .then((payload) => {
        if (payload?.success && payload.data) {
          setToken(payload.data)
          navigate(returnTo, { replace: true })
          return
        }

        returnToLoginPage('jAccount 授权没有返回有效登录信息，正在返回…')
      })
      .catch((err) => {
        console.error(err)
        returnToLoginPage('无法完成 jAccount 授权，正在返回…')
      })
  }, [channel, navigate, setToken])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
