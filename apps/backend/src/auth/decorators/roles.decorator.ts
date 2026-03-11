import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles.enum';

export const ROLES_KEY = 'roles';
// Permite passar um ou mais cargos: @Roles(Role.DRT)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);