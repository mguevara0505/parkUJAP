import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

/**
 * Decorador para obtener el usuario autenticado del request.
 * Uso: @CurrentUser() user: User
 * Uso: @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const { user } = ctx.switchToHttp().getRequest<{ user?: User }>();

    if (!user) return null;
    return data ? user[data] : user;
  },
);
