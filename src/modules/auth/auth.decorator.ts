import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth.type';
import { AuthenticatedRequest } from './auth.type';

export const Auth = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authUser: AuthUser = request.user;
    return authUser;
});
