import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AttendanceWeeklyReport } from '../models/attendance';
import { ChurchEvent } from '../models/event';
import { EcodimDashboard } from '../models/ecodim';
import { FinanceSummary } from '../models/finance';
import { Family } from '../models/family';
import { Member } from '../models/member';
import { ChurchStructure } from '../models/ministry-tribe';
import { Person } from '../models/person';
import { Campus, Church } from '../models/tenant';
import { AttendanceService } from './attendance.service';
import { EcodimService } from './ecodim.service';
import { EventService } from './event.service';
import { FinanceService } from './finance.service';
import { FamilyService } from './family.service';
import { MemberService } from './member.service';
import { MinistryTribeService } from './ministry-tribe.service';
import { PastoralDashboard, PastoralService } from './pastoral.service';
import { PersonService } from './person.service';
import { TenantService } from './tenant.service';

export interface DashboardOverview {
  members: Member[];
  families: Family[];
  people: Person[];
  churches: Church[];
  campuses: Campus[];
  events: ChurchEvent[] | null;
  attendance: AttendanceWeeklyReport | null;
  finance: FinanceSummary[] | null;
  pastoral: PastoralDashboard | null;
  ecodim: EcodimDashboard[] | null;
  ministries: ChurchStructure[] | null;
  tribes: ChurchStructure[] | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(
    private members: MemberService,
    private families: FamilyService,
    private people: PersonService,
    private tenant: TenantService,
    private events: EventService,
    private attendance: AttendanceService,
    private finance: FinanceService,
    private pastoral: PastoralService,
    private ecodim: EcodimService,
    private structures: MinistryTribeService,
  ) {}

  getOverview(): Observable<DashboardOverview> {
    return forkJoin({
      members: this.withEmptyOnNotFound(this.members.getMembers()),
      families: this.withEmptyOnNotFound(this.families.listFamilies()),
      people: this.withEmptyOnNotFound(this.people.listPersons()),
      churches: this.withEmptyOnNotFound(this.tenant.listChurches()),
      campuses: this.withEmptyOnNotFound(this.tenant.listCampuses()),
    }).pipe(
      switchMap((overview) => {
        return forkJoin({
          events: this.optional(this.events.list()),
          attendance: this.optional(this.attendance.report(...this.currentWeek())),
          finance: this.loadFinance(),
          pastoral: this.optional(this.pastoral.dashboard()),
          ecodim: this.loadEcodim(),
          ministries: this.loadStructures('ministries', overview.churches),
          tribes: this.loadStructures('tribes', overview.churches),
        }).pipe(map((modules) => ({ ...overview, ...modules })));
      }),
    );
  }

  private loadFinance(): Observable<FinanceSummary[] | null> {
    return this.finance.getContext().pipe(
      switchMap((context) => {
        if (!context.churches.length) return of([]);
        return forkJoin(
          context.churches.map((church) => this.optional(this.finance.getSummary(church.church_id))),
        ).pipe(
          map((summaries) => {
            const available = summaries.filter((summary): summary is FinanceSummary => summary !== null);
            return available.length ? available : null;
          }),
        );
      }),
      catchError(() => of(null)),
    );
  }

  private loadEcodim(): Observable<EcodimDashboard[] | null> {
    return this.ecodim.getContext().pipe(
      switchMap((context) => {
        if (!context.churches.length) return of([]);
        return forkJoin(
          context.churches.map((church) => this.optional(this.ecodim.getDashboard(church.church_id))),
        ).pipe(
          map((dashboards) => dashboards.some((dashboard) => dashboard === null)
            ? null
            : dashboards.filter((dashboard): dashboard is EcodimDashboard => dashboard !== null)),
        );
      }),
      catchError(() => of(null)),
    );
  }

  private loadStructures(kind: 'ministries' | 'tribes', churches: Church[]): Observable<ChurchStructure[] | null> {
    if (!churches.length) return of([]);
    return forkJoin(
      churches.map((church) => this.optional(this.structures.list(kind, church.church_id))),
    ).pipe(
      map((structures) => structures.some((items) => items === null)
        ? null
        : structures.flatMap((items) => items ?? [])),
    );
  }

  private optional<T>(request: Observable<T>): Observable<T | null> {
    return request.pipe(catchError(() => of(null)));
  }

  private currentWeek(): [string, string] {
    const today = new Date();
    const daysSinceMonday = (today.getDay() + 6) % 7;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return [this.toDate(start), this.toDate(end)];
  }

  private toDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private withEmptyOnNotFound<T>(request: Observable<T[]>): Observable<T[]> {
    return request.pipe(catchError((error: unknown) => error instanceof HttpErrorResponse && error.status === 404 ? of([]) : throwError(() => error)));
  }
}