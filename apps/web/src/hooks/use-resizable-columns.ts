import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';

export type ResizableColumnSide = 'left' | 'right';

export interface ColumnBounds {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

export interface ResizableColumnWidths {
  left: number;
  right: number;
}

export interface UseResizableColumnsOptions {
  storageKey: string;
  containerRef: RefObject<HTMLElement | null>;
  columns: Record<ResizableColumnSide, ColumnBounds>;
  centerMinWidth: number;
  handleSize?: number;
  keyboardStep?: number;
}

interface StoredColumnWidths {
  v: 1;
  left: number;
  right: number;
}

interface ActiveDragState {
  side: ResizableColumnSide;
  pointerId: number;
  handleEl: HTMLElement;
  startX: number;
  startWidth: number;
  handleCenterOffset: number;
  availableMax: number;
  currentWidth: number;
  currentGhostX: number;
  atLimit: boolean;
  rafId: number | null;
}

const STORAGE_VERSION = 1;
const DEFAULT_HANDLE_SIZE = 16;
const DEFAULT_KEYBOARD_STEP = 16;

export function clampColumnWidth(
  target: number,
  bounds: Pick<ColumnBounds, 'minWidth' | 'maxWidth'>,
  availableMax?: number,
): number {
  const safeTarget = Number.isFinite(target) ? target : bounds.minWidth;
  const upper =
    availableMax !== undefined && Number.isFinite(availableMax)
      ? Math.max(bounds.minWidth, Math.min(bounds.maxWidth, availableMax))
      : bounds.maxWidth;
  return Math.round(Math.min(upper, Math.max(bounds.minWidth, safeTarget)));
}

export function readStoredColumnWidths(
  storageKey: string,
  bounds: Record<ResizableColumnSide, ColumnBounds>,
  storage?: Pick<Storage, 'getItem'> | null,
): ResizableColumnWidths {
  const defaults: ResizableColumnWidths = {
    left: bounds.left.defaultWidth,
    right: bounds.right.defaultWidth,
  };
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStorage) return defaults;

  try {
    const raw = targetStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredColumnWidths>;
    if (parsed?.v !== STORAGE_VERSION) return defaults;
    return {
      left:
        typeof parsed.left === 'number' && Number.isFinite(parsed.left)
          ? clampColumnWidth(parsed.left, bounds.left)
          : defaults.left,
      right:
        typeof parsed.right === 'number' && Number.isFinite(parsed.right)
          ? clampColumnWidth(parsed.right, bounds.right)
          : defaults.right,
    };
  } catch {
    return defaults;
  }
}

export function writeStoredColumnWidths(
  storageKey: string,
  widths: ResizableColumnWidths,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStorage) return;

  try {
    const payload: StoredColumnWidths = {
      v: STORAGE_VERSION,
      left: widths.left,
      right: widths.right,
    };
    targetStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-mode failures.
  }
}

/**
 * Deferred (ghost-line) column resizing inspired by react-resizable-panels.
 * Moves only a GPU-composited guide line during pointer drag (0 React re-renders, 0 layout reflow),
 * then commits the clamped width once on pointer release.
 */
