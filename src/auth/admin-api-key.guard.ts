// src/auth/admin-api-key.guard.ts

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
    constructor(private configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        
        let apiKeyHeader = 
            this.extractKeyFromAuthorization(req.headers['authorization']);
                if (!apiKeyHeader) {
            apiKeyHeader = 
                req.headers['x-admin-api-key'] || 
                req.headers['X-Admin-Api-Key'] ||
                req.headers['x-admin-key'] ||
                req.headers['X-Admin-Key'];
        }

        const expectedApiKey = this.configService.get<string>('ADMIN_API_KEY');
        

        if (!expectedApiKey) {
            console.error('ADMIN_API_KEY is not configured in environment variables');
            throw new ForbiddenException('Admin API configuration error');
        }

        // Check if API key is provided
        if (!apiKeyHeader) {
            throw new UnauthorizedException('Missing admin API key');
        }

        // Validate API key
        if (apiKeyHeader !== expectedApiKey) {
            throw new UnauthorizedException('Invalid admin API key');
        }

    
        req.user = {
            id: 11, 
            email: 'shegadmin@gmail.com', 
            role: Role.ADMIN,
            isAdmin: true,
        };

        return true;
    }


    private extractKeyFromAuthorization(authHeader: string | undefined): string | null {
        if (!authHeader || typeof authHeader !== 'string') {
            return null;
        }

        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'api-key') {
            return parts[1];
        }
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            return parts[1];
        }

        return null;
    }
}