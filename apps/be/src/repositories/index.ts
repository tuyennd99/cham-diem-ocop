import { AdminUsersRepository } from './admin-users.repository';
import { AdminCatalogsRepository } from './admin-catalogs.repository';
import { AdminRepository } from './admin.repository';
import { AdminAnalyticsRepository } from './admin/admin-analytics.repository';
import { AdminAssignmentsRepository } from './admin/admin-assignments.repository';
import { AdminProductsRepository } from './admin/admin-products.repository';
import { AdminScoringRepository } from './admin/admin-scoring.repository';
import { AuthRepository } from './auth.repository';
import { EvaluationsRepository } from './evaluations.repository';
import { ProductsRepository } from './products.repository';

export const appRepositories = [
  AdminUsersRepository,
  AdminCatalogsRepository,
  AdminAnalyticsRepository,
  AdminAssignmentsRepository,
  AdminProductsRepository,
  AdminScoringRepository,
  AdminRepository,
  AuthRepository,
  EvaluationsRepository,
  ProductsRepository,
];
