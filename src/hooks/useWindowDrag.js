import { useState, useEffect, useRef } from "react";

export const useWindowDrag = () => {
  const [isDragging, setIsDragging] = useState(false);
  // True only after the cursor moved past the consumer's drag threshold and
  // the main process actually started moving the window. A plain click must
  // never enter the drag lifecycle: calling startWindowDrag() on mousedown
  // makes the main process setPosition() the window while the button is
  // held, which makes Chromium drop the subsequent click (and unmounts
  // hover-only controls). That used to swallow the stop/cancel tap on the
  // dictation overlay entirely.
  const dragStartedRef = useRef(false);

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      // Left mouse button — arm the drag but do NOT start it yet. The drag
      // only begins once the consumer sees the cursor move past its
      // threshold (activateDrag), so stationary clicks still produce a click.
      setIsDragging(true);
      dragStartedRef.current = false;
      e.preventDefault();
    }
  };

  // Call once the cursor moved past the drag threshold.
  const activateDrag = () => {
    if (isDragging && !dragStartedRef.current) {
      dragStartedRef.current = true;
      window.electronAPI.startWindowDrag?.();
    }
  };

  const handleMouseUp = () => {
    if (dragStartedRef.current) {
      window.electronAPI.stopWindowDrag?.();
    }
    dragStartedRef.current = false;
    setIsDragging(false);
  };

  // Set up global mouse up listener while the button is held, so releasing
  // outside the window still ends the drag lifecycle.
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        handleMouseUp();
      };

      document.addEventListener("mouseup", handleGlobalMouseUp);

      return () => {
        document.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  return {
    isDragging,
    handleMouseDown,
    activateDrag,
    handleMouseUp,
  };
};
