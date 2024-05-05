import { useNavigate, Routes, Route } from 'react-router-dom';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Link,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  Breadcrumbs,
  BreadcrumbItem,
  Input,
  Badge,
  NextUIProvider,
  Modal, ModalContent, ModalBody,
} from "@nextui-org/react";
import { Icon } from "@iconify/react";
import './App.css'
import CoursePage from "./pages/course.tsx";
import { useAtom } from 'jotai'
import useDarkMode from "use-dark-mode";
import { profileAtom, tokenAtom } from "./atoms/authenticate.ts";
import LoginModal from "./components/login.tsx";

function App() {
  const navigate = useNavigate();
  const darkMode = useDarkMode(false, {
    classNameDark: "dark",
    classNameLight: "light",
    element: document.documentElement,
  });
  const [token] = useAtom(tokenAtom)
  const [profile, setProfile] = useAtom(profileAtom)

  return (
    <NextUIProvider navigate={navigate} className={`${darkMode.value ? 'dark' : ''} text-foreground bg-background`}>
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
            <p className="font-bold text-inherit">传承・交大</p>
          </NavbarBrand>
          <Breadcrumbs className="hidden sm:flex" radius="full">
            <BreadcrumbItem>Apps</BreadcrumbItem>
            <BreadcrumbItem>iOS App</BreadcrumbItem>
            <BreadcrumbItem>TestFlight</BreadcrumbItem>
          </Breadcrumbs>

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
                <Icon className="text-default-500" icon="solar:sun-linear" width={24}/>
              </Button>
            </NavbarItem>
            {/* Settings */}
            <NavbarItem className="hidden lg:flex">
              <Button isIconOnly radius="full" variant="light">
                <Icon className="text-default-500" icon="solar:settings-linear" width={24}/>
              </Button>
            </NavbarItem>
            {/* User Menu */}
            <NavbarItem className="px-2">
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <button className="mt-1 h-8 w-8 transition-transform">
                    <Badge color="success" content="" placement="bottom-right" shape="circle">
                      <Avatar size="sm" src="https://i.pravatar.cc/150?u=a04258114e29526708c"/>
                    </Badge>
                  </button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Profile Actions" variant="flat">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">johndoe@example.com</p>
                  </DropdownItem>
                  <DropdownItem key="settings">My Settings</DropdownItem>
                  <DropdownItem key="team_settings">Team Settings</DropdownItem>
                  <DropdownItem key="analytics">Analytics</DropdownItem>
                  <DropdownItem key="system">System</DropdownItem>
                  <DropdownItem key="configurations">Configurations</DropdownItem>
                  <DropdownItem key="help_and_feedback">Help & Feedback</DropdownItem>
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
              <Routes>
                <Route path="/" element={<CoursePage/>}/>
              </Routes>
          }

          <Modal isOpen isDismissable={false} hideCloseButton size='sm' backdrop='blur'>
            <ModalContent>
              <ModalBody>
                <LoginModal/>
              </ModalBody>
            </ModalContent>
          </Modal>
        </main>
      </div>
    </NextUIProvider>
  )
}

export default App
