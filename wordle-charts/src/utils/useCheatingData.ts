import { useState, useEffect } from 'react';
import { CheatingAnalysisData } from '@/types/wordle_types';

export const useCheatingData = () => {
  const [data, setData] = useState<{
    normal: CheatingAnalysisData[];
    hard: CheatingAnalysisData[];
  }>({ normal: [], hard: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Imported dynamically so these two ~290KB files land in their own chunk
    // rather than blocking first paint from the entry bundle.
    Promise.all([
      import('../data/cheating_analysis_normal.json'),
      import('../data/cheating_analysis_hard.json'),
    ])
      .then(([normalData, hardData]) => {
        if (cancelled) return;
        setData({
          normal: normalData.default as CheatingAnalysisData[],
          hard: hardData.default as CheatingAnalysisData[],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading cheating data:', err);
        setError(err instanceof Error ? err : new Error('Failed to load cheating analysis data'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
};
