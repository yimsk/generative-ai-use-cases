import { useEffect, useState } from 'react';
import * as echarts from 'echarts';

interface UseGeoJSONResult {
  geoJson: unknown | null;
  loading: boolean;
  error: string | null;
}

export function getMapKey(
  region: string,
  detail?: string,
  prefecture?: string
): string {
  if (region === 'world') {
    return 'world';
  }
  if (detail === 'municipality' && prefecture) {
    return `${region}-municipality-${prefecture}`;
  }
  if (detail === 'prefecture') {
    return `${region}-prefecture`;
  }
  return region;
}

export function useGeoJSON(
  region: string | undefined,
  detail?: string,
  prefecture?: string
): UseGeoJSONResult {
  const [geoJson, setGeoJson] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!region) {
      setGeoJson(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadGeoJSON = async () => {
      setLoading(true);
      setError(null);

      try {
        let url: string;

        if (detail === 'municipality' && prefecture) {
          url = `/geojson/prefectures/${prefecture}.geojson`;
        } else if (region === 'world') {
          url = '/geojson/world-countries.geojson';
        } else {
          url = '/geojson/japan-prefectures.geojson';
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to load GeoJSON: ${response.status}`);
        }

        const data = await response.json();

        if (cancelled) {
          return;
        }

        const mapKey = getMapKey(region, detail, prefecture);
        echarts.registerMap(mapKey, data);
        setGeoJson(data);
      } catch (error) {
        if (!cancelled) {
          setGeoJson(null);
          setError(error instanceof Error ? error.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadGeoJSON();

    return () => {
      cancelled = true;
    };
  }, [detail, prefecture, region]);

  return { geoJson, loading, error };
}
