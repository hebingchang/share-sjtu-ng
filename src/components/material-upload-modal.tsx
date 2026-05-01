import {
  Books,
  CircleCheckFill,
  CircleXmarkFill,
  CloudArrowUpIn,
  FilePlus,
  PencilToSquare,
  Person,
  TrashBin,
} from '@gravity-ui/icons'
import {
  Button,
  Checkbox,
  ComboBox,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  ListBox,
  Modal,
  NumberField,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
  type Key,
} from '@heroui/react'
import { DropZone } from '@heroui-pro/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router'
import { getCourseClasses, promptCourses } from '../api/courses'
import {
  createMaterial,
  getMaterialTypes,
  requestMaterialUpload,
  updateMaterial,
} from '../api/materials'
import { useAuth } from '../auth/use-auth'
import { useDialog } from '../dialog/use-dialog'
import type { Course } from '../types/course'
import type { ClassSummary, Material, MaterialType } from '../types/material'

const COURSE_SEARCH_DEBOUNCE_MS = 260
const MAX_FILE_SIZE = 100 * 1024 * 1024
const AGREEMENT_LINK_CLASS =
  '!text-inherit underline underline-offset-4 decoration-current/35 transition-colors hover:decoration-current'

type DropZoneDropEvent = Parameters<NonNullable<ComponentProps<typeof DropZone.Area>['onDrop']>>[0]

type UploadStatus = 'uploading' | 'complete' | 'failed'
type FileFormatColor = 'blue' | 'gray' | 'green' | 'orange' | 'purple' | 'red'

interface UploadFileState {
  error?: string
  file: File
  id: string
  name: string
  path?: string
  progress: number
  size: number
  status: UploadStatus
}

interface FormErrors {
  agreement?: string
  course?: string
  description?: string
  file?: string
  materialType?: string
  name?: string
  points?: string
  teacher?: string
}

export interface MaterialUploadInitialSelection {
  classId?: Key | null
  course: Course
  teacherName?: string
}

function createUploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatCourseLabel(course: Course): string {
  return [course.name, course.code].filter(Boolean).join(' · ')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1) : ''
}

function getFormatColor(ext: string): FileFormatColor {
  const colors: Record<string, FileFormatColor> = {
    csv: 'green',
    doc: 'blue',
    docx: 'blue',
    jpeg: 'blue',
    jpg: 'blue',
    json: 'orange',
    mp4: 'purple',
    pdf: 'red',
    png: 'green',
    ppt: 'orange',
    pptx: 'orange',
    txt: 'gray',
    xls: 'green',
    xlsx: 'green',
    zip: 'orange',
  }
  return colors[ext.toLowerCase()] ?? 'gray'
}

function getTeacherName(classItem: ClassSummary): string {
  return classItem.teacher?.name?.trim() || '未知教师'
}

function getMaterialTeacherName(material: Material): string {
  return material.class?.teacher?.name?.trim() || ''
}

function getMaterialCourse(material: Material): Course | null {
  return material.course ?? material.class?.course ?? null
}

function getMaterialClassId(material: Material): Key | null {
  return material.class_id ?? material.class?.id ?? null
}

function getMaterialAnonymous(material: Material): boolean {
  return material.anonymous ?? true
}

function getMaterialFileName(material: Material): string {
  return material.file_name || material.name || `资料 #${material.id}`
}

function mergeUpdatedMaterial({
  current,
  selectedType,
  updated,
}: {
  current: Material
  selectedType: MaterialType | null
  updated: Material
}): Material {
  return {
    ...current,
    ...updated,
    class: updated.class ?? current.class,
    course: updated.course ?? current.course,
    material_type: updated.material_type ?? selectedType ?? current.material_type,
    material_type_id: updated.material_type_id ?? selectedType?.id ?? current.material_type_id,
  }
}

function getTeacherOrganizationName(classItem: ClassSummary): string {
  return classItem.teacher?.organization?.name?.trim() ?? ''
}

