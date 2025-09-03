// custome base decorator for RBAC
import { SetMetadata } from "@nestjs/common"
// SetMetadata is a function provided by NestJS that allows you to attach custom metadata to route handlers
// Metadata is additional information that can be read later by guards or interceptors

export const ROLE_KEY = 'roles'
export const Roles = (...roles: string[])=> SetMetadata(ROLE_KEY, roles)