import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Observable } from "rxjs";


@Injectable()
export class AdminApiKeyGuard implements CanActivate{
    canActivate(context: ExecutionContext): boolean  {
        const req = context.switchToHttp().getRequest()
        const apiKeyHeader = req.headers['x-admin-api-key'] || req.headers['X-Admin-Api-Key']

        const expected = process.env.ADMIN_API_KEY;
        if(!expected) {
            return false
        }
        if(!apiKeyHeader) {
            return false
        }
       if(apiKeyHeader !== expected){
        return false
       }
       req.user = {
        id: 0,
        email:'admin-api-key@local',
        role: Role.ADMIN,

       }

       return true
        }
    }