export function useResizableColumns({
  storageKey,
  containerRef,
  columns,
  centerMinWidth,
  handleSize = DEFAULT_HANDLE_SIZE,
  keyboardStep = DEFAULT_KEYBOARD_STEP,
}: UseResizableColumnsOptions) {
  const [widths, setWidths] = useState<ResizableColumnWidths>(() => ({
    left: columns.left.defaultWidth,
    right: columns.right.defaultWidth,
  }));

  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const optionsRef = useRef({ storageKey, columns, centerMinWidth, handleSize, keyboardStep });
  optionsRef.current = { storageKey, columns, centerMinWidth, handleSize, keyboardStep };

  const ghostRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<ActiveDragState | null>(null);

  useEffect(() => {
    const stored = readStoredColumnWidths(storageKey, optionsRef.current.columns);
    setWidths((current) =>
      current.left === stored.left && current.right === stored.right ? current : stored,
    );
  }, [storageKey]);

  const computeAvailableMax = useCallback(
    (side: ResizableColumnSide): number | undefined => {
      const container = containerRef.current;
      if (!container) return undefined;
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth <= 0) return undefined;

      const { centerMinWidth: minCenter, handleSize: hSize } = optionsRef.current;
      const rightHandle = rightHandleRef.current;
      const isThreeColumn = Boolean(
        rightHandle && window.getComputedStyle(rightHandle).display !== 'none',
      );
      if (side === 'left') {
        const otherWidth = isThreeColumn ? widthsRef.current.right : 0;
        const handlesTotal = isThreeColumn ? hSize * 2 : hSize;
        return containerWidth - otherWidth - minCenter - handlesTotal;
      }
      return containerWidth - widthsRef.current.left - minCenter - hSize * 2;
    },
    [containerRef],
  );

  const commitSideWidth = useCallback((side: ResizableColumnSide, nextWidth: number) => {
    const { storageKey: key } = optionsRef.current;
    setWidths((current) => {
      if (current[side] === nextWidth) return current;
      const updated: ResizableColumnWidths = { ...current, [side]: nextWidth };
      widthsRef.current = updated;
      writeStoredColumnWidths(key, updated);
      return updated;
    });
  }, []);

  const stopDrag = useCallback(
    (commit: boolean) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.rafId !== null) {
        window.cancelAnimationFrame(drag.rafId);
      }
      if (drag.handleEl.hasPointerCapture?.(drag.pointerId)) {
        drag.handleEl.releasePointerCapture(drag.pointerId);
      }
      drag.handleEl.removeAttribute('data-dragging');

      const ghost = ghostRef.current;
      if (ghost) {
        ghost.removeAttribute('data-active');
        ghost.removeAttribute('data-at-limit');
      }

      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (commit) {
        commitSideWidth(drag.side, drag.currentWidth);
      }
    },
    [commitSideWidth],
  );

  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && dragRef.current) {
        event.preventDefault();
        stopDrag(false);
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      stopDrag(false);
    };
  }, [stopDrag]);

  const paintGhost = useCallback((ghostX: number, atLimit: boolean) => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.transform = `translate3d(${ghostX}px, 0, 0)`;
    ghost.setAttribute('data-active', 'true');
    if (atLimit) {
      ghost.setAttribute('data-at-limit', 'true');
    } else {
      ghost.removeAttribute('data-at-limit');
    }
  }, []);

  const createHandleProps = useCallback(
    (side: ResizableColumnSide) => {
      const bounds = columns[side];
      const valueNow = widths[side];
      const label =
        side === 'left'
          ? 'Kéo để chỉnh độ rộng cột tiêu chí (nhấp đúp để đặt lại)'
          : 'Kéo để chỉnh độ rộng cột minh chứng (nhấp đúp để đặt lại)';

      return {
        role: 'separator' as const,
        tabIndex: 0,
        'aria-orientation': 'vertical' as const,
        'aria-label': label,
        'aria-valuemin': bounds.minWidth,
        'aria-valuemax': bounds.maxWidth,
        'aria-valuenow': valueNow,
        title: label,
        ref: side === 'right' ? rightHandleRef : undefined,
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          if (event.button !== 0 && event.pointerType === 'mouse') return;
          const container = containerRef.current;
          if (!container) return;

          event.preventDefault();
          const handleEl = event.currentTarget;
          const containerRect = container.getBoundingClientRect();
          const handleRect = handleEl.getBoundingClientRect();
          const handleCenterOffset = handleRect.left - containerRect.left + handleRect.width / 2;
          const availableMax =
            computeAvailableMax(side) ?? optionsRef.current.columns[side].maxWidth;
          const startWidth = clampColumnWidth(
            widthsRef.current[side],
            optionsRef.current.columns[side],
            availableMax,
          );

          handleEl.setPointerCapture?.(event.pointerId);
          handleEl.setAttribute('data-dragging', 'true');
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'col-resize';

          dragRef.current = {
            side,
            pointerId: event.pointerId,
            handleEl,
            startX: event.clientX,
            startWidth,
            handleCenterOffset,
            availableMax,
            currentWidth: startWidth,
            currentGhostX: handleCenterOffset,
            atLimit: false,
            rafId: null,
          };

          paintGhost(handleCenterOffset, false);
        },
        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
          const drag = dragRef.current;
          if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;

          const colBounds = optionsRef.current.columns[side];
          const delta = side === 'left' ? event.clientX - drag.startX : drag.startX - event.clientX;
          const rawTarget = drag.startWidth + delta;
          const clamped = clampColumnWidth(rawTarget, colBounds, drag.availableMax);
          const ghostX =
            side === 'left'
              ? drag.handleCenterOffset + (clamped - drag.startWidth)
              : drag.handleCenterOffset - (clamped - drag.startWidth);
          const atLimit = Math.round(rawTarget) !== clamped;

          drag.currentWidth = clamped;
          drag.currentGhostX = ghostX;
          drag.atLimit = atLimit;

          if (drag.rafId === null) {
            drag.rafId = window.requestAnimationFrame(() => {
              const active = dragRef.current;
              if (!active) return;
              active.rafId = null;
              paintGhost(active.currentGhostX, active.atLimit);
            });
          }
        },
        onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
          const drag = dragRef.current;
          if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;
          stopDrag(true);
        },
        onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
          const drag = dragRef.current;
          if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;
          stopDrag(false);
        },
        onDoubleClick: () => {
          commitSideWidth(side, optionsRef.current.columns[side].defaultWidth);
        },
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          const colBounds = optionsRef.current.columns[side];
          const step = optionsRef.current.keyboardStep;
          const availableMax = computeAvailableMax(side);
          let nextTarget: number | null = null;

          if (event.key === 'ArrowLeft') {
            nextTarget = widthsRef.current[side] + (side === 'left' ? -step : step);
          } else if (event.key === 'ArrowRight') {
            nextTarget = widthsRef.current[side] + (side === 'left' ? step : -step);
          } else if (event.key === 'Home') {
            nextTarget = colBounds.minWidth;
          } else if (event.key === 'End') {
            nextTarget = colBounds.maxWidth;
          }

          if (nextTarget === null) return;
          event.preventDefault();
          commitSideWidth(side, clampColumnWidth(nextTarget, colBounds, availableMax));
        },
      };
    },
    [columns, commitSideWidth, computeAvailableMax, containerRef, paintGhost, stopDrag, widths],
  );

  const containerStyle = {
    '--resizable-left-width': `${widths.left}px`,
    '--resizable-right-width': `${widths.right}px`,
  } as CSSProperties;

  return {
    widths,
    containerStyle,
    ghostRef,
    getHandleProps: createHandleProps,
  };
}
