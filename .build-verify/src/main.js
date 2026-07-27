"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_1 = require("./config/app");
const env_1 = require("./config/env");
async function bootstrap() {
    const config = (0, env_1.env)(process.env);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    (0, app_1.configureApp)(app);
    app.enableShutdownHooks();
    await app.listen(config.port);
}
void bootstrap();
//# sourceMappingURL=main.js.map