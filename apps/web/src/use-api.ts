import { useEffect, useState } from "react";
import { api, messageOf, type ApiResult } from "./api";

export function useApi<T>(path: string) {
  const [result, setResult] = useState<ApiResult<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path).then((value) => { if (active) setResult(value); })
      .catch((cause) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);

  return { result, error, loading };
}
