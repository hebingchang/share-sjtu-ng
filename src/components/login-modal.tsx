import { useCallback, useEffect, useState } from 'react'
import { Envelope, Key } from '@gravity-ui/icons'
import {
  AlertDialog,
  Button,
  Form,
  InputGroup,
  Label,
  Modal,
  Separator,
  TextField,
} from '@heroui/react'
import jaccountIcon from '../assets/jaccount.png'
import { constants } from '../env'
import type { OAuthConfig } from '../types/auth'
import type { Response } from '../types/rpc'
import { useAuth } from '../auth/use-auth'
import {
  buildLoginOAuthUrl,
  clearLoginOAuthCallback,
  clearLoginOAuthFlow,
  getLoginReturnTo,
  readLoginOAuthCallback,
  readLoginOAuthFlow,
  shouldUseCurrentPageOAuth,
  storeLoginOAuthFlow,
  type LoginOAuthFlowMode,
} from '../auth/oauth-login-flow'

type Provider = 'jaccount'

export default function LoginModal({ isOpen }: { isOpen: boolean }) {
  const { setToken } = useAuth()
  const [authorizing, setAuthorizing] = useState<Provider | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthErrorOpen, setAuthErrorOpen] = useState(false)
  const [isEmailNoticeVisible, setEmailNoticeVisible] = useState(false)

  const showAuthError = useCallback((message: string) => {
    setAuthError(message)
    setAuthErrorOpen(true)
  }, [])

  const completeJaccountLogin = useCallback(
    async (code: string, state: string) => {
      setAuthorizing('jaccount')

      try {
        const response = await fetch(
          `${constants.API_URL}/auth/jaccount/authorize?` +
            new URLSearchParams({ code, state }),
          { method: 'GET', credentials: 'include' },
        )
        const payload = (await response.json()) as Response<string>

        if (payload?.success && payload.data) {
          setToken(payload.data)
        } else {
          showAuthError(payload?.message || 'jAccount 授权没有返回有效登录信息，请稍后再试。')
        }
      } catch (err) {
        console.error(err)
        showAuthError('无法完成 jAccount 授权，请检查网络后重试。')
      } finally {
        setAuthorizing(null)
      }
    },
    [setToken, showAuthError],
  )

  useEffect(() => {
    if (!isOpen) return

    const callback = readLoginOAuthCallback()
    if (!callback) return

    const flow = readLoginOAuthFlow()
    clearLoginOAuthCallback()
    clearLoginOAuthFlow()
    const showStoredCallbackError = (message: string) => {
      window.setTimeout(() => showAuthError(message), 0)
    }

    if (flow?.mode !== 'redirect') {
      showStoredCallbackError('登录状态已失效，请重新登录。')
      return
    }

    if (callback.error) {
      showStoredCallbackError('jAccount 授权没有完成，请重新登录。')
      return
    }

    const code = callback.code
    const state = callback.state
    if (!code) {
      showStoredCallbackError('jAccount 没有返回授权码，请稍后再试。')
      return
    }

    if (!state || state !== flow.state) {
      showStoredCallbackError('登录状态已失效，请重新登录。')
      return
    }

    window.setTimeout(() => {
      void completeJaccountLogin(code, state)
    }, 0)
  }, [completeJaccountLogin, isOpen, showAuthError])

  const authorize = useCallback(
    async (provider: Provider) => {
      if (provider !== 'jaccount') return

      const base = `${window.location.protocol}//${window.location.host}`
      const requestedRedirectUri = `${base}/auth/jaccount/callback`

      setAuthorizing(provider)
      setAuthErrorOpen(false)
      setEmailNoticeVisible(false)

      try {
        const response = await fetch(
          `${constants.API_URL}/auth/jaccount/config?` +
            new URLSearchParams({ redirect_uri: requestedRedirectUri }),
          { method: 'GET', credentials: 'include' },
        )
        const payload = (await response.json()) as Response<OAuthConfig>
        const config = payload.data

        if (!payload?.success || !config) {
          throw new Error('Invalid jAccount OAuth config')
        }

        const redirectUri = config.redirect_uri ?? requestedRedirectUri
        if (!config.state) {
          showAuthError('jAccount 登录配置没有返回状态码，请稍后再试。')
          setAuthorizing(null)
          return
        }

        const state = config.state
        const returnTo = getLoginReturnTo()
        const authUrl = buildLoginOAuthUrl({
          authUrl: config.endpoint.auth_url,
          clientId: config.client_id,
          redirectUri,
          scopes: config.scopes,
          state,
        })
        const storeFlow = (mode: LoginOAuthFlowMode) => {
          storeLoginOAuthFlow({ createdAt: Date.now(), mode, returnTo, state })
        }
        const redirectInCurrentPage = () => {
          storeFlow('redirect')
          window.location.assign(authUrl)
        }

        if (shouldUseCurrentPageOAuth() || typeof BroadcastChannel === 'undefined') {
          redirectInCurrentPage()
          return
        }

        const { screenHeight, screenWidth } = {
          screenHeight: window.screen.height,
          screenWidth: window.screen.width,
        }
        const width = (screenHeight / 6) * 4
        const height = screenHeight / 2
        storeFlow('popup')
        const authWindow = window.open(
          authUrl,
          '_blank',
          `width=${width},height=${height},left=${screenWidth / 2 - width / 2},top=${screenHeight / 4}`,
        )

        if (!authWindow) {
          redirectInCurrentPage()
          return
        }

        const bc = new BroadcastChannel('oauth_jaccount')
        const timer = window.setInterval(() => {
          if (authWindow.closed) {
            window.clearInterval(timer)
            bc.close()
            clearLoginOAuthFlow()
            setAuthorizing(null)
          }
        }, 1000)

        bc.onmessage = (
          ev: MessageEvent<{ code?: string | null; error?: string | null; state?: string | null }>,
        ) => {
          bc.close()
          window.clearInterval(timer)
          authWindow.close()
          clearLoginOAuthFlow()

          if (ev.data?.error) {
            setAuthorizing(null)
            showAuthError('jAccount 授权没有完成，请重新登录。')
            return
          }

          if (!ev.data?.code) {
            setAuthorizing(null)
            showAuthError('jAccount 没有返回授权码，请稍后再试。')
            return
          }

          if (ev.data.state !== state) {
            setAuthorizing(null)
            showAuthError('登录状态已失效，请重新登录。')
            return
          }

          fetch(
            `${constants.API_URL}/auth/jaccount/authorize?` +
              new URLSearchParams({ code: ev.data.code, state }),
            { method: 'GET', credentials: 'include' },
          )
            .then((r) => r.json() as Promise<Response<string>>)
            .then((r) => {
              if (r?.success && r.data) {
                setToken(r.data)
              } else {
                showAuthError(r?.message || 'jAccount 授权没有返回有效登录信息，请稍后再试。')
              }
            })
            .catch((err) => {
              console.error(err)
              showAuthError('无法完成 jAccount 授权，请检查网络后重试。')
            })
            .finally(() => setAuthorizing(null))
        }
      } catch (err) {
        console.error(err)
        clearLoginOAuthFlow()
        setAuthorizing(null)
        showAuthError('无法获取 jAccount 登录配置，请稍后再试。')
      }
    },
    [setToken, showAuthError],
  )

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} isDismissable={false} isKeyboardDismissDisabled variant="blur">
        <Modal.Container placement="center" scroll="inside" size="sm">
          <Modal.Dialog className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-105">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col px-2 pt-4 pb-2 lg:p-6">
                <Modal.Header className="items-center p-0 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Modal.Heading className="flex items-baseline justify-center gap-1 text-2xl font-semibold leading-none">
                      <span>传承</span>
                      <span>·</span>
                      <span>交大</span>
                    </Modal.Heading>
                    <p className="text-sm leading-6 text-muted">交大课程资料共享平台</p>
                  </div>
                </Modal.Header>

                <Modal.Body className="mt-7 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-0 pr-1 [scrollbar-width:thin] [&>*]:shrink-0">
                  <Form
                    aria-label="邮箱登录"
                    className="flex min-w-0 flex-col gap-3"
                    validationBehavior="aria"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setAuthErrorOpen(false)
                      setEmailNoticeVisible(true)
                    }}
                  >
                    <TextField fullWidth className="min-w-0" name="jaccount" type="text">
                      <Label>邮箱地址</Label>
                      <InputGroup fullWidth className="min-w-0" variant="secondary">
                        <InputGroup.Prefix>
                          <Envelope className="size-4 text-muted" />
                        </InputGroup.Prefix>
                        <InputGroup.Input
                          className="min-w-0"
                          placeholder="jAccount"
                          type="text"
                        />
                        <InputGroup.Suffix className="text-muted">@sjtu.edu.cn</InputGroup.Suffix>
                      </InputGroup>
                    </TextField>

                    <TextField fullWidth className="min-w-0" name="password" type="password">
                      <Label>密码</Label>
                      <InputGroup fullWidth className="min-w-0" variant="secondary">
                        <InputGroup.Prefix>
                          <Key className="size-4 text-muted" />
                        </InputGroup.Prefix>
                        <InputGroup.Input
                          className="min-w-0"
                          placeholder="请输入密码"
                          type="password"
                        />
                      </InputGroup>
                    </TextField>

                    <Button className='mt-4 mb-2' fullWidth type="submit" variant="primary">
                      登录
                    </Button>
                  </Form>

                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="shrink-0 text-xs text-muted">快速登录</span>
                    <Separator className="flex-1" />
                  </div>

                  <Button
                    fullWidth
                    className="text-foreground"
                    variant="secondary"
                    isPending={authorizing === 'jaccount'}
                    onPress={() => void authorize('jaccount')}
                  >
                    <span className="inline-flex items-center justify-center gap-2 leading-none">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center">
                        <img
                          src={jaccountIcon}
                          alt=""
                          width={20}
                          height={20}
                          className="size-5 object-contain"
                        />
                      </span>
                      <span className="leading-none text-foreground">使用 jAccount 登录</span>
                    </span>
                  </Button>

                  <Button fullWidth className="text-muted" variant="secondary" isDisabled>
                    <span className="inline-flex items-center justify-center gap-2 leading-none text-muted">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center">
                        <Key className="!mx-0 !my-0 !size-4" />
                      </span>
                      <span className="leading-none">使用通行密钥登录</span>
                    </span>
                  </Button>

                </Modal.Body>

                <p className="mt-6 shrink-0 text-center text-xs leading-5 text-muted">
                  继续登录代表您同意传承·交大的服务条款和隐私政策
                </p>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <AlertDialog.Backdrop
        isOpen={isEmailNoticeVisible}
        onOpenChange={setEmailNoticeVisible}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent" />
              <AlertDialog.Heading>邮箱登录暂不可用</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>当前邮箱与密码登录尚未开放，请使用 jAccount 登录。</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="primary">
                知道了
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <AlertDialog.Backdrop
        isOpen={isAuthErrorOpen}
        onOpenChange={setAuthErrorOpen}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>登录失败</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{authError}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="primary">
                知道了
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  )
}
