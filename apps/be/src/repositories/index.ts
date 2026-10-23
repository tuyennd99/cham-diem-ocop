import { AdminUsersRepository } from './admin-users.repository';
import { AdminRepository } from './admin.repository';
import { AuthRepository } from './auth.repository';
import { EvaluationsRepository } from './evaluations.repository';
import { ProductsRepository } from './products.repository';

export const appRepositories = [
  AdminUsersRepository,
  AdminRepository,
  AuthRepository,
  EvaluationsRepository,
  ProductsRepository,
];
