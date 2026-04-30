import {
  Bars,
  ChartLine,
  CircleDollar,
  FilePlus,
  FileText,
  PersonGear,
  PersonPlus,
  ShoppingCart,
} from '@gravity-ui/icons'
import { Sidebar } from '@heroui-pro/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useOutlet } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { pageTransition } from './animation'
import { USER_PAGE_TITLES } from './constants'

type UserNavGroupKey = 'materials' | 'points'

const USER_NAV_GROUP_KEYS = ['materials', 'points'] as const

function getUserNavGroupKey(pathname: string): UserNavGroupKey | null {
  if (pathname.startsWith('/user/materials/')) return 'materials'
  if (pathname.startsWith('/user/points/')) return 'points'
  return null
}

function getExpandedUserNavGroups(keys: Iterable<unknown>) {
  const expandedKeys = new Set<UserNavGroupKey>()

  for (const key of keys) {
    if (USER_NAV_GROUP_KEYS.includes(key as UserNavGroupKey)) {
      expandedKeys.add(key as UserNavGroupKey)
    }
  }

  return expandedKeys
}

function UserNav() {
  const location = useLocation()
  const isMaterialsCurrent = location.pathname.startsWith('/user/materials/')
  const isPointsCurrent = location.pathname.startsWith('/user/points/')
  const activeGroupKey = getUserNavGroupKey(location.pathname)
  const [expandedKeys, setExpandedKeys] = useState<Set<UserNavGroupKey>>(
    () => new Set(USER_NAV_GROUP_KEYS),
  )
  const visibleExpandedKeys = useMemo(() => {
    if (!activeGroupKey || expandedKeys.has(activeGroupKey)) return expandedKeys

    const nextKeys = new Set(expandedKeys)
    nextKeys.add(activeGroupKey)
    return nextKeys
  }, [activeGroupKey, expandedKeys])

  return (
    <Sidebar.Menu
      expandedKeys={visibleExpandedKeys}
      showGuideLines="hover"
      onExpandedChange={(keys) => setExpandedKeys(getExpandedUserNavGroups(keys))}
    >
      <Sidebar.MenuItem
        href="/user/basic"
        id="basic"
        isCurrent={location.pathname === '/user/basic'}
        textValue="基本信息"
      >
        <Sidebar.MenuIcon>
          <PersonGear />
        </Sidebar.MenuIcon>
        <Sidebar.MenuLabel>基本信息</Sidebar.MenuLabel>
      </Sidebar.MenuItem>

      <Sidebar.MenuItem id="materials" isCurrent={isMaterialsCurrent} textValue="资料">
        <Sidebar.MenuIcon>
          <FileText />
        </Sidebar.MenuIcon>
        <Sidebar.MenuLabel>
          资料
          <Sidebar.MenuTrigger>
            <Sidebar.MenuIndicator />
          </Sidebar.MenuTrigger>
        </Sidebar.MenuLabel>
        <Sidebar.Submenu>
          <Sidebar.MenuItem
            href="/user/materials/upload"
            id="materials-upload"
            isCurrent={location.pathname === '/user/materials/upload'}
            textValue="我上传的资料"
          >
            <Sidebar.MenuIcon>
              <FilePlus />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>我上传的资料</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem
            href="/user/materials/purchase"
            id="materials-purchase"
            isCurrent={location.pathname === '/user/materials/purchase'}
            textValue="我购买的资料"
          >
            <Sidebar.MenuIcon>
              <ShoppingCart />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>我购买的资料</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
        </Sidebar.Submenu>
      </Sidebar.MenuItem>

      <Sidebar.MenuItem id="points" isCurrent={isPointsCurrent} textValue="积分">
        <Sidebar.MenuIcon>
          <CircleDollar />
        </Sidebar.MenuIcon>
        <Sidebar.MenuLabel>
          积分
          <Sidebar.MenuTrigger>
            <Sidebar.MenuIndicator />
          </Sidebar.MenuTrigger>
        </Sidebar.MenuLabel>
        <Sidebar.Submenu>
          <Sidebar.MenuItem
            href="/user/points/logs"
            id="point-logs"
            isCurrent={location.pathname === '/user/points/logs'}
            textValue="积分变动日志"
          >
            <Sidebar.MenuIcon>
              <ChartLine />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>积分变动日志</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem
            href="/user/points/redeem"
            id="points-redeem"
            isCurrent={location.pathname === '/user/points/redeem'}
            textValue="积分兑换"
          >
            <Sidebar.MenuIcon>
              <CircleDollar />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>积分兑换</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem
            href="/user/points/gift"
            id="points-gift"
            isCurrent={location.pathname === '/user/points/gift'}
            textValue="积分转账"
          >
            <Sidebar.MenuIcon>
              <PersonPlus />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>积分转账</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
        </Sidebar.Submenu>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  )
}

function UserPageHeader() {
  const location = useLocation()
  const title = USER_PAGE_TITLES[location.pathname] ?? '基本信息'

  return (
    <div className="flex items-start gap-3">
      <Sidebar.Trigger
        aria-label="打开用户中心导航"
        className="mt-0.5 shrink-0 min-[769px]:hidden"
      >
        <Bars />
      </Sidebar.Trigger>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium text-accent">用户中心</p>
        <AnimatePresence initial={false} mode="wait">
          <motion.h1
            key={title}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold tracking-tight lg:text-3xl"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            transition={pageTransition}
          >
            {title}
          </motion.h1>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AnimatedOutlet() {
  const { isInitializing } = useAuth()
  const location = useLocation()
  const outlet = useOutlet()

  if (isInitializing) return <div className="min-w-0" />

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0"
        exit={{ opacity: 0, y: -4 }}
        initial={{ opacity: 0, y: 8 }}
        transition={pageTransition}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}

export function UserCenterLayout() {
  const navigate = useNavigate()

  return (
    <Sidebar.Provider
      className="!min-h-0 gap-6"
      collapsible="offcanvas"
      defaultOpen
      navigate={navigate}
      toggleShortcut={false}
      variant="floating"
    >
      <Sidebar className="!top-28 !h-auto !min-h-0">
        <Sidebar.Header>
          <div className="flex flex-col gap-1 px-1">
            <p className="text-sm font-semibold text-foreground">用户中心</p>
            <p className="text-xs text-muted">资料、积分与账号信息</p>
          </div>
        </Sidebar.Header>
        <Sidebar.Content className="!flex-none !pb-3">
          <Sidebar.Group>
            <UserNav />
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Mobile>
        <Sidebar.Header>
          <div className="flex flex-col gap-1 px-1">
            <p className="text-sm font-semibold text-foreground">用户中心</p>
            <p className="text-xs text-muted">资料、积分与账号信息</p>
          </div>
        </Sidebar.Header>
        <Sidebar.Content className="!pb-3">
          <Sidebar.Group>
            <UserNav />
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar.Mobile>

      <Sidebar.Main className="min-h-0 gap-6">
        <UserPageHeader />
        <section className="min-w-0">
          <AnimatedOutlet />
        </section>
      </Sidebar.Main>
    </Sidebar.Provider>
  )
}
