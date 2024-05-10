import {
  Button,
  Divider,
  ScrollShadow,
  Tabs,
  Tab,
  Chip,
  AvatarGroup, Tooltip, Avatar, Skeleton
} from "@nextui-org/react";
import { Icon } from "@iconify/react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import { Response } from "../types/rpc.ts";
import { Course } from "../types/course.ts";
import { useTranslation } from "react-i18next";
import CourseMaterials from "../components/course_materials.tsx";
import React from "react";
import CourseProfile from "../components/course_profile.tsx";

export default function CoursePage() {
  const {t} = useTranslation();
  const {id} = useParams();
  const {
    data: course,
    isLoading: isCourseLoading,
    error: courseError
  } = useSWR<Response<Course>>(`/api/v1/course/get/${id}`)
  const [tab, setTab] = React.useState("materials");

  return (
    <div className="w-full max-w-[1024px] px-4 lg:px-8">
      <header className="mb-6 flex w-full items-center justify-between">
        <div className="flex flex-col">
          {
            isCourseLoading ?
              <Skeleton className="rounded-lg">
                <div className="h-9 rounded-lg bg-default-300"></div>
              </Skeleton>
              :
              <h1 className="text-xl font-bold text-default-900 lg:text-3xl">
                {course?.data.name}
              </h1>
          }
          {
            isCourseLoading ?
              <Skeleton className="rounded-lg">
                <div className="h-6 rounded-lg bg-default-300"></div>
              </Skeleton>
              :
              <p className="text-small text-default-400 lg:text-medium">
                {course?.data.english_name}
              </p>
          }
        </div>
        <Button
          className="bg-foreground text-background hidden lg:flex"
          startContent={
            <Icon className="flex-none text-background/60" icon="lucide:plus" width={16}/>
          }
        >
          {t('course.add_material')}
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
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k.toString())}
        >
          <Tab key="materials" title={
            <div className="flex items-center gap-2">
              <p>{t('course.menu.materials')}</p>
              <Chip size="sm">{course?.data.material_count}</Chip>
            </div>
          }/>
          <Tab key="profile" title={t('course.menu.profile')}/>
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

      <div className='w-full pt-4'>
        {
          tab === 'materials' && <CourseMaterials course={course?.data}/>
        }

        {
          tab === 'profile' && <CourseProfile course={course?.data}/>
        }
      </div>
    </div>
  );
}
