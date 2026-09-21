import type {ReactNode} from 'react';
import styles from './Card.module.css';

type Props = {
  children: ReactNode;
  className?: string;
};

export function Card({children, className}: Props) {
  return <section className={[styles.card, className].filter(Boolean).join(' ')}>{children}</section>;
}
