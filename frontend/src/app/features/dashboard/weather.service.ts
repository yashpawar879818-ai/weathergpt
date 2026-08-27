import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ChatResponse,
  WeatherLocation,
  WeatherOverview,
  WeatherPreferences,
} from './weather.types';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  constructor(private http: HttpClient) {}

  getOverview(location: WeatherLocation): Observable<WeatherOverview> {
    return this.http.get<WeatherOverview>(
      `weather/overview/${location.latitude}/${location.longitude}`,
      { params: new HttpParams().set('name', location.name) }
    );
  }

  searchLocations(query: string): Observable<{ results: WeatherLocation[] }> {
    return this.http.get<{ results: WeatherLocation[] }>(
      'weather/locations/search',
      { params: new HttpParams().set('q', query) }
    );
  }

  ask(
    question: string,
    location: WeatherLocation,
    language: string
  ): Observable<ChatResponse> {
    return this.http.post<ChatResponse>('weather/chat', {
      question,
      language,
      latitude: location.latitude,
      longitude: location.longitude,
      location,
    });
  }

  getPreferences(): Observable<WeatherPreferences> {
    return this.http.get<WeatherPreferences>('weather/preferences');
  }

  savePreferences(
    preferences: Partial<WeatherPreferences>
  ): Observable<WeatherPreferences> {
    return this.http.put<WeatherPreferences>(
      'weather/preferences/update',
      preferences
    );
  }
}