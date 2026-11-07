import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InvitingMember, Person, PersonCreateRequest, PersonMembershipRequest } from '../models/person';

@Injectable({ providedIn: 'root' })
export class PersonService {
  private readonly apiUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) {}

  listPersons(): Observable<Person[]> {
    return this.http.get<Person[]>(`${this.apiUrl}/people/`);
  }

  listInviterMembers(): Observable<InvitingMember[]> {
    return this.http.get<InvitingMember[]>(`${this.apiUrl}/people/inviter-members/`);
  }

  createPerson(payload: PersonCreateRequest): Observable<Person | { detail: string; duplicates: Person[] }> {
    return this.http.post<Person | { detail: string; duplicates: Person[] }>(`${this.apiUrl}/people/`, payload);
  }

  getPerson(id: string): Observable<Person> {
    return this.http.get<Person>(`${this.apiUrl}/people/${id}/`);
  }

  updatePerson(id: string, payload: Partial<PersonCreateRequest>): Observable<Person> {
    return this.http.patch<Person>(`${this.apiUrl}/people/${id}/`, payload);
  }

  convertToMember(id: string, payload: PersonMembershipRequest): Observable<{ detail: string; member_id: string; person_id: string; user_id: string; invitation_token: string }> {
    return this.http.post<{ detail: string; member_id: string; person_id: string; user_id: string; invitation_token: string }>(`${this.apiUrl}/persons/${id}/create-membership/`, payload);
  }
}
