import { useEffect, useState } from "react";
import type { BibleData } from "../types";

export function useBible() {
  const [bible, setBible] = useState<BibleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/nkjv.json", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Bible file unavailable");
        return response.json() as Promise<BibleData>;
      })
      .then(data => setBible(data))
      .catch(fetchError => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("The Bible text could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  return { bible, error };
}
