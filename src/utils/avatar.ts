import { constants } from '../env'

const AVATAR_STORAGE_BASE_URL =
  'https://s3.jcloud.sjtu.edu.cn/9fd44bb76f604e8597acfcceada7cb83-tongqu/sharesjtu'

export const AVATAR_CROP_VIEWPORT_SIZE = 256
export const MAX_AVATAR_DIMENSION = 1024

export interface AvatarImageSize {
  height: number
  width: number
}

export interface AvatarCropOffset {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getUserAvatarUrl(path: string | null | undefined): string | null {
  const trimmed = path?.trim()
  if (!trimmed) return null
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed

  const normalized = trimmed.replace(/^\/+/, '')
  if (normalized.startsWith('avatars/')) {
    return `${AVATAR_STORAGE_BASE_URL}/${normalized}`
  }
  if (trimmed.startsWith('/')) return `${constants.API_URL}${trimmed}`
  return `${constants.API_URL}/${normalized}`
}

export function getCoverScale(
  size: AvatarImageSize,
  viewportSize = AVATAR_CROP_VIEWPORT_SIZE,
): number {
  return Math.max(viewportSize / size.width, viewportSize / size.height)
}

export function getRenderedAvatarImageSize(
  size: AvatarImageSize,
  zoom: number,
  viewportSize = AVATAR_CROP_VIEWPORT_SIZE,
): AvatarImageSize {
  const scale = getCoverScale(size, viewportSize) * zoom
  return {
    height: size.height * scale,
    width: size.width * scale,
  }
}

export function clampAvatarCropOffset({
  offset,
  size,
  viewportSize = AVATAR_CROP_VIEWPORT_SIZE,
  zoom,
}: {
  offset: AvatarCropOffset
  size: AvatarImageSize
  viewportSize?: number
  zoom: number
}): AvatarCropOffset {
  const rendered = getRenderedAvatarImageSize(size, zoom, viewportSize)
  const maxX = Math.max(0, (rendered.width - viewportSize) / 2)
  const maxY = Math.max(0, (rendered.height - viewportSize) / 2)

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法读取图片，请换一张再试'))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('头像裁剪失败，请重新选择图片'))
      }
    }, 'image/png')
  })
}

export async function createSquareAvatarBlob({
  image,
  offset = { x: 0, y: 0 },
  size,
  viewportSize = AVATAR_CROP_VIEWPORT_SIZE,
  zoom = 1,
}: {
  image: HTMLImageElement
  offset?: AvatarCropOffset
  size: AvatarImageSize
  viewportSize?: number
  zoom?: number
}): Promise<Blob> {
  const scale = getCoverScale(size, viewportSize) * zoom
  const rendered = getRenderedAvatarImageSize(size, zoom, viewportSize)
  const imageLeft = viewportSize / 2 + offset.x - rendered.width / 2
  const imageTop = viewportSize / 2 + offset.y - rendered.height / 2
  const sourceX = clamp((0 - imageLeft) / scale, 0, size.width)
  const sourceY = clamp((0 - imageTop) / scale, 0, size.height)
  const sourceSize = Math.min(viewportSize / scale, size.width - sourceX, size.height - sourceY)
  const outputSize = Math.max(1, Math.min(MAX_AVATAR_DIMENSION, Math.round(sourceSize)))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('头像裁剪失败，请重新选择图片')

  canvas.width = outputSize
  canvas.height = outputSize
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    outputSize,
    outputSize,
  )

  return canvasToBlob(canvas)
}
