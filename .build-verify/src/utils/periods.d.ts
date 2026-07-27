export type PeriodFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
export declare function buildPeriod(frequency: PeriodFrequency, anchor: Date): {
    periodStartAt: Date;
    dueAt: Date;
    year: number;
    sequence: number;
};
