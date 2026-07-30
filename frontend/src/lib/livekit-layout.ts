export const localVideoPreviewSize = {
  width: '120px',
  height: '80px',
} as const

export const localVideoPreviewStyle = {
  width: localVideoPreviewSize.width,
  height: localVideoPreviewSize.height,
} as const

export function stageVideoClass(isStage: boolean) {
  return isStage
    ? 'absolute inset-0 h-full w-full object-contain'
    : 'absolute right-3 bottom-3 z-10 h-20 w-28 rounded-lg object-cover'
}
