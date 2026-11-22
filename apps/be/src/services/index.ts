import { AdminUsersService } from './admin-users.service';
import { AdminCatalogsService } from './admin-catalogs.service';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { EvaluationsService } from './evaluations.service';
import { HealthService } from './health.service';
import { PrintDataService } from './print-data.service';
import { ProductsService } from './products.service';

// RedisService is registered globally via RedisModule (src/modules/index.ts)
// so ThrottlerModule and application services share one singleton instance.
export { RedisService } from './redis.service';

export const appServices = [
  AdminUsersService,
  AdminCatalogsService,
  AdminService,
  AuthService,
  EvaluationsService,
  HealthService,
  PrintDataService,
  ProductsService,
];
