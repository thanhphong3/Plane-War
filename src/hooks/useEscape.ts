import { useEffect, useRef } from 'react';

/** Closes a modal with Esc while it is open (keyboard players had to click the X before). */
export function useEscape(isOpen: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (evt: KeyboardEvent) => {
      if (evt.code === 'Escape' && !evt.repeat) {
        evt.stopPropagation();
        cb.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);
}
