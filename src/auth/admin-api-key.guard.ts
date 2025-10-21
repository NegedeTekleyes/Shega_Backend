import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
    constructor(private configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        
        // Case-insensitive header check
        const apiKeyHeader = req.headers['x-admin-api-key'] || 
                            req.headers['X-Admin-Api-Key'] ||
                            req.headers['x-admin-key'] ||
                            req.headers['X-Admin-Key'];

        const expectedApiKey = this.configService.get<string>('ADMIN_API_KEY');
        
        // Check if API key is configured
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

        // Set admin user in request
        req.user = {
            id: 0, // or generate a unique admin ID
            email: 'admin@system.com',
            role: Role.ADMIN,
            isAdmin: true, // additional flag for easy checking
        };

        return true;
    }
}