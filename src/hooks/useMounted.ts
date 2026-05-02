import { useEffect, useState } from 'react';

/** True after the first commit (handy for client-only UI). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
