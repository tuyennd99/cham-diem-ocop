export declare function requireSecret(name: string, value: string | undefined): string;
export declare function env(values: NodeJS.ProcessEnv): {
    port: number;
    jwtSecret: string;
    csrfSecret: string;
    trustProxyHops: number;
    allowedOrigins: string[];
};
