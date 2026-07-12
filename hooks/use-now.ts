import { useEffect, useState } from "react";

// Rendered only after mount (starts null) to avoid a server/client
// hydration mismatch on the ever-changing time.
export function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
