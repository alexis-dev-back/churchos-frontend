import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardOverview, DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  overview: DashboardOverview | null = null;
  loading = true;
  errorMessage = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getOverview().subscribe({
      next: (overview) => { this.overview = overview; this.loading = false; },
      error: (error) => { this.errorMessage = error.error?.detail ?? 'Impossible de charger les données du tenant. Vérifiez votre connexion et l’organisation active.'; this.loading = false; },
    });
  }
}