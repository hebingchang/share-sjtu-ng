import {
  Button,
  Divider,
  ScrollShadow,
  Tabs,
  Tab,
  Chip,
  AvatarGroup, Tooltip, Avatar
} from "@nextui-org/react";
import { Icon } from "@iconify/react";

export default function CoursePage() {
  return (
    <div className="w-full max-w-[1024px] px-4 lg:px-8">
      <header className="mb-6 flex w-full items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-default-900 lg:text-3xl">Dashboard</h1>
          <p className="text-small text-default-400 lg:text-medium">Manage your deployments</p>
        </div>
        <Button
          className="bg-foreground text-background"
          startContent={
            <Icon className="flex-none text-background/60" icon="lucide:plus" width={16}/>
          }
        >
          New Deployment
        </Button>
      </header>
      <ScrollShadow
        hideScrollBar
        className="-mx-2 flex w-full justify-between gap-8"
        orientation="horizontal"
      >
        <Tabs
          aria-label="Navigation Tabs"
          classNames={{
            cursor: "bg-default-200 shadow-none",
          }}
          radius="full"
          variant="light"
        >
          <Tab key="dashboard" title="Dashboard"/>
          <Tab
            key="deployments"
            title={
              <div className="flex items-center gap-2">
                <p>Deployments</p>
                <Chip size="sm">9</Chip>
              </div>
            }
          />
          <Tab key="analytics" title="Analytics"/>
          <Tab key="team" title="Team"/>
          <Tab key="settings" title="Settings"/>
        </Tabs>
        <div className="flex items-center gap-4">
          <AvatarGroup max={3} size="sm" total={10}>
            <Tooltip content="John" placement="bottom">
              <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d"/>
            </Tooltip>
            <Tooltip content="Mark" placement="bottom">
              <Avatar src="https://i.pravatar.cc/150?u=a04258a2462d826712d"/>
            </Tooltip>
            <Tooltip content="Jane" placement="bottom">
              <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d"/>
            </Tooltip>
          </AvatarGroup>
          <Divider className="h-6" orientation="vertical"/>
          <Tooltip content="New deployment" placement="bottom">
            <Button isIconOnly radius="full" size="sm" variant="faded">
              <Icon className="text-default-500" icon="lucide:plus" width={16}/>
            </Button>
          </Tooltip>
        </div>
      </ScrollShadow>
    </div>
  );
}
