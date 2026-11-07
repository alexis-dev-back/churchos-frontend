import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { NotificationCenterComponent } from './layout/notifications/notification-center.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, NotificationCenterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  showApplicationShell = false;
  mobileMenuOpen = false;

  constructor(private router: Router) { this.updateShell(this.router.url); }

  ngOnInit(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => this.updateShell((event as NavigationEnd).urlAfterRedirects));
  }

  private updateShell(url: string): void {
    const path = url.split('?')[0];
    this.showApplicationShell = !['/login', '/login-super-admin', '/register', '/accept-invitation', '/', '/admin'].includes(path);
  }
}
