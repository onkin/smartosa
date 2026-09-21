import type {SelectHTMLAttributes} from 'react';
import styles from './Field.module.css';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={styles.input} {...props} />;
}
