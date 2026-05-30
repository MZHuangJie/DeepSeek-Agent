import React from 'react';
import { useConfirmStore } from '../stores/confirm';
import styles from './Confirm.module.css';

export default function Confirm() {
  const { open, message, onConfirm, close } = useConfirmStore();

  if (!open) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    close();
  };

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={close}>取消</button>
          <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>确定删除</button>
        </div>
      </div>
    </div>
  );
}
