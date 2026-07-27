"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashSeedPassword = void 0;
exports.hashPassword = hashPassword;
exports.assertArgon2idHash = assertArgon2idHash;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = require("node:crypto");
const argon2idPrefix = '$argon2id$v=19$m=65536,t=3,p=4$';
const argon2idPattern = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
async function hashPassword(password) {
    const nonce = (0, node_crypto_1.randomBytes)(16);
    const hash = await derive({
        message: password,
        nonce,
        memory: 65_536,
        parallelism: 4,
        passes: 3,
        tagLength: 32,
    });
    return `${argon2idPrefix}${nonce.toString('base64').replace(/=+$/, '')}$${hash.toString('base64').replace(/=+$/, '')}`;
}
function assertArgon2idHash(encoded) {
    parseArgon2idHash(encoded);
}
async function verifyPassword(encoded, password) {
    const { memory, passes, parallelism, nonce, expected } = parseArgon2idHash(encoded);
    const actual = await derive({
        message: password,
        nonce,
        memory,
        parallelism,
        passes,
        tagLength: expected.length,
    });
    return (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
exports.hashSeedPassword = hashPassword;
function derive(parameters) {
    return new Promise((resolve, reject) => {
        (0, node_crypto_1.argon2)('argon2id', parameters, (error, derivedKey) => {
            if (error)
                reject(error);
            else
                resolve(derivedKey);
        });
    });
}
function parseArgon2idHash(encoded) {
    const match = encoded.match(argon2idPattern);
    if (!match) {
        throw new Error('Invalid Argon2id encoded hash.');
    }
    const memory = Number(match[1]);
    const passes = Number(match[2]);
    const parallelism = Number(match[3]);
    const nonce = Buffer.from(match[4], 'base64');
    const expected = Buffer.from(match[5], 'base64');
    if (memory < 8_192 ||
        memory > 1_048_576 ||
        passes < 1 ||
        passes > 10 ||
        parallelism < 1 ||
        parallelism > 16 ||
        nonce.length < 16 ||
        expected.length < 16 ||
        expected.length > 64) {
        throw new Error('Invalid Argon2id encoded hash.');
    }
    return { memory, passes, parallelism, nonce, expected };
}
//# sourceMappingURL=password.js.map