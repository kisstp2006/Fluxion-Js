// @ts-check
/**
 * UI State Preservation Utilities
 * Prevents flickering, scroll resets, and focus loss during editor updates
 */

/**
 * Preserve scroll position across DOM rebuilds
 * @param {HTMLElement|null} container
 * @param {() => void} rebuildFn
 */
export function preserveScrollDuring(container, rebuildFn) {
  if (!container) {
    rebuildFn();
    return;
  }

  const savedScrollTop = container.scrollTop;
  const savedScrollLeft = container.scrollLeft;

  rebuildFn();

  // Restore scroll after DOM settles
  requestAnimationFrame(() => {
    if (savedScrollTop > 0) container.scrollTop = savedScrollTop;
    if (savedScrollLeft > 0) container.scrollLeft = savedScrollLeft;
  });
}

/**
 * Preserve focus across DOM rebuilds
 * @param {() => void} rebuildFn
 */
export function preserveFocusDuring(rebuildFn) {
  const activeEl = document.activeElement;
  const tag = activeEl instanceof HTMLElement ? activeEl.tagName.toLowerCase() : '';
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
  
  // Don't preserve if not in an editable field
  if (!isInput) {
    rebuildFn();
    return;
  }

  // Store focus context
  const id = activeEl instanceof HTMLElement ? activeEl.id : '';
  const name = activeEl instanceof HTMLElement ? activeEl.getAttribute('name') : '';
  const selStart = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement 
    ? activeEl.selectionStart 
    : null;
  const selEnd = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement 
    ? activeEl.selectionEnd 
    : null;

  rebuildFn();

  // Attempt to restore focus
  requestAnimationFrame(() => {
    try {
      let target = null;
      if (id) target = document.getElementById(id);
      if (!target && name) target = document.querySelector(`[name="${name}"]`);
      
      if (target instanceof HTMLElement) {
        target.focus();
        if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) 
            && selStart !== null && selEnd !== null) {
          target.setSelectionRange(selStart, selEnd);
        }
      }
    } catch (e) {
      // Focus restoration failed - acceptable fallback
    }
  });
}

/**
 * Preserve both scroll and focus during rebuild
 * @param {HTMLElement|null} container
 * @param {() => void} rebuildFn
 */
export function preserveUiStateDuring(container, rebuildFn) {
  const activeEl = document.activeElement;
  const tag = activeEl instanceof HTMLElement ? activeEl.tagName.toLowerCase() : '';
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
  
  // Scroll state
  const savedScrollTop = container?.scrollTop || 0;
  const savedScrollLeft = container?.scrollLeft || 0;
  
  // Focus state (only if in editable field)
  let focusId = '';
  let focusName = '';
  let selStart = null;
  let selEnd = null;
  
  if (isInput && activeEl instanceof HTMLElement) {
    focusId = activeEl.id || '';
    focusName = activeEl.getAttribute('name') || '';
    if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    }
  }

  // Execute rebuild
  rebuildFn();

  // Restore state after DOM settles
  requestAnimationFrame(() => {
    // Restore scroll
    if (container) {
      if (savedScrollTop > 0) container.scrollTop = savedScrollTop;
      if (savedScrollLeft > 0) container.scrollLeft = savedScrollLeft;
    }
    
    // Restore focus
    if (isInput) {
      try {
        let target = null;
        if (focusId) target = document.getElementById(focusId);
        if (!target && focusName) target = document.querySelector(`[name="${focusName}"]`);
        
        if (target instanceof HTMLElement) {
          target.focus();
          if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) 
              && selStart !== null && selEnd !== null) {
            target.setSelectionRange(selStart, selEnd);
          }
        }
      } catch (e) {
        // Focus restoration failed - acceptable
      }
    }
  });
}

/**
 * Debounce rebuild requests to prevent rapid flickering
 * @param {() => void} rebuildFn
 * @param {number} delayMs
 * @returns {() => void}
 */
export function debounceRebuild(rebuildFn, delayMs = 16) {
  /** @type {any} */
  let timerId = null;
  return () => {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      rebuildFn();
      timerId = null;
    }, delayMs);
  };
}
