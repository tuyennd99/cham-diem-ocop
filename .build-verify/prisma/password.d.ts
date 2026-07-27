export declare function hashPassword(password: string): Promise<string>;
export declare function assertArgon2idHash(encoded: string): void;
export declare function verifyPassword(encoded: string, password: string): Promise<boolean>;
export declare const hashSeedPassword: typeof hashPassword;