function formatTeacherSearchText(classItem: ClassSummary): string {
  return [
    getTeacherName(classItem),
    getTeacherOrganizationName(classItem),
    classItem.teacher?.position?.trim() ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

function getMaterialNamePlaceholder(typeName?: string): string {
  const normalizedTypeName = typeName?.trim()
  if (!normalizedTypeName) return '例如 2024 春季课程补充资料'

  const examples: Array<[string, string]> = [
    ['试卷', '例如 2024 春季期末试卷'],
    ['考卷', '例如 2024 春季期中考卷'],
    ['课件', '例如 第 3 章矩阵运算课件'],
    ['讲义', '例如 第 5 周课堂讲义'],
    ['作业答案', '例如 第 6 次作业答案'],
    ['答案', '例如 2024 春季习题答案'],
    ['解答', '例如 2024 春季习题解答'],
    ['作业', '例如 第 4 次课程作业'],
    ['习题', '例如 第 2 章课后习题'],
    ['笔记', '例如 2024 春季课堂笔记'],
    ['实验报告', '例如 实验二数据处理报告'],
    ['实验', '例如 实验三指导手册'],
    ['项目', '例如 课程大作业项目说明'],
    ['代码', '例如 课程项目示例代码'],
    ['复习', '例如 期末复习提纲'],
    ['教材', '例如 课程教材配套资料'],
    ['书', '例如 参考书章节整理'],
  ]

  const match = examples.find(([keyword]) => normalizedTypeName.includes(keyword))
  return match ? match[1] : `例如 2024 春季${normalizedTypeName}补充资料`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function uploadFileToSignedUrl({
  file,
  onProgress,
  signal,
  url,
}: {
  file: File
  onProgress: (progress: number) => void
  signal: AbortSignal
  url: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false

    const cleanup = () => {
      signal.removeEventListener('abort', abort)
    }

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }

    const abort = () => {
      xhr.abort()
      finish(() => reject(new DOMException('Upload aborted', 'AbortError')))
    }

    if (signal.aborted) {
      abort()
      return
    }

    signal.addEventListener('abort', abort, { once: true })

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      finish(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`文件上传失败，状态码 ${xhr.status}`))
        }
      })
    }
    xhr.onerror = () => finish(() => reject(new Error('文件上传失败，请检查网络后重试')))
    xhr.onabort = () => finish(() => reject(new DOMException('Upload aborted', 'AbortError')))

    xhr.open('PUT', url)
    xhr.send(file)
  })
}

function UploadEmptyState({
  error,
  inputValue,
  isSearching,
}: {
  error: string | null
  inputValue: string
  isSearching: boolean
}) {
  if (isSearching) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        正在检索课程
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="text-sm font-medium text-danger">课程搜索失败</p>
        <p className="text-xs text-muted">{error}</p>
      </div>
    )
  }

  if (inputValue.trim().length >= 2) {
    return (
      <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted">
        没有匹配的课程
      </div>
    )
  }

  return (
    <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted">
      输入课程名或课号
    </div>
  )
}

function buildValidationErrors({
  description,
  isEditMode,
  name,
  points,
  selectedClassId,
  selectedCourse,
  selectedMaterialTypeId,
  uploadAgreementAccepted,
  uploadFile,
}: {
  description: string
  isEditMode: boolean
  name: string
  points: number
  selectedClassId: Key | null
  selectedCourse: Course | null
  selectedMaterialTypeId: Key | null
  uploadAgreementAccepted: boolean
  uploadFile: UploadFileState | null
}): FormErrors {
  const errors: FormErrors = {}

  if (!selectedMaterialTypeId) errors.materialType = '请选择资料类型'
  if (!Number.isInteger(points) || points < 0 || points > 10) {
    errors.points = '积分需要是 0 到 10 的整数'
  }
  if (!name.trim()) errors.name = '请填写资料名称'

  if (!isEditMode) {
    if (!selectedCourse) errors.course = '请选择课程'
    if (!selectedClassId) errors.teacher = '请选择教师'
    if (!description.trim()) {
      errors.description = '请填写资料描述'
    }
    if (!uploadFile) {
      errors.file = '请选择文件'
    } else if (uploadFile.status === 'failed') {
      errors.file = uploadFile.error || '文件上传失败，请重新上传'
    } else if (uploadFile.status !== 'complete' || !uploadFile.path) {
      errors.file = '文件仍在上传，请稍候'
    }
    if (!uploadAgreementAccepted) {
      errors.agreement = '请先阅读并同意资料上传规范'
    }
  }

  return errors
}

