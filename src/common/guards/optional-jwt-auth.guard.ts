import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but treats a missing token as a guest (req.user = null).
 * If a token IS present but invalid/expired it still throws 401 so the client
 * knows it needs to refresh rather than silently acting like an unauthenticated user.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err) throw err;

    // No Authorization header at all → treat as unauthenticated guest
    if (!user && info?.message === 'No auth token') return null;

    // Token was provided but is expired or has an invalid signature → force re-login / refresh
    if (!user && info) throw new UnauthorizedException(info.message || 'Unauthorized');

    return user || null;
  }
}
