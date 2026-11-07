import { useRef, useState } from 'react';

/**
 * Wraps an async action (a save, a toggle, a delete) so it can't run twice at
 * once: a double-click on "Record" would otherwise create two ledger entries.
 * Calls made while it's running are ignored. `busy` is true meanwhile, for
 * disabling the button that started it. The action handles its own errors.
 */
export function useAction(action) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = async (...args) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action(...args);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return [run, busy];
}
