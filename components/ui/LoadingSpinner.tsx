'use client';

import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  return (
    <div className={styles.wrapper} role="status" aria-label={label ?? 'Loading'}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.ring} />
        <div className={`${styles.ring} ${styles.ring2}`} />
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
