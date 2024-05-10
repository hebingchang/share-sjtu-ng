import React from 'react';
import { useTranslation } from "react-i18next";
import { Course } from "../types/course.ts";
import { Select, SelectItem } from "@nextui-org/react";

export default function CourseMaterials({course}: { course?: Course }) {
  const {t} = useTranslation();

  if (!course) return;

  return (
    <div className="flex w-full">
      materials
    </div>
  );
}
