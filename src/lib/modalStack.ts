/**
 * Global modal stack for Android back-button handling.
 *
 * When a Dialog or AlertDialog opens, it pushes a close callback here.
 * The back-button handler in App.tsx calls closeTopModal() first so the
 * hardware back key closes the topmost modal before navigating away.
 */

interface ModalEntry {
  id: number;
  close: () => void;
}

let _counter = 0;
const _stack: ModalEntry[] = [];

/** Push a close callback and return the entry id for later removal. */
export const pushModal = (close: () => void): number => {
  const id = ++_counter;
  _stack.push({ id, close });
  return id;
};

/** Remove a modal entry by id (called when modal closes normally). */
export const removeModal = (id: number): void => {
  const idx = _stack.findIndex((m) => m.id === id);
  if (idx !== -1) _stack.splice(idx, 1);
};

/**
 * Close the topmost open modal.
 * Returns true if a modal was found and closed, false if stack was empty.
 */
export const closeTopModal = (): boolean => {
  if (_stack.length === 0) return false;
  const top = _stack[_stack.length - 1];
  _stack.pop();
  top.close();
  return true;
};

export const hasOpenModal = (): boolean => _stack.length > 0;
