import { useCallback, useRef, useState } from 'react';

/**
 * A reusable hook to prevent multiple API calls on rapid button clicks.
 * Provides:
 * - Synchronous ref-based lock (prevents concurrent requests before state updates)
 * - Loading state for UI (disable buttons, show spinner)
 * - Wrapped executor that ensures only one request at a time
 *
 * @example
 * const { withLock, isPending } = useRequestLock();
 *
 * const handleSubmit = async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   if (!validate()) return;
 *   await withLock(async () => {
 *     await createItem(data);
 *     onSuccess();
 *   });
 * };
 *
 * return <button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</button>;
 */
export function useRequestLock() {
  const [isPending, setIsPending] = useState(false);
  const lockRef = useRef(false);

  const withLock = useCallback(<T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) return Promise.resolve(undefined);
    lockRef.current = true;
    setIsPending(true);
    return fn()
      .finally(() => {
        lockRef.current = false;
        setIsPending(false);
      });
  }, []);

  return { withLock, isPending };
}
