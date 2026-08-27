import type { Routes } from '@angular/router';

import { ForecastGuard } from '@features/forecast/forecast.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/dashboard/dashboard.component').then(
        mod => mod.DashboardComponent
      ),
  },
  {
    path: 'forecast',
    loadComponent: () =>
      import('@features/forecast/forecast.component').then(
        mod => mod.ForecastComponent
      ),
    canActivate: [ForecastGuard],
  },
];