export default function MaterialUploadModal({
  editMaterial,
  initialSelection,
  isOpen,
  onClose,
  onEdited,
  token,
}: {
  editMaterial?: Material | null
  initialSelection?: MaterialUploadInitialSelection
  isOpen: boolean
  onClose: () => void
  onEdited?: (material: Material) => void
  token: string
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { showDialog } = useDialog()
  const isEditMode = !!editMaterial
  const hasNickname = Boolean(profile?.nickname?.trim())
  const [courseInput, setCourseInput] = useState('')
  const [courseOptions, setCourseOptions] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [isCourseSearching, setCourseSearching] = useState(false)
  const [courseSearchError, setCourseSearchError] = useState<string | null>(null)

  const [classes, setClasses] = useState<ClassSummary[]>([])
  const [selectedClassId, setSelectedClassId] = useState<Key | null>(null)
  const [teacherInput, setTeacherInput] = useState('')
  const [isClassesLoading, setClassesLoading] = useState(false)
  const [classesError, setClassesError] = useState<string | null>(null)

  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([])
  const [selectedMaterialTypeId, setSelectedMaterialTypeId] = useState<Key | null>(null)
  const [isMaterialTypesLoading, setMaterialTypesLoading] = useState(true)
  const [materialTypesError, setMaterialTypesError] = useState<string | null>(null)

  const [points, setPoints] = useState(0)
  const [anonymous, setAnonymous] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploadFile, setUploadFile] = useState<UploadFileState | null>(null)
  const [uploadAgreementAccepted, setUploadAgreementAccepted] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [appliedInitialSelectionKey, setAppliedInitialSelectionKey] = useState<string | null>(null)

  const uploadControllerRef = useRef<AbortController | null>(null)
  const submitControllerRef = useRef<AbortController | null>(null)

  const abortUpload = useCallback(() => {
    uploadControllerRef.current?.abort()
    uploadControllerRef.current = null
  }, [])

  const abortSubmit = useCallback(() => {
    submitControllerRef.current?.abort()
    submitControllerRef.current = null
  }, [])

  const resetForm = useCallback(() => {
    abortUpload()
    abortSubmit()
    setAppliedInitialSelectionKey(null)
    setCourseInput('')
    setCourseOptions([])
    setSelectedCourse(null)
    setCourseSearching(false)
    setCourseSearchError(null)
    setClasses([])
    setSelectedClassId(null)
    setTeacherInput('')
    setClassesLoading(false)
    setClassesError(null)
    setSelectedMaterialTypeId(null)
    setPoints(0)
    setAnonymous(true)
    setName('')
    setDescription('')
    setUploadFile(null)
    setUploadAgreementAccepted(false)
    setSubmitAttempted(false)
    setSubmitting(false)
  }, [abortSubmit, abortUpload])

  const editMaterialCourse = editMaterial ? getMaterialCourse(editMaterial) : null
  const editMaterialClassId = editMaterial ? getMaterialClassId(editMaterial) : null
  const editMaterialKey =
    isOpen && editMaterial
      ? [
          'edit',
          editMaterial.id,
          editMaterial.name,
          editMaterial.description,
          editMaterial.material_type_id,
          editMaterial.points,
          getMaterialAnonymous(editMaterial),
          hasNickname ? 'named' : 'anonymous-only',
        ].join(':')
      : null
  const initialSelectionKey =
    !isEditMode && isOpen && initialSelection
      ? [
          initialSelection.course.id,
          initialSelection.classId ?? '',
          initialSelection.teacherName ?? '',
        ].join(':')
      : null

  if (editMaterial && editMaterialKey && appliedInitialSelectionKey !== editMaterialKey) {
    const normalizedClassId = editMaterialClassId == null ? null : String(editMaterialClassId)
    setAppliedInitialSelectionKey(editMaterialKey)
    setCourseInput(editMaterialCourse ? formatCourseLabel(editMaterialCourse) : '')
    setCourseOptions(editMaterialCourse ? [editMaterialCourse] : [])
    setSelectedCourse(editMaterialCourse)
    setCourseSearching(false)
    setCourseSearchError(null)
    setClasses([])
    setSelectedClassId(normalizedClassId)
    setTeacherInput(getMaterialTeacherName(editMaterial))
    setClassesLoading(false)
    setClassesError(null)
    setSelectedMaterialTypeId(
      editMaterial.material_type_id ? String(editMaterial.material_type_id) : null,
    )
    setPoints(editMaterial.points)
    setAnonymous(hasNickname ? getMaterialAnonymous(editMaterial) : true)
    setName(editMaterial.name)
    setDescription(editMaterial.description)
    setUploadFile(null)
    setUploadAgreementAccepted(false)
    setSubmitAttempted(false)
    setSubmitting(false)
  } else if (
    !isEditMode &&
    initialSelection &&
    initialSelectionKey &&
    appliedInitialSelectionKey !== initialSelectionKey
  ) {
    const { classId, course, teacherName } = initialSelection
    const normalizedClassId = classId == null ? null : String(classId)
    setAppliedInitialSelectionKey(initialSelectionKey)
    setCourseInput(formatCourseLabel(course))
    setCourseOptions([course])
    setSelectedCourse(course)
    setCourseSearching(false)
    setCourseSearchError(null)
    setClasses([])
    setSelectedClassId(normalizedClassId)
    setTeacherInput(normalizedClassId ? (teacherName ?? '') : '')
    setClassesLoading(true)
    setClassesError(null)
    setUploadAgreementAccepted(false)
  }

  useEffect(
    () => () => {
      abortUpload()
      abortSubmit()
    },
    [abortSubmit, abortUpload],
  )

  useEffect(() => {
    if (!isOpen) return

    const controller = new AbortController()
    getMaterialTypes({ token, signal: controller.signal })
      .then((types) => {
        if (controller.signal.aborted) return
        setMaterialTypes(types)
      })
      .catch((error) => {
        if (isAbortError(error)) return
        setMaterialTypes([])
        setMaterialTypesError(error instanceof Error ? error.message : '获取资料类型失败')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setMaterialTypesLoading(false)
      })

    return () => controller.abort()
  }, [isOpen, token])

  useEffect(() => {
    if (!isOpen || isEditMode) return

    const keyword = courseInput.trim()
    if (selectedCourse && keyword === formatCourseLabel(selectedCourse)) {
      return
    }
    if (keyword.length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setCourseSearching(true)
      promptCourses({ keyword, token, signal: controller.signal })
        .then((courses) => {
          if (controller.signal.aborted) return
          setCourseOptions(courses)
        })
        .catch((error) => {
          if (isAbortError(error)) return
          setCourseOptions([])
          setCourseSearchError(error instanceof Error ? error.message : '搜索课程失败')
        })
        .finally(() => {
          if (controller.signal.aborted) return
          setCourseSearching(false)
        })
    }, COURSE_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [courseInput, isEditMode, isOpen, selectedCourse, token])

  const selectedCourseId = selectedCourse?.id ?? null

  useEffect(() => {
    if (!isOpen || selectedCourseId == null || isEditMode) return

    const controller = new AbortController()
    getCourseClasses({ id: selectedCourseId, token, signal: controller.signal })
      .then((nextClasses) => {
        if (controller.signal.aborted) return
        setClasses(nextClasses)
      })
      .catch((error) => {
        if (isAbortError(error)) return
        setClasses([])
        setClassesError(error instanceof Error ? error.message : '获取授课教师失败')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setClassesLoading(false)
      })

    return () => controller.abort()
  }, [isEditMode, isOpen, selectedCourseId, token])

  const validationErrors = useMemo(
    () =>
      buildValidationErrors({
        description,
        isEditMode,
        name,
        points,
        selectedClassId,
        selectedCourse,
        selectedMaterialTypeId,
        uploadAgreementAccepted,
        uploadFile,
      }),
    [
      description,
      isEditMode,
      name,
      points,
      selectedClassId,
      selectedCourse,
      selectedMaterialTypeId,
      uploadAgreementAccepted,
      uploadFile,
    ],
  )
  const hasValidationErrors = Object.keys(validationErrors).length > 0
  const visibleErrors = submitAttempted ? validationErrors : {}

  const handleCourseInputChange = useCallback(
    (value: string) => {
      setCourseInput(value)
      setCourseSearchError(null)

      if (selectedCourse && value === formatCourseLabel(selectedCourse)) {
        setCourseSearching(false)
        return
      }

      if (selectedCourse && value !== formatCourseLabel(selectedCourse)) {
        setSelectedCourse(null)
        setSelectedClassId(null)
        setTeacherInput('')
        setClasses([])
        setClassesLoading(false)
        setClassesError(null)
      }

      if (value.trim().length >= 2) {
        setCourseSearching(true)
      } else {
        setCourseOptions([])
        setCourseSearching(false)
      }
    },
    [selectedCourse],
  )

  const handleCourseSelection = useCallback(
    (key: Key | null) => {
      if (key == null) {
        setSelectedCourse(null)
        setSelectedClassId(null)
        setTeacherInput('')
        setClasses([])
        return
      }

      const course = courseOptions.find((item) => String(item.id) === String(key))
      if (!course) return

      setSelectedCourse(course)
      setCourseInput(formatCourseLabel(course))
      setCourseOptions([course])
      setSelectedClassId(null)
      setTeacherInput('')
      setClasses([])
      setClassesLoading(true)
      setClassesError(null)
      setCourseSearching(false)
    },
    [courseOptions],
  )

  const teacherOptions = useMemo(() => {
    const keyword = teacherInput.trim().toLowerCase()
    if (!keyword) return classes

    return classes.filter((classItem) =>
      formatTeacherSearchText(classItem).toLowerCase().includes(keyword),
    )
  }, [classes, teacherInput])

  const handleTeacherInputChange = useCallback(
    (value: string) => {
      setTeacherInput(value)

      if (!selectedClassId) return

      const selectedClass = classes.find((item) => String(item.id) === String(selectedClassId))
      if (!selectedClass || value !== getTeacherName(selectedClass)) {
        setSelectedClassId(null)
      }
    },
    [classes, selectedClassId],
  )

  const handleTeacherSelection = useCallback(
    (key: Key | null) => {
      if (key == null) {
        setSelectedClassId(null)
        setTeacherInput('')
        return
      }

      const selectedClass = classes.find((item) => String(item.id) === String(key))
      if (!selectedClass) return

      setSelectedClassId(key)
      setTeacherInput(getTeacherName(selectedClass))
    },
    [classes],
  )

  const startFileUpload = useCallback(
    (file: File) => {
      abortUpload()

      const id = createUploadId()
      const baseState: UploadFileState = {
        file,
        id,
        name: file.name,
        progress: 0,
        size: file.size,
        status: 'uploading',
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadFile({
          ...baseState,
          error: '文件不能超过 100 MB',
          status: 'failed',
        })
        return
      }

      const controller = new AbortController()
      uploadControllerRef.current = controller
      setUploadFile({ ...baseState, progress: 2 })

      requestMaterialUpload({
        fileName: file.name,
        fileSize: file.size,
        token,
        signal: controller.signal,
      })
        .then((ticket) => {
          if (controller.signal.aborted) return null
          setUploadFile((current) =>
            current?.id === id ? { ...current, path: ticket.path, progress: 8 } : current,
          )

          return uploadFileToSignedUrl({
            file,
            signal: controller.signal,
            url: ticket.url,
            onProgress: (progress) => {
              setUploadFile((current) =>
                current?.id === id
                  ? { ...current, progress: Math.min(99, Math.max(current.progress, progress)) }
                  : current,
              )
            },
          }).then(() => ticket.path)
        })
        .then((path) => {
          if (!path || controller.signal.aborted) return
          setUploadFile((current) =>
            current?.id === id ? { ...current, path, progress: 100, status: 'complete' } : current,
          )
        })
        .catch((error) => {
          if (isAbortError(error)) return
          setUploadFile((current) =>
            current?.id === id
              ? {
                  ...current,
                  error: error instanceof Error ? error.message : '文件上传失败',
                  status: 'failed',
                }
              : current,
          )
        })
        .finally(() => {
          if (uploadControllerRef.current === controller) {
            uploadControllerRef.current = null
          }
        })
    },
    [abortUpload, token],
  )

  const handleFileSelect = useCallback(
    (fileList: FileList) => {
      const file = fileList.item(0)
      if (file) startFileUpload(file)
    },
    [startFileUpload],
  )

  const handleDrop = useCallback(
    async (event: DropZoneDropEvent) => {
      for (const item of event.items) {
        if (item.kind === 'file') {
          startFileUpload(await item.getFile())
          return
        }
      }
    },
    [startFileUpload],
  )

  const handleRemoveFile = useCallback(() => {
    abortUpload()
    setUploadFile(null)
  }, [abortUpload])

  const handleRetryUpload = useCallback(() => {
    if (uploadFile?.file) startFileUpload(uploadFile.file)
  }, [startFileUpload, uploadFile])

  const selectedMaterialType = materialTypes.find(
    (type) => String(type.id) === String(selectedMaterialTypeId),
  )
  const materialNamePlaceholder = getMaterialNamePlaceholder(selectedMaterialType?.name)
  const currentMaterialFileName = editMaterial ? getMaterialFileName(editMaterial) : ''
  const currentMaterialFileExtension = getExtension(currentMaterialFileName)
  const effectiveAnonymous = hasNickname ? anonymous : true

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitAttempted(true)

      if (hasValidationErrors || !selectedMaterialTypeId) {
        return
      }

      abortSubmit()
      const controller = new AbortController()
      submitControllerRef.current = controller
      setSubmitting(true)

      if (isEditMode) {
        if (!editMaterial) return

        updateMaterial({
          id: editMaterial.id,
          token,
          signal: controller.signal,
          data: {
            anonymous: effectiveAnonymous,
            description: description.trim(),
            material_type_id: Number(selectedMaterialTypeId),
            name: name.trim(),
            points,
          },
        })
          .then((material) => {
            if (controller.signal.aborted) return
            const merged = mergeUpdatedMaterial({
              current: editMaterial,
              selectedType: selectedMaterialType ?? null,
              updated: material,
            })

            if (submitControllerRef.current === controller) {
              submitControllerRef.current = null
            }
            showDialog({
              status: 'success',
              title: '资料已更新',
              description: `「${merged.name || merged.file_name}」的资料信息已保存。`,
              onClose: () => {
                onEdited?.(merged)
                resetForm()
                onClose()
              },
            })
          })
          .catch((error) => {
            if (isAbortError(error)) return
            showDialog({
              status: 'danger',
              title: '更新失败',
              description: error instanceof Error ? error.message : '请稍后再试',
            })
          })
          .finally(() => {
            if (controller.signal.aborted) return
            setSubmitting(false)
            if (submitControllerRef.current === controller) {
              submitControllerRef.current = null
            }
          })
        return
      }

      if (!selectedCourse || !selectedClassId || !uploadFile?.path) {
        setSubmitting(false)
        if (submitControllerRef.current === controller) {
          submitControllerRef.current = null
        }
        return
      }

      createMaterial({
        token,
        signal: controller.signal,
        data: {
          anonymous: effectiveAnonymous,
          class_id: Number(selectedClassId),
          course_id: selectedCourse.id,
          description: description.trim(),
          material_type_id: Number(selectedMaterialTypeId),
          name: name.trim(),
          path: uploadFile.path,
          points,
        },
      })
        .then((material) => {
          if (controller.signal.aborted) return
          const materialName = material.name || name.trim()
          const materialPath = `/course/${encodeURIComponent(
            String(selectedCourse.id),
          )}/class/${encodeURIComponent(String(selectedClassId))}/material/${encodeURIComponent(
            String(material.id),
          )}`

          if (submitControllerRef.current === controller) {
            submitControllerRef.current = null
          }
          showDialog({
            status: 'success',
            title: '上传成功',
            description: `「${materialName}」已提交`,
            onClose: () => {
              resetForm()
              onClose()
              navigate(materialPath)
            },
          })
        })
        .catch((error) => {
          if (isAbortError(error)) return
          showDialog({
            status: 'danger',
            title: '上传失败',
            description: error instanceof Error ? error.message : '请稍后再试',
          })
        })
        .finally(() => {
          if (controller.signal.aborted) return
          setSubmitting(false)
          if (submitControllerRef.current === controller) {
            submitControllerRef.current = null
          }
        })
    },
    [
      abortSubmit,
      description,
      editMaterial,
      effectiveAnonymous,
      hasValidationErrors,
      isEditMode,
      name,
      navigate,
      onClose,
      onEdited,
      points,
      resetForm,
      selectedClassId,
      selectedCourse,
      selectedMaterialTypeId,
      selectedMaterialType,
      showDialog,
      token,
      uploadFile,
    ],
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return
      resetForm()
      onClose()
    },
    [onClose, resetForm],
  )

  const handleClosePress = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  const isFileUploading = !isEditMode && uploadFile?.status === 'uploading'
  const canSubmit = !isSubmitting && !isFileUploading && (isEditMode || uploadAgreementAccepted)

  return (
    <Modal.Backdrop isOpen={isOpen} variant="blur" onOpenChange={handleOpenChange}>
      <Modal.Container
        className="px-0 py-0 sm:px-6 sm:py-4"
        placement="center"
        scroll="inside"
        size="lg"
      >
        <Modal.Dialog
          aria-label={isEditMode ? '编辑资料' : '上传资料'}
          className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl bg-background p-0 shadow-[0_24px_80px_rgb(0_0_0/0.2)] dark:border dark:border-white/10 dark:shadow-[0_28px_90px_rgb(0_0_0/0.72),0_0_0_1px_rgb(255_255_255/0.04)] sm:max-w-240"
        >
          <Modal.CloseTrigger className="right-4 top-4 sm:right-6 sm:top-6" />
          <Modal.Header className="border-b border-separator bg-surface/60 px-5 py-5 sm:px-7">
            <div className="flex min-w-0 items-start gap-3 pr-10">
              <Modal.Icon className="mt-0.5 bg-accent-soft text-accent-soft-foreground">
                {isEditMode ? (
                  <PencilToSquare className="size-5" />
                ) : (
                  <FilePlus className="size-5" />
                )}
              </Modal.Icon>
              <div className="min-w-0">
                <Modal.Heading className="text-xl font-semibold leading-7">
                  {isEditMode ? '编辑资料' : '上传资料'}
                </Modal.Heading>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {isEditMode
                    ? '课程、教师和文件保持不变，可更新资料名称、描述、类型和积分。'
                    : '选择课程、教师和资料类型后，上传文件并提交资料信息。'}
                </p>
              </div>
            </div>
          </Modal.Header>

          <Form
            aria-label={isEditMode ? '编辑资料表单' : '上传资料表单'}
            className="flex min-h-0 flex-1 flex-col"
            validationBehavior="aria"
            onSubmit={handleSubmit}
          >
            <Modal.Body className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="rounded-2xl border border-border/70 bg-surface/60 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Books className="size-4 text-accent" />
                      <h3 className="text-sm font-semibold text-foreground">课程信息</h3>
                    </div>

                    <div className="flex flex-col gap-4">
                      <ComboBox
                        allowsEmptyCollection
                        className="w-full"
                        inputValue={courseInput}
                        isDisabled={isEditMode}
                        isInvalid={!!visibleErrors.course}
                        menuTrigger="input"
                        selectedKey={selectedCourse ? String(selectedCourse.id) : null}
                        onInputChange={handleCourseInputChange}
                        onSelectionChange={handleCourseSelection}
                      >
                        <Label>课程</Label>
                        <ComboBox.InputGroup>
                          <Input placeholder="课程名或课号" />
                          <ComboBox.Trigger />
                        </ComboBox.InputGroup>
                        {isEditMode ? null : <Description>至少输入两个字搜索课程</Description>}
                        <FieldError>{visibleErrors.course}</FieldError>
                        <ComboBox.Popover>
                          <ListBox
                            renderEmptyState={() => (
                              <UploadEmptyState
                                error={courseSearchError}
                                inputValue={courseInput}
                                isSearching={isCourseSearching}
                              />
                            )}
                          >
                            {courseOptions.map((course) => {
                              const organization = course.organization?.name ?? '暂无开课院系'
                              return (
                                <ListBox.Item
                                  key={course.id}
                                  id={String(course.id)}
                                  textValue={formatCourseLabel(course)}
                                >
                                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-medium">
                                      {course.name}
                                    </span>
                                    <span className="truncate text-xs text-muted">
                                      {[course.code, organization].filter(Boolean).join(' · ')}
                                    </span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              )
                            })}
                          </ListBox>
                        </ComboBox.Popover>
                      </ComboBox>

                      <ComboBox
                        allowsEmptyCollection
                        className="w-full"
                        defaultFilter={() => true}
                        inputValue={teacherInput}
                        isDisabled={
                          isEditMode || !selectedCourse || isClassesLoading || classes.length === 0
                        }
                        isInvalid={!!visibleErrors.teacher || !!classesError}
                        menuTrigger="focus"
                        selectedKey={selectedClassId}
                        onInputChange={handleTeacherInputChange}
                        onSelectionChange={handleTeacherSelection}
                      >
                        <Label>教师</Label>
                        <ComboBox.InputGroup>
                          <Input
                            placeholder={
                              isClassesLoading
                                ? '正在加载教师'
                                : selectedCourse
                                  ? '搜索教师'
                                  : '请先选择课程'
                            }
                          />
                          <ComboBox.Trigger />
                        </ComboBox.InputGroup>
                        {isEditMode ? null : (
                          <Description>如果没有找到相应教师，请联系我们。</Description>
                        )}
                        <FieldError>{classesError || visibleErrors.teacher}</FieldError>
                        <ComboBox.Popover>
                          <ListBox
                            renderEmptyState={() => (
                              <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted">
                                {teacherInput.trim() ? '没有匹配的教师' : '暂无教师'}
                              </div>
                            )}
                          >
                            {teacherOptions.map((classItem) => {
                              const teacher = getTeacherName(classItem)
                              const organization = getTeacherOrganizationName(classItem)
                              return (
                                <ListBox.Item
                                  key={classItem.id}
                                  id={String(classItem.id)}
                                  textValue={teacher}
                                >
                                  <Person className="size-4 shrink-0 text-muted" />
                                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-medium">{teacher}</span>
                                    {organization ? (
                                      <span className="truncate text-xs text-muted">
                                        {organization}
                                      </span>
                                    ) : null}
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              )
                            })}
                          </ListBox>
                        </ComboBox.Popover>
                      </ComboBox>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-surface/60 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <FilePlus className="size-4 text-accent" />
                      <h3 className="text-sm font-semibold text-foreground">资料内容</h3>
                    </div>

                    <div className="flex flex-col gap-4">
                      <TextField fullWidth isInvalid={!!visibleErrors.name} name="name" type="text">
                        <Label>资料名称</Label>
                        <Input
                          placeholder={materialNamePlaceholder}
                          value={name}
                          onChange={(event) => {
                            setName(event.target.value)
                          }}
                        />
                        <FieldError>{visibleErrors.name}</FieldError>
                      </TextField>

                      <TextField
                        fullWidth
                        isInvalid={!!visibleErrors.description}
                        name="description"
                      >
                        <Label>资料描述</Label>
                        <TextArea
                          className="min-h-30"
                          placeholder="说明资料内容、适用年份或使用建议"
                          value={description}
                          onChange={(event) => {
                            setDescription(event.target.value)
                          }}
                        />
                        <FieldError>{visibleErrors.description}</FieldError>
                      </TextField>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <div className="rounded-2xl border border-border/70 bg-surface/60 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <FilePlus className="size-4 text-accent" />
                      <h3 className="text-sm font-semibold text-foreground">资料设置</h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        className="w-full"
                        isDisabled={isMaterialTypesLoading || materialTypes.length === 0}
                        isInvalid={!!visibleErrors.materialType || !!materialTypesError}
                        placeholder={isMaterialTypesLoading ? '正在加载类型' : '选择类型'}
                        value={selectedMaterialTypeId}
                        onChange={(key) => {
                          setSelectedMaterialTypeId(key)
                        }}
                      >
                        <Label>资料类型</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <FieldError>{materialTypesError || visibleErrors.materialType}</FieldError>
                        <Select.Popover>
                          <ListBox>
                            {materialTypes.map((type) => (
                              <ListBox.Item
                                key={type.id}
                                id={String(type.id)}
                                textValue={type.name}
                              >
                                {type.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <NumberField
                        fullWidth
                        className="w-full"
                        formatOptions={{ maximumFractionDigits: 0 }}
                        isInvalid={!!visibleErrors.points}
                        maxValue={10}
                        minValue={0}
                        name="points"
                        step={1}
                        value={points}
                        onChange={(value) => {
                          const next = Math.round(value ?? 0)
                          setPoints(Math.min(10, Math.max(0, next)))
                        }}
                      >
                        <Label>所需积分</Label>
                        <NumberField.Group className="w-full">
                          <NumberField.DecrementButton />
                          <NumberField.Input className="w-full text-center tabular-nums" />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                        <Description>0 到 10 的整数</Description>
                        <FieldError>{visibleErrors.points}</FieldError>
                      </NumberField>

                      <Switch
                        className="sm:col-span-2"
                        isDisabled={!hasNickname}
                        isSelected={effectiveAnonymous}
                        name="anonymous"
                        onChange={setAnonymous}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                          <Label className="text-sm">{isEditMode ? '匿名展示' : '匿名上传'}</Label>
                          <Description>
                            {hasNickname
                              ? '开启后资料详情中显示为匿名用户；关闭后显示你的昵称。'
                              : isEditMode
                                ? '未设置昵称时只能匿名展示；设置昵称后可关闭匿名。'
                                : '未设置昵称时只能匿名上传；设置昵称后可关闭匿名。'}
                          </Description>
                        </Switch.Content>
                      </Switch>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-surface/60 p-4">
                    <DropZone className="w-full">
                      <DropZone.Area
                        isDisabled={isSubmitting || isEditMode}
                        onDrop={isEditMode ? undefined : handleDrop}
                      >
                        <DropZone.Icon>
                          <CloudArrowUpIn />
                        </DropZone.Icon>
                        <DropZone.Label>
                          {isEditMode ? '已上传文件' : uploadFile ? '替换资料文件' : '选择资料文件'}
                        </DropZone.Label>
                        <DropZone.Description>
                          {isEditMode ? currentMaterialFileName : '单个文件，最大 100 MB'}
                        </DropZone.Description>
                        <DropZone.Trigger isDisabled={isSubmitting || isEditMode}>
                          选择文件
                        </DropZone.Trigger>
                      </DropZone.Area>
                      {isEditMode ? null : <DropZone.Input onSelect={handleFileSelect} />}

                      {isEditMode && editMaterial ? (
                        <DropZone.FileList>
                          <DropZone.FileItem status="complete">
                            <DropZone.FileFormatIcon
                              color={getFormatColor(currentMaterialFileExtension)}
                              format={currentMaterialFileExtension.toUpperCase() || 'FILE'}
                            />
                            <DropZone.FileInfo>
                              <DropZone.FileName>{currentMaterialFileName}</DropZone.FileName>
                              <DropZone.FileMeta>
                                {[formatFileSize(editMaterial.size), '当前文件']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </DropZone.FileMeta>
                            </DropZone.FileInfo>
                          </DropZone.FileItem>
                        </DropZone.FileList>
                      ) : uploadFile ? (
                        <DropZone.FileList>
                          <DropZone.FileItem status={uploadFile.status}>
                            <DropZone.FileFormatIcon
                              color={getFormatColor(getExtension(uploadFile.name))}
                              format={getExtension(uploadFile.name).toUpperCase() || 'FILE'}
                            />
                            <DropZone.FileInfo>
                              <DropZone.FileName>{uploadFile.name}</DropZone.FileName>
                              <DropZone.FileMeta>
                                {formatFileSize(uploadFile.size)}
                                {uploadFile.status === 'uploading' ? (
                                  <span> · 上传中 {uploadFile.progress}%</span>
                                ) : null}
                                {uploadFile.status === 'complete' ? (
                                  <span className="inline-flex items-center gap-1 text-success">
                                    {' '}
                                    · <CircleCheckFill className="size-3" /> 已上传
                                  </span>
                                ) : null}
                                {uploadFile.status === 'failed' ? (
                                  <span className="inline-flex items-center gap-1 text-danger">
                                    {' '}
                                    · <CircleXmarkFill className="size-3" /> 上传失败
                                  </span>
                                ) : null}
                              </DropZone.FileMeta>
                              {uploadFile.status !== 'failed' ? (
                                <DropZone.FileProgress value={uploadFile.progress}>
                                  <DropZone.FileProgressTrack>
                                    <DropZone.FileProgressFill />
                                  </DropZone.FileProgressTrack>
                                </DropZone.FileProgress>
                              ) : (
                                <Button
                                  className="-ml-1 mt-2"
                                  size="sm"
                                  variant="danger-soft"
                                  onPress={handleRetryUpload}
                                >
                                  重新上传
                                </Button>
                              )}
                              {uploadFile.status === 'failed' && uploadFile.error ? (
                                <DropZone.FileMeta>
                                  <span className="text-danger">{uploadFile.error}</span>
                                </DropZone.FileMeta>
                              ) : null}
                            </DropZone.FileInfo>
                            <DropZone.FileRemoveTrigger
                              aria-label={`移除 ${uploadFile.name}`}
                              onPress={handleRemoveFile}
                            >
                              <TrashBin />
                            </DropZone.FileRemoveTrigger>
                          </DropZone.FileItem>
                        </DropZone.FileList>
                      ) : null}
                    </DropZone>

                    {visibleErrors.file ? (
                      <p className="mt-2 text-xs text-danger">{visibleErrors.file}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer className="flex flex-col items-stretch gap-3 border-t border-separator bg-surface/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-7">
              {isEditMode ? (
                <div className="hidden sm:block" />
              ) : (
                <div className="flex min-w-0 flex-col gap-1">
                  <Checkbox
                    aria-describedby={
                      visibleErrors.agreement ? 'material-upload-agreement-error' : undefined
                    }
                    className="max-w-full"
                    id="material-upload-agreement"
                    isInvalid={!!visibleErrors.agreement}
                    isSelected={uploadAgreementAccepted}
                    name="uploadAgreement"
                    value="accepted"
                    onChange={setUploadAgreementAccepted}
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <Label
                        className="text-sm leading-6 text-foreground"
                        htmlFor="material-upload-agreement"
                      >
                        {'我已阅读并同意 '}
                        <Link
                          className={AGREEMENT_LINK_CLASS}
                          href="/upload-rules"
                          rel="noreferrer"
                          target="_blank"
                        >
                          资料上传规范
                        </Link>
                      </Label>
                    </Checkbox.Content>
                  </Checkbox>

                  {visibleErrors.agreement ? (
                    <p className="text-xs text-danger" id="material-upload-agreement-error">
                      {visibleErrors.agreement}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="flex shrink-0 justify-end gap-2">
                <Button type="button" variant="secondary" onPress={handleClosePress}>
                  关闭
                </Button>
                <Button
                  isDisabled={!canSubmit}
                  isPending={isSubmitting}
                  type="submit"
                  variant="primary"
                >
                  {isEditMode ? '保存修改' : isFileUploading ? '文件上传中' : '提交资料'}
                </Button>
              </div>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
