'use client';

import { useEffect, useState } from 'react';

/** Shows the bypass link for keyboard traversal without exposing it after route-managed focus. */
export function SkipLink({ className, href }: { className: string; href: string }) {
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  useEffect(() => {
    const expectKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key === 'Tab') setKeyboardFocus(true);
    };
    const expectPointerFocus = () => setKeyboardFocus(false);
    window.addEventListener('keydown', expectKeyboardFocus);
    window.addEventListener('pointerdown', expectPointerFocus);
    return () => {
      window.removeEventListener('keydown', expectKeyboardFocus);
      window.removeEventListener('pointerdown', expectPointerFocus);
    };
  }, []);

  return (
    <a
      className={className}
      href={href}
      data-keyboard-focus={keyboardFocus ? 'true' : 'false'}
      onBlur={() => setKeyboardFocus(false)}
    >
      Skip to content
    </a>
  );
}
