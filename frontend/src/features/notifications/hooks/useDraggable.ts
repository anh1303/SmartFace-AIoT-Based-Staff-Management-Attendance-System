import { useState, useEffect, useRef, useCallback } from 'react';
import { DraggablePosition } from '../types/notification.types';

const STORAGE_KEY = 'smartface_notification_bubble_pos';
const DRAG_THRESHOLD = 6; // px threshold to distinguish click from drag
const MARGIN = 16; // Margin from viewport edges

interface UseDraggableOptions {
  elementWidth?: number;
  elementHeight?: number;
}

export function useDraggable({
  elementWidth = 56,
  elementHeight = 56,
}: UseDraggableOptions = {}) {
  // Compute default bottom-right position
  const getDefaultPosition = useCallback((): DraggablePosition => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    return {
      x: Math.max(MARGIN, window.innerWidth - elementWidth - MARGIN),
      y: Math.max(MARGIN, window.innerHeight - elementHeight - 90), // Above typical bottom bars
    };
  }, [elementWidth, elementHeight]);

  const [position, setPosition] = useState<DraggablePosition>(() => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          // Validate saved position is within current viewport
          const clampedX = Math.min(Math.max(MARGIN, parsed.x), window.innerWidth - elementWidth - MARGIN);
          const clampedY = Math.min(Math.max(MARGIN, parsed.y), window.innerHeight - elementHeight - MARGIN);
          return { x: clampedX, y: clampedY };
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
    return {
      x: Math.max(MARGIN, window.innerWidth - elementWidth - MARGIN),
      y: Math.max(MARGIN, window.innerHeight - elementHeight - 90),
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  // Refs for tracking during active drag gestures
  const isDraggingRef = useRef(false);
  const startPointerPosRef = useRef({ x: 0, y: 0 });
  const startElemPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const currentPosRef = useRef(position);

  // Keep current position ref updated
  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  // Clamp helper
  const clampPosition = useCallback((pos: DraggablePosition): DraggablePosition => {
    if (typeof window === 'undefined') return pos;
    const maxX = Math.max(MARGIN, window.innerWidth - elementWidth - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - elementHeight - MARGIN);
    return {
      x: Math.min(Math.max(MARGIN, pos.x), maxX),
      y: Math.min(Math.max(MARGIN, pos.y), maxY),
    };
  }, [elementWidth, elementHeight]);

  // Adjust on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const clamped = clampPosition(prev);
        // Snap to nearest edge on resize
        const centerX = clamped.x + elementWidth / 2;
        const snapX = centerX < window.innerWidth / 2 ? MARGIN : window.innerWidth - elementWidth - MARGIN;
        return { x: snapX, y: clamped.y };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, elementWidth]);

  // Pointer Down handler
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to main button (left click or primary touch)
    if (e.button !== 0) return;

    // Prevent default touch scrolling/selection while dragging
    e.preventDefault();

    startPointerPosRef.current = { x: e.clientX, y: e.clientY };
    startElemPosRef.current = { ...currentPosRef.current };
    hasMovedRef.current = false;
    isDraggingRef.current = false;
    setIsSnapping(false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPointerPosRef.current.x;
      const deltaY = moveEvent.clientY - startPointerPosRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (!hasMovedRef.current && distance > DRAG_THRESHOLD) {
        hasMovedRef.current = true;
        isDraggingRef.current = true;
        setIsDragging(true);
      }

      if (hasMovedRef.current) {
        const newX = startElemPosRef.current.x + deltaX;
        const newY = startElemPosRef.current.y + deltaY;

        // Clamp during drag
        const maxX = window.innerWidth - elementWidth;
        const maxY = window.innerHeight - elementHeight;

        const boundedX = Math.min(Math.max(0, newX), maxX);
        const boundedY = Math.min(Math.max(0, newY), maxY);

        setPosition({ x: boundedX, y: boundedY });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (hasMovedRef.current) {
        // Calculate snap-to-edge
        const currentPos = currentPosRef.current;
        const centerX = currentPos.x + elementWidth / 2;
        const targetX = centerX < window.innerWidth / 2 ? MARGIN : window.innerWidth - elementWidth - MARGIN;
        const targetY = Math.min(Math.max(MARGIN, currentPos.y), window.innerHeight - elementHeight - MARGIN);

        setIsSnapping(true);
        setPosition({ x: targetX, y: targetY });

        // Save to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: targetX, y: targetY }));
        } catch {
          // Ignore
        }

        // Reset drag status after short delay to allow snap animation and prevent click trigger
        setTimeout(() => {
          setIsSnapping(false);
          setIsDragging(false);
          isDraggingRef.current = false;
          hasMovedRef.current = false;
        }, 300);
      } else {
        // Was a simple click, reset immediately
        setIsDragging(false);
        isDraggingRef.current = false;
        hasMovedRef.current = false;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [elementWidth, elementHeight]);

  return {
    position,
    isDragging,
    isSnapping,
    handlePointerDown,
    isDraggingRef,
    resetPosition: () => setPosition(getDefaultPosition()),
  };
}
