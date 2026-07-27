"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const password_1 = require("./password");
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password)
    throw new Error('SEED_ADMIN_PASSWORD is required.');
async function main(value) {
    (0, password_1.assertArgon2idHash)(await (0, password_1.hashSeedPassword)(value));
    console.log('Seed password hash format verified.');
}
void main(password).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=verify-seed-password.js.map