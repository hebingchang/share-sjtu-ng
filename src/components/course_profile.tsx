import { useTranslation } from "react-i18next";
import { Course } from "../types/course.ts";
import purify from "dompurify";

export default function CourseProfile({course}: { course?: Course }) {
  const {t} = useTranslation();

  if (!course) return;

  return (
    <div className="flex w-full">
      <div>
        <p className="font-bold text-medium pb-2">{t('course.profile.description')}</p>
        <div className="text-default-500" dangerouslySetInnerHTML={{__html: purify.sanitize(course?.description.description)}}/>
      </div>
    </div>
  );
}
