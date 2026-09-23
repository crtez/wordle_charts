interface ChartDataPoint {
  id: string;
  date: string;
  word: string;
  average: number;
  hardAverage: number;
  percentSolved: number;
  percentSolvedHard: number;
  percentThreeOrFewer: number;
  percentThreeOrFewerHard: number;
  efficiency: number;
  efficiencyHard: number;
  personalDifference?: number | null;
}

let summariesPromise: Promise<ChartDataPoint[]> | null = null;

export async function processWordleData(): Promise<ChartDataPoint[]> {
  // Single prebuilt file written by scripts/build-summaries.mjs, fetched instead of
  // inlined so the entry bundle doesn't carry ~1200 puzzle summaries.
  // Cached so the request is shared no matter who asks first.
  if (!summariesPromise) {
    summariesPromise = fetch(`${import.meta.env.BASE_URL}wordle-summaries.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load wordle summaries: ${response.status} ${response.statusText}`);
        }
        // Already trimmed to these fields and sorted by date at build time.
        return response.json() as Promise<ChartDataPoint[]>;
      })
      .catch((err) => {
        summariesPromise = null; // let a later mount retry
        throw err;
      });
  }

  return summariesPromise;
}

// Optional: Create a custom hook for using this data
import { useState, useEffect } from 'react';

export const useWordleData = () => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    processWordleData()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}