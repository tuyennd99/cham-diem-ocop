import { useCallback, useEffect, useState } from "react";
import { api, messageOf } from "./api";
import type { ApiResult } from "../types/api";

export function useApi<T>(path: string) {
  const [result, setResult] = useState<ApiResult<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path).then((value) => { if (active) setResult(value); })
      .catch((cause) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);

  return { result, error, loading, reload };
}
