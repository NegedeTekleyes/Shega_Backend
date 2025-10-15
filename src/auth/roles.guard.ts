import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLE_KEY } from "./roles.decorator";


@Injectable()
export class RolesGuard implements CanActivate{
    constructor(private reflector: Reflector){}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            ROLE_KEY,
            [context.getHandler(), context.getClass()],
        )

        if(!requiredRoles) {
            return true // no role restriction
        }

        const {user} = context.switchToHttp().getRequest()
        return requiredRoles.some((role) => user.role === role)

        // if(!user || !requiredRoles.includes(user.role)) {
        //     throw new ForbiddenException('You do not have acces to this resource')
        // }
        // return true
    }

}