import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { EventService } from '../services/event.service';
import { ConfigurationService } from '../services/configuration.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const configuration = inject(ConfigurationService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return auth.me().pipe(
    switchMap((user) => {
      const isPersonalSpace = ['profile', 'tasks'].includes(route.routeConfig?.path ?? '');
      if (user.is_superuser) return of(route.routeConfig?.path === 'admin' ? true : router.createUrlTree(['/admin']));
      if (user.active_organization) {
        const activeRole = user.organizations.find((organization) => organization.tenant_id === user.active_organization?.tenant_id)?.role;
        if (activeRole === 'owner' || activeRole === 'admin' || isPersonalSpace) return of(true);
        return configuration.getAccess().pipe(
          map((access) => access.permission_codes.length > 0 ? true : router.createUrlTree(['/profile'])),
        );
      }
      const organizations = user.organizations ?? [];
      if (organizations.length === 1) {
        const role = organizations[0].role;
        return auth.selectOrganization({ tenant_id: organizations[0].tenant_id }).pipe(
          switchMap(() => role === 'owner' || role === 'admin' || isPersonalSpace
            ? of(true)
            : configuration.getAccess().pipe(
              map((access) => access.permission_codes.length > 0 ? true : router.createUrlTree(['/profile'])),
            )),
        );
      }
      if (organizations.length > 1) return of(router.createUrlTree(['/login'], { queryParams: { chooseOrganization: '1' } }));
      return of(router.createUrlTree(['/login']));
    }),
    catchError(() => of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))),
  );
};

export const moduleAccessGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const configuration = inject(ConfigurationService);
  const router = inject(Router);
  const moduleCode = route.data['permissionModule'] as string | undefined;
  const permissionCodes = route.data['permissionCodes'] as string[] | undefined;

  if (!moduleCode && !permissionCodes?.length) {
    return router.createUrlTree(['/dashboard']);
  }
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return auth.me().pipe(
    switchMap((user) => {
      if (user.is_superuser) return of(router.createUrlTree(['/admin']));
      const activeOrganization = user.active_organization?.tenant_id;
      const membership = user.organizations.find((item) => item.tenant_id === activeOrganization);
      if (membership?.role === 'owner' || membership?.role === 'admin') return of(true);

      const organizations = user.organizations ?? [];
      if (!activeOrganization && organizations.length !== 1) {
        return of(router.createUrlTree(['/login'], {
          queryParams: organizations.length > 1
            ? { chooseOrganization: '1', returnUrl: state.url }
            : { returnUrl: state.url },
        }));
      }
      const checkAccess = () => configuration.getAccess().pipe(
        map((access) => {
          const allowed = permissionCodes?.length
            ? permissionCodes.some((code) => access.permission_codes.includes(code))
            : access.permission_codes.some((code) => code.startsWith(`${moduleCode}.`));
          return allowed ? true : router.createUrlTree([firstAllowedModule(access.permission_codes)]);
        }),
      );
      return activeOrganization
        ? checkAccess()
        : auth.selectOrganization({ tenant_id: organizations[0].tenant_id }).pipe(
          switchMap(() => checkAccess()),
        );
    }),
    catchError(() => of(router.createUrlTree(['/profile']))),
  );
};

export const organizationAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const configuration = inject(ConfigurationService);
  const router = inject(Router);
  return auth.me().pipe(
    switchMap((user) => {
      if (user.is_superuser) return of(router.createUrlTree(['/admin']));
      const activeTenantId = user.active_organization?.tenant_id;
      const role = user.organizations.find((item) => item.tenant_id === activeTenantId)?.role;
      if (role === 'owner' || role === 'admin') return of(true);
      return configuration.getAccess().pipe(
        map((access) => router.createUrlTree([firstAllowedModule(access.permission_codes)])),
      );
    }),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

function firstAllowedModule(permissionCodes: string[]): string {
  const modules: ReadonlyArray<readonly [string, string]> = [
    ['finance.', '/finance'],
    ['ecodim.', '/ecodim'],
    ['attendance.', '/attendance'],
    ['pastoral.', '/pastoral'],
    ['events.', '/events'],
    ['members.', '/members'],
    ['people.', '/people'],
    ['families.', '/families'],
    ['ministries.', '/ministries'],
  ];
  return modules.find(([prefix]) => permissionCodes.some((code) => code.startsWith(prefix)))?.[1] ?? '/tasks';
}

export const tenantAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((user) => {
      if (user.is_superuser) return router.createUrlTree(['/admin']);
      const organizations = user.organizations ?? [];
      const activeTenantId = user.active_organization?.tenant_id;
      const role = organizations.find((organization) => organization.tenant_id === activeTenantId)?.role;
      return role === 'owner' || role === 'admin' ? true : router.createUrlTree(['/dashboard']);
    }),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const eventAdminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const events = inject(EventService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  return auth.me().pipe(
    switchMap((user) => {
      if (user.is_superuser) return of(router.createUrlTree(['/admin']));
      const activeTenantId = user.active_organization?.tenant_id;
      const activeOrganization = user.organizations.find((item) => item.tenant_id === activeTenantId);
      if (activeOrganization) {
        return events.managerAccess().pipe(
          map((access) => access.can_manage ? true : router.createUrlTree(['/dashboard'])),
        );
      }
      const organizations = user.organizations ?? [];
      if (organizations.length !== 1) {
        return of(router.createUrlTree(['/login'], {
          queryParams: organizations.length > 1 ? { chooseOrganization: '1', returnUrl: state.url } : { returnUrl: state.url },
        }));
      }
      return auth.selectOrganization({ tenant_id: organizations[0].tenant_id }).pipe(
        switchMap(() => events.managerAccess()),
        map((access) => access.can_manage ? true : router.createUrlTree(['/dashboard'])),
      );
    }),
    catchError(() => of(router.createUrlTree(['/dashboard']))),
  );
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((user) => user.is_superuser ? true : router.createUrlTree(['/dashboard'])),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const eventMemberGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return auth.me().pipe(
    switchMap((user) => {
      if (user.is_superuser) return of(router.createUrlTree(['/admin']));
      if (user.active_organization) return of(true);
      const organizations = user.organizations ?? [];
      if (organizations.length === 1) {
        return auth.selectOrganization({ tenant_id: organizations[0].tenant_id }).pipe(map(() => true));
      }
      if (organizations.length > 1) return of(router.createUrlTree(['/login'], { queryParams: { chooseOrganization: '1' } }));
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    }),
    catchError(() => of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))),
  );
};