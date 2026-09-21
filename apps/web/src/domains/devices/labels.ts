import type {CameraAspect, CameraViewMode, DeviceKind, VisitKind, WallLayout} from '@smartosa/core';

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  camera: 'Камера',
  iframe: 'Веб-морда',
  link: 'Ссылка',
};

export const VIEW_MODE_LABEL: Record<CameraViewMode, string> = {
  snapshot: 'Снимок JPEG',
  mjpeg: 'MJPEG',
  iframe: 'Морда камеры',
  go2rtc: 'go2rtc (живое видео)',
  external: 'Открыть снаружи',
};

export const ASPECT_LABEL: Record<CameraAspect, string> = {
  native: 'Как пришло',
  '16:9': '16:9',
  '16:10': '16:10',
  '4:3': '4:3',
};

export const WALL_LAYOUT_LABEL: Record<WallLayout, string> = {
  '2x2': 'Сетка 2×2',
  '1+3': 'Одна большая',
  custom: 'По ширине',
};

export const VISIT_KIND_LABEL: Record<VisitKind, string> = {
  app: 'Панель',
  device: 'Устройство',
  wall: 'Стена',
};

export function formatWhen(at: number): string {
  return new Intl.DateTimeFormat('ru', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}
