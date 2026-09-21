import type {InputHTMLAttributes, ReactNode, TextareaHTMLAttributes} from 'react';
import styles from './Field.module.css';

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({label, hint, children}: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.head}>
        <span className={styles.label}>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={styles.input} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={styles.input} rows={3} {...props} />;
}
