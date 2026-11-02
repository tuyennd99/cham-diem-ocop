export type FormDateRangeValue = { fromDay: string; toDay: string };

export function numberInputValue(raw: string, valueAsNumber: number): number | undefined {
  return raw !== '' && Number.isFinite(valueAsNumber) ? valueAsNumber : undefined;
}
