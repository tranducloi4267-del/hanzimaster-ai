import React, { useEffect, useRef, useState } from 'react';
import { useDisplayStore } from '@/stores/useDisplayStore';

export type CrutchKind = 'pinyin' | 'meaning' | 'hanviet';

interface PeekableTextProps {
  kind: CrutchKind;
  children: React.ReactNode;
  className?: string;
  forceHide?: boolean;
  inline?: boolean;
  peekDurationMs?: number;
}

/**
 * Component lõi cho cơ chế Anti-Crutch + Tap-to-Peek 3 giây.
 * Khi nội dung bị ẩn theo thanh công cụ toàn cục, chạm trực tiếp sẽ hiện tạm 3 giây rồi tự ẩn lại.
 */
export const PeekableText: React.FC<PeekableTextProps> = ({
  kind,
  children,
  className = '',
  forceHide = false,
  inline = false,
  peekDurationMs = 3000
}) => {
  const showPinyin = useDisplayStore((s) => s.showPinyin);
  const showMeaning = useDisplayStore((s) => s.showMeaning);
  const showHanViet = useDisplayStore((s) => s.showHanViet);

  const isVisibleBySetting =
    kind === 'pinyin' ? showPinyin : kind === 'meaning' ? showMeaning : showHanViet;
  const shouldHide = forceHide || !isVisibleBySetting;

  const [peeking, setPeeking] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldHide && peeking) {
      setPeeking(false);
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [shouldHide, peeking]);

  const handlePeek = (e: React.MouseEvent) => {
    if (!shouldHide) return;
    e.stopPropagation();
    setPeeking(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setPeeking(false);
      timerRef.current = null;
    }, peekDurationMs);
  };

  const Tag = inline ? 'span' : 'div';
  const hiddenClass = shouldHide
    ? peeking
      ? 'crutch-peeking rounded px-1 bg-amber-100/70 dark:bg-amber-900/30 ring-1 ring-amber-400/50'
      : 'crutch-hidden rounded px-1 bg-slate-200/70 dark:bg-slate-800/80'
    : '';

  return (
    <Tag
      onClick={handlePeek}
      title={shouldHide && !peeking ? 'Chạm để xem tạm 3 giây (Tap-to-Peek)' : undefined}
      className={`${inline ? 'inline-block' : 'block'} ${hiddenClass} ${className}`}
    >
      {children}
    </Tag>
  );
};
