import {
  Button,
  Input,
  Navbar,
  NavbarBrand,
  NavbarMenuToggle,
  NavbarContent,
  NavbarItem,
  Dropdown,
  DropdownTrigger,
  Avatar,
  DropdownMenu, DropdownItem, NavbarMenu, NavbarMenuItem, Link, Modal, ModalContent, ModalBody, DropdownSection
} from "@nextui-org/react";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import LoginModal from "./login.tsx";
import { profileAtom, tokenAtom } from "../atoms/authenticate.ts";
import { useAtom } from 'jotai'
import { Outlet } from 'react-router-dom';
import { DarkMode } from 'use-dark-mode';
import { useEffect } from "react";
import { constants } from "../env.ts";
import { SWRConfig } from "swr";

export default function Layout({darkMode}: { darkMode: DarkMode }) {
  const {t} = useTranslation();
  const [token] = useAtom(tokenAtom)
  const [profile, setProfile] = useAtom(profileAtom)

  useEffect(() => {
    if (token !== null) {
      fetch(`${constants.API_URL}/api/v1/user/profile`, {
        method: 'GET',
        headers: {
          'Auth': token
        }
      }).then(res => res.json()).then(res => {
        setProfile(res.data)
      })
    }
  }, [setProfile, token])

  return (
    <div className="w-full">
      <Navbar
        isBordered
        classNames={{
          item: "data-[active=true]:text-primary",
          wrapper: "px-4 sm:px-6",
        }}
        height="64px"
      >
        <NavbarBrand>
          <NavbarMenuToggle className="mr-2 h-6 sm:hidden"/>
          <p className="font-bold text-inherit">{t('brand')}</p>
        </NavbarBrand>

        {/* Right Menu */}
        <NavbarContent className="ml-auto h-12 max-w-fit items-center gap-0" justify="end">
          <NavbarItem className="mr-2 hidden lg:flex">
            <Input
              aria-label="Search"
              classNames={{
                inputWrapper: "bg-content2 dark:bg-content1",
              }}
              labelPlacement="outside"
              placeholder="Search..."
              radius="full"
              startContent={
                <Icon className="text-default-500" icon="solar:magnifer-linear" width={20}/>
              }
            />
          </NavbarItem>
          {/* Mobile search */}
          <NavbarItem className="lg:hidden">
            <Button isIconOnly radius="full" variant="light">
              <Icon className="text-default-500" icon="solar:magnifer-linear" width={20}/>
            </Button>
          </NavbarItem>
          {/* Theme change */}
          <NavbarItem className="hidden lg:flex">
            <Button isIconOnly radius="full" variant="light" onClick={darkMode.toggle}>
              <Icon
                className="text-default-500"
                icon={darkMode.value ? 'solar:sun-linear' : 'solar:moon-linear'}
                width={24}
              />
            </Button>
          </NavbarItem>
          {/* User Menu */}
          <NavbarItem className="px-2">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <button className="mt-1 h-8 w-8 transition-transform">
                  <Avatar size="sm" name={profile?.account}/>
                </button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Profile Actions" variant="flat">
                <DropdownSection showDivider>
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p><span className="font-semibold">{t('menu.welcome')}</span>{profile?.name}</p>
                    <p className='text-default-400'>{profile?.code}</p>
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection showDivider>
                  <DropdownItem
                    key="points"
                    endContent={<p className="font-semibold">{profile?.points.points}</p>}
                  >
                    {t('menu.points')}
                  </DropdownItem>
                </DropdownSection>
                <DropdownItem key="settings">My Settings</DropdownItem>
                <DropdownItem key="logout" color="danger">
                  Log Out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
        </NavbarContent>

        {/* Mobile Menu */}
        <NavbarMenu>
          <NavbarMenuItem>
            <Link className="w-full" color="foreground" href="#">
              Dashboard
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem isActive>
            <Link aria-current="page" className="w-full" color="primary" href="#">
              Deployments
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link className="w-full" color="foreground" href="#">
              Analytics
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link className="w-full" color="foreground" href="#">
              Team
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link className="w-full" color="foreground" href="#">
              Settings
            </Link>
          </NavbarMenuItem>
        </NavbarMenu>
      </Navbar>
      <main className="mt-6 flex w-full flex-col items-center">
        {
          token === null ?
            <div>login</div>
            :
            <SWRConfig
              value={{
                fetcher: (resource, init) => fetch(`${constants.API_URL}${resource}`, {
                  ...init,
                  headers: {'Auth': token}
                }).then(res => res.json())
              }}
            >
              <Outlet/>
            </SWRConfig>
        }

        <Modal isOpen={!token} isDismissable={false} hideCloseButton size='sm' backdrop='blur'>
          <ModalContent>
            <ModalBody>
              <LoginModal/>
            </ModalBody>
          </ModalContent>
        </Modal>
      </main>
    </div>
  );
}
