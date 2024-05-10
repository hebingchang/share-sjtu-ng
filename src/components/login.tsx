import React from 'react';
import { Button, Input, Divider, ResizablePanel, Image } from "@nextui-org/react";
import { AnimatePresence, m, domAnimation, LazyMotion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import JAccountIcon from '../assets/jaccount.png';
import { constants } from "../env.ts";
import { Response } from "../types/rpc.ts";
import { tokenAtom } from "../atoms/authenticate.ts";
import { useAtom } from 'jotai';
import { OAuthConfig } from "../types/auth.ts";

export default function LoginModal() {
  const [isFormVisible, setIsFormVisible] = React.useState(false);
  const [authorizing, setAuthorizing] = React.useState<string | null>(null)
  const {t} = useTranslation();
  const [, setToken] = useAtom(tokenAtom)

  const variants = {
    visible: {opacity: 1, y: 0},
    hidden: {opacity: 0, y: 10},
  };

  const orDivider = (
    <div className="flex items-center gap-4 py-2">
      <Divider className="flex-1"/>
      <p className="shrink-0 text-tiny text-default-500">{t('login.third_party')}</p>
      <Divider className="flex-1"/>
    </div>
  );

  const authorize = React.useMemo(() => async (provider: string) => {
    const base = location.protocol + '//' + location.host
    const redirectUri = `${base}/auth/jaccount/callback`

    switch (provider) {
      case 'jaccount':
        setAuthorizing(provider);
        fetch(`${constants.API_URL}/auth/jaccount/config?` + new URLSearchParams({
          'redirect_uri': redirectUri,
        }), {
          method: 'GET',
          credentials: 'include',
        }).then(res => res.json()).then((res: Response<OAuthConfig>) => {
          const config = res.data;
          const screenHeight = window.screen.height;
          const screenWidth = window.screen.width;
          const authWindow = window.open(config.endpoint.auth_url + '?' + new URLSearchParams({
            'client_id': config.client_id,
            'redirect_uri': redirectUri,
            'response_type': 'code',
            'scope': config.scopes.join(' '),
          }), '_blank', `width=${screenHeight / 6 * 4},height=${screenHeight / 2},left=${screenWidth / 2 - screenHeight / 6 * 2},top=${screenHeight / 4}`);
          if (!authWindow) {
            setAuthorizing(null);
          } else {
            const timer = setInterval(function () {
              if (authWindow.closed) {
                clearInterval(timer);
                setAuthorizing(null);
              }
            }, 1000);

            const bc = new BroadcastChannel('oauth_jaccount');
            bc.onmessage = function (ev) {
              if (ev.data.code) {
                bc.close();
                clearInterval(timer);

                fetch(`${constants.API_URL}/auth/jaccount/authorize?` + new URLSearchParams({
                  'code': ev.data.code,
                }), {
                  method: 'GET',
                  credentials: 'include',
                }).then(res => res.json()).then((res: Response<string>) => {
                  localStorage.setItem("token", res.data);
                  setToken(res.data);
                }).catch(console.error);
              }
            }
          }
        }).catch(console.error);
        break;
      default:
        return;
    }
  }, [setToken]);

  return (
    <div className="flex w-full flex-col px-2 pb-10 pt-6">
      <ResizablePanel>
        <h1 className="mb-4 text-xl font-medium">{t('login.title')}</h1>
        <AnimatePresence initial={false} mode="popLayout">
          <LazyMotion features={domAnimation}>
            {isFormVisible ? (
              <m.form
                animate="visible"
                className="flex flex-col gap-y-3"
                exit="hidden"
                initial="hidden"
                variants={variants}
                onSubmit={(e) => e.preventDefault()}
              >
                <Input
                  autoFocus
                  label={t('login.email_address')}
                  name="email"
                  type="email"
                  variant="bordered"
                />
                <Input label={t('login.password')} name="password" type="password" variant="bordered"/>
                <Button color="primary" type="submit">
                  {t('login.submit')}
                </Button>
                {orDivider}
                <Button
                  fullWidth
                  startContent={
                    <Icon
                      className="text-default-500"
                      icon="solar:arrow-left-linear"
                      width={18}
                    />
                  }
                  variant="flat"
                  onPress={() => setIsFormVisible(false)}
                >
                  {t('login.other_login_options')}
                </Button>
              </m.form>
            ) : (
              <>
                <Button
                  fullWidth
                  color="primary"
                  startContent={
                    <Icon className="pointer-events-none text-2xl" icon="solar:letter-bold"/>
                  }
                  type="button"
                  onPress={() => setIsFormVisible(true)}
                >
                  {t('login.email')}
                </Button>
                {orDivider}
                <m.div
                  animate="visible"
                  className="flex flex-col gap-y-2"
                  exit="hidden"
                  initial="hidden"
                  variants={variants}
                >
                  <div className="flex flex-col gap-2">
                    <Button
                      fullWidth
                      startContent={<Image src={JAccountIcon} width={24}/>}
                      variant="flat"
                      isLoading={authorizing === 'jaccount'}
                      onClick={() => authorize('jaccount')}
                    >
                      {t('login.jaccount')}
                    </Button>
                    <Button
                      fullWidth
                      startContent={
                        <Icon className="text-default-500" icon="fe:key" width={24}/>
                      }
                      variant="flat"
                    >
                      {t('login.passkey')}
                    </Button>
                  </div>
                </m.div>
              </>
            )}
          </LazyMotion>
        </AnimatePresence>
      </ResizablePanel>
    </div>
  );
}
