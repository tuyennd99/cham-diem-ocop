import { AdminUsersService } from './admin-users.service';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { EvaluationsService } from './evaluations.service';
import { HealthService } from './health.service';
import { ProductsService } from './products.service';

export const appServices = [
  AdminUsersService,
  AdminService,
  AuthService,
  EvaluationsService,
  HealthService,
  ProductsService,
];
