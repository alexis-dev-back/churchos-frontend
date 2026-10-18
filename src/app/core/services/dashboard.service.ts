import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Family } from '../models/family';
import { Member } from '../models/member';
import { Person } from '../models/person';
import { Campus, Church } from '../models/tenant';
import { FamilyService } from './family.service';
import { MemberService } from './member.service';
import { PersonService } from './person.service';
import { TenantService } from './tenant.service';

export interface DashboardOverview {
  members: Member[];
  families: Family[];
  people: Person[];
  churches: Church[];
  campuses: Campus[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private members: MemberService, private families: FamilyService, private people: PersonService, private tenant: TenantService) {}

  getOverview(): Observable<DashboardOverview> {
    return forkJoin({
      members: this.withEmptyOnNotFound(this.members.getMembers()),
      families: this.withEmptyOnNotFound(this.families.listFamilies()),
      people: this.withEmptyOnNotFound(this.people.listPersons()),
      churches: this.withEmptyOnNotFound(this.tenant.listChurches()),
      campuses: this.withEmptyOnNotFound(this.tenant.listCampuses()),
    });
  }

  private withEmptyOnNotFound<T>(request: Observable<T[]>): Observable<T[]> {
    return request.pipe(catchError((error: unknown) => error instanceof HttpErrorResponse && error.status === 404 ? of([]) : throwError(() => error)));
  }
}