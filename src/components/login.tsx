import React from 'react';
import { Button, Input, Divider, ResizablePanel, Image } from "@nextui-org/react";
import { AnimatePresence, m, domAnimation, LazyMotion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import JAccountIcon from '../assets/jaccount.png';

export default function LoginModal() {
  const [isFormVisible, setIsFormVisible] = React.useState(false);
  const {t} = useTranslation();

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
