import {AppWindow, Box, Camera, LayoutGrid, Link2, type LucideIcon} from 'lucide-react';
import styles from './KindMark.module.css';

export type MarkKind = 'camera' | 'iframe' | 'link' | 'wall' | 'device';

const MARK: Record<MarkKind, {icon: LucideIcon; label: string}> = {
  camera: {icon: Camera, label: 'Камера'},
  iframe: {icon: AppWindow, label: 'Веб-морда'},
  link: {icon: Link2, label: 'Ссылка'},
  wall: {icon: LayoutGrid, label: 'Стена'},
  device: {icon: Box, label: 'Устройство'},
};

type Props = {
  kind: MarkKind;
  label?: boolean;
};

export function KindMark({kind, label = true}: Props) {
  const item = MARK[kind];
  const Icon = item.icon;
  return (
    <span className={label ? styles.mark : styles.iconOnly} title={item.label}>
      <Icon aria-hidden size={16} />
      {label ? <span>{item.label}</span> : null}
    </span>
  );
}

export function kindIcon(kind: MarkKind): LucideIcon {
  return MARK[kind].icon;
}

export function kindLabel(kind: MarkKind): string {
  return MARK[kind].label;
}
