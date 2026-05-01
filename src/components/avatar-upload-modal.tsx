import { Crop, Picture } from '@gravity-ui/icons'
import { Button, Label, Modal, Slider } from '@heroui/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from 'react'
import { updateUserProfile } from '../api/user'
import { useAuth } from '../auth/use-auth'
import {
  clampAvatarCropOffset,
  createSquareAvatarBlob,
  getRenderedAvatarImageSize,
  type AvatarCropOffset,
  type AvatarImageSize,
} from '../utils/avatar'

const MIN_ZOOM = 1
const MAX_ZOOM = 3

interface AvatarUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface DragState {
  origin: AvatarCropOffset
  pointerId: number
  startX: number
  startY: number
}

export default function AvatarUploadModal({ isOpen, onClose }: AvatarUploadModalProps) {
  const { profile, setProfile, token } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<AvatarImageSize | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [offset, setOffset] = useState<AvatarCropOffset>({ x: 0, y: 0 })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const renderedImageSize = useMemo(
    () => (imageSize ? getRenderedAvatarImageSize(imageSize, zoom) : null),
    [imageSize, zoom],
  )

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  const reset = useCallback(() => {
    clearPreview()
    dragRef.current = null
    setError(null)
    setImageSize(null)
    setOffset({ x: 0, y: 0 })
    setSubmitting(false)
    setZoom(1)
  }, [clearPreview])

  const close = useCallback(() => {
    if (isSubmitting) return
    reset()
    onClose()
  }, [isSubmitting, onClose, reset])

  useEffect(() => () => clearPreview(), [clearPreview])

  useEffect(() => {
    if (isOpen) return
    const timer = window.setTimeout(reset, 0)
    return () => window.clearTimeout(timer)
  }, [isOpen, reset])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) return
    if (!selectedFile.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile)
    const probe = new Image()
    probe.onload = () => {
      if (!probe.naturalWidth || !probe.naturalHeight) {
        URL.revokeObjectURL(nextPreviewUrl)
        setError('无法读取图片尺寸')
        return
      }

      clearPreview()
      previewUrlRef.current = nextPreviewUrl
      setPreviewUrl(nextPreviewUrl)
      setImageSize({ height: probe.naturalHeight, width: probe.naturalWidth })
      setOffset({ x: 0, y: 0 })
      setZoom(1)
      setError(null)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(nextPreviewUrl)
      setError('无法读取图片，请换一张再试')
    }
    probe.src = nextPreviewUrl
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageSize || isSubmitting) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      origin: offset,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !imageSize) return

    setOffset(
      clampAvatarCropOffset({
        offset: {
          x: drag.origin.x + event.clientX - drag.startX,
          y: drag.origin.y + event.clientY - drag.startY,
        },
        size: imageSize,
        zoom,
      }),
    )
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleZoomChange = (value: number | number[]) => {
    if (!imageSize) return
    const nextZoom = Array.isArray(value) ? (value[0] ?? MIN_ZOOM) : value
    setZoom(nextZoom)
    setOffset((current) =>
      clampAvatarCropOffset({ offset: current, size: imageSize, zoom: nextZoom }),
    )
  }

  const resetCrop = useCallback(() => {
    dragRef.current = null
    setOffset({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  const handleSubmit = async () => {
    if (!token || !profile) return
    if (!imageRef.current || !imageSize) {
      setError('请选择图片')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const avatar = await createSquareAvatarBlob({
        image: imageRef.current,
        offset,
        size: imageSize,
        zoom,
      })
      const nextProfile = await updateUserProfile({ avatar, token })
      setProfile(nextProfile)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像更新失败')
      setSubmitting(false)
    }
  }

  return (
    <Modal.Backdrop
      isDismissable={!isSubmitting}
      isKeyboardDismissDisabled={isSubmitting}
      isOpen={isOpen}
      variant="blur"
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger className="right-4 top-4" />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Crop className="size-5" />
            </Modal.Icon>
            <Modal.Heading>设置新头像</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="gap-5 overflow-visible">
            <input
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={handleFileChange}
            />

            {previewUrl && imageSize && renderedImageSize ? (
              <div className="grid gap-4">
                <div
                  className="relative mx-auto size-64 touch-none select-none overflow-hidden rounded-lg border border-border bg-surface-secondary"
                  role="presentation"
                  onPointerCancel={handlePointerUp}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  <img
                    ref={imageRef}
                    alt=""
                    className="absolute left-1/2 top-1/2 max-w-none cursor-grab object-fill active:cursor-grabbing"
                    draggable={false}
                    src={previewUrl}
                    style={{
                      height: renderedImageSize.height,
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                      width: renderedImageSize.width,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-foreground/15" />
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }, (_, index) => (
                      <div key={index} className="border border-white/25" />
                    ))}
                  </div>
                </div>

                <Slider
                  aria-label="头像缩放"
                  className="w-full overflow-visible"
                  isDisabled={isSubmitting}
                  maxValue={MAX_ZOOM}
                  minValue={MIN_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={handleZoomChange}
                >
                  <Label className="text-sm font-medium text-foreground">缩放</Label>
                  <Slider.Track className="overflow-visible">
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/80 bg-surface-secondary/50 px-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-lg bg-surface text-muted shadow-sm">
                  <Picture className="size-6" />
                </div>
                <Button size="sm" type="button" variant="outline" onPress={openFilePicker}>
                  <Picture className="size-4" />
                  选择图片
                </Button>
              </div>
            )}

            {error ? (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {previewUrl ? (
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <Button
                  fullWidth
                  isDisabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onPress={openFilePicker}
                >
                  重新选择
                </Button>
                <Button
                  fullWidth
                  isDisabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onPress={resetCrop}
                >
                  重置裁剪
                </Button>
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                fullWidth
                isDisabled={isSubmitting}
                type="button"
                variant="secondary"
                onPress={close}
              >
                取消
              </Button>
              <Button
                fullWidth
                isDisabled={!previewUrl}
                isPending={isSubmitting}
                type="button"
                variant="primary"
                onPress={handleSubmit}
              >
                保存头像
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
