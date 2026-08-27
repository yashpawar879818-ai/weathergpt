import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WeatherService } from './weather.service';
import {
  ChatResponse,
  DailyWeather,
  WeatherLocation,
  WeatherOverview,
  WeatherPreferences,
} from './weather.types';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor, NgClass],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <header class="border-b border-white/10 bg-slate-950/95 px-4 py-4 sm:px-8">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <button type="button" class="flex items-center gap-3 text-left" (click)="activeView = 'overview'">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-sky-400 text-xl shadow-lg shadow-sky-400/20">✦</span>
            <span><span class="block text-lg font-semibold tracking-tight">WeatherGPT</span><span class="block text-xs text-slate-400">Forecasts with context</span></span>
          </button>
          <nav class="flex items-center gap-1 rounded-xl bg-white/5 p-1 text-sm">
            <button type="button" (click)="activeView = 'overview'" [ngClass]="activeView === 'overview' ? 'bg-white text-slate-950' : 'text-slate-300'" class="rounded-lg px-3 py-2 transition">Overview</button>
            <button type="button" (click)="activeView = 'chat'" [ngClass]="activeView === 'chat' ? 'bg-white text-slate-950' : 'text-slate-300'" class="rounded-lg px-3 py-2 transition">Ask WeatherGPT</button>
            <button type="button" (click)="activeView = 'settings'" [ngClass]="activeView === 'settings' ? 'bg-white text-slate-950' : 'text-slate-300'" class="rounded-lg px-3 py-2 transition">Settings</button>
          </nav>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <section class="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/20 via-slate-900 to-slate-900 p-5 shadow-2xl sm:p-8">
          <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Live weather intelligence</p>
              <h1 class="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Know what the sky means for your day.</h1>
            </div>
            <div *ngIf="overview" class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right text-sm">
              <p class="text-slate-400">Showing weather for</p><p class="font-medium">{{ locationLabel() }}</p>
            </div>
          </div>
          <form class="flex flex-col gap-3 sm:flex-row" (ngSubmit)="search()">
            <label class="sr-only" for="location-search">Search for a city</label>
            <div class="relative flex-1">
              <input id="location-search" [(ngModel)]="searchQuery" name="location" autocomplete="off" placeholder="Search a city, state, or country" class="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base text-white outline-none ring-sky-300 placeholder:text-slate-500 focus:ring-2" />
              <div *ngIf="searchResults.length" class="absolute left-0 right-0 top-[4.5rem] z-20 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
                <button type="button" *ngFor="let result of searchResults" (click)="selectLocation(result)" class="block w-full border-b border-white/5 px-5 py-3 text-left last:border-0 hover:bg-white/10">
                  <span class="block font-medium">{{ result.name }}</span><span class="text-xs text-slate-400">{{ result.admin1 ? result.admin1 + ', ' : '' }}{{ result.country }}</span>
                </button>
              </div>
            </div>
            <button type="submit" [disabled]="loading || searchQuery.trim().length < 2" class="rounded-2xl bg-sky-300 px-6 py-4 font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50">Search forecast</button>
            <button type="button" (click)="useMyLocation()" class="rounded-2xl border border-white/15 px-5 py-4 font-medium text-white transition hover:bg-white/10">⌖ Use my location</button>
          </form>
          <p *ngIf="errorMessage" class="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{{ errorMessage }}</p>
        </section>

        <div *ngIf="loading" class="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-300"><span class="mb-3 block text-3xl">◌</span>Loading live conditions…</div>

        <ng-container *ngIf="overview && !loading">
          <section *ngIf="activeView === 'overview'" class="space-y-6">
            <div class="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <article class="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-400 to-indigo-600 p-6 shadow-xl sm:p-8">
                <div class="flex items-start justify-between gap-4">
                  <div><p class="text-sm text-white/75">{{ dateLabel(currentTime()) }}</p><h2 class="mt-1 text-2xl font-semibold">{{ locationLabel() }}</h2><p class="mt-1 text-white/70">{{ overview.weather.timezone }} · updated {{ timeLabel(overview.weather.updated_at) }}</p></div>
                  <span class="text-5xl">{{ weatherEmoji(overview.weather.current.weather_code) }}</span>
                </div>
                <div class="mt-10 flex items-end gap-4"><span class="text-7xl font-semibold tracking-tighter">{{ temp(overview.weather.current.temperature) }}</span><span class="mb-3 text-lg text-white/80">{{ overview.analysis.condition }}</span></div>
                <p class="mt-4 max-w-xl text-white/80">Feels like {{ temp(overview.weather.current.feels_like) }}. {{ overview.analysis.rain_likely ? 'Rain is possible in the available forecast.' : 'Rain is not likely in the available forecast.' }}</p>
                <div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div class="rounded-2xl bg-black/15 p-3"><p class="text-xs text-white/65">Humidity</p><p class="mt-1 text-lg font-semibold">{{ overview.weather.current.humidity }}%</p></div>
                  <div class="rounded-2xl bg-black/15 p-3"><p class="text-xs text-white/65">Wind</p><p class="mt-1 text-lg font-semibold">{{ overview.weather.current.wind_speed }} km/h</p></div>
                  <div class="rounded-2xl bg-black/15 p-3"><p class="text-xs text-white/65">UV index</p><p class="mt-1 text-lg font-semibold">{{ overview.weather.current.uv_index }}</p></div>
                  <div class="rounded-2xl bg-black/15 p-3"><p class="text-xs text-white/65">Pressure</p><p class="mt-1 text-lg font-semibold">{{ overview.weather.current.pressure }} hPa</p></div>
                </div>
              </article>
              <article class="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div class="flex items-center justify-between"><div><p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Signal check</p><h2 class="mt-1 text-xl font-semibold">What it means</h2></div><span class="rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="overview.analysis.outdoor_suitability === 'good' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'">{{ overview.analysis.outdoor_suitability === 'good' ? 'Favorable' : 'Caution' }}</span></div>
                <div class="mt-6 space-y-3">
                  <div class="flex items-center justify-between rounded-2xl bg-white/5 p-4"><span class="text-slate-300">Rain probability</span><strong>{{ overview.analysis.rain_probability }}%</strong></div>
                  <div class="flex items-center justify-between rounded-2xl bg-white/5 p-4"><span class="text-slate-300">Visibility</span><strong>{{ visibility() }}</strong></div>
                  <div class="flex items-center justify-between rounded-2xl bg-white/5 p-4"><span class="text-slate-300">Sunrise / sunset</span><strong class="text-right text-sm">{{ timeLabel(today()?.sunrise) }}<br />{{ timeLabel(today()?.sunset) }}</strong></div>
                </div>
                <button type="button" (click)="activeView = 'chat'" class="mt-5 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 hover:bg-sky-100">Ask about this forecast →</button>
              </article>
            </div>

            <article class="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div class="mb-5 flex items-end justify-between"><div><p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Next seven days</p><h2 class="mt-1 text-xl font-semibold">Forecast rhythm</h2></div><span class="text-xs text-slate-500">{{ overview.weather.source }} data</span></div>
              <div class="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <div *ngFor="let day of overview.weather.daily" class="rounded-2xl border border-white/5 bg-slate-950/50 p-4"><p class="text-xs text-slate-500">{{ dateLabel(day.date) }}</p><p class="mt-3 text-2xl">{{ weatherEmoji(day.weather_code) }}</p><p class="mt-3 text-sm font-medium">{{ temp(day.high) }} <span class="text-slate-500">/ {{ temp(day.low) }}</span></p><p class="mt-2 text-xs text-sky-300">{{ day.rain_probability }}% rain</p><div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-sky-300" [style.width.%]="day.rain_probability"></div></div></div>
              </div>
            </article>

            <div class="grid gap-6 lg:grid-cols-2">
              <article class="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Personalized guidance</p><h2 class="mt-1 text-xl font-semibold">Recommendations</h2><div class="mt-5 space-y-3"><div *ngFor="let item of overview.recommendations" class="flex gap-3 rounded-2xl bg-white/5 p-4"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-400/15 text-sky-300">{{ recommendationEmoji(item.category) }}</span><div><p class="font-medium">{{ item.title }}</p><p class="mt-1 text-sm leading-6 text-slate-400">{{ item.body }}</p></div></div></div></article>
              <article class="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><div class="flex items-center justify-between"><div><p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Alert engine</p><h2 class="mt-1 text-xl font-semibold">Weather alerts</h2></div><span *ngIf="!overview.alerts.length" class="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">No active signals</span></div><div *ngIf="overview.alerts.length; else noAlerts" class="mt-5 space-y-3"><div *ngFor="let alert of overview.alerts" class="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4"><div class="flex items-center justify-between gap-3"><p class="font-medium text-amber-100">{{ alert.condition }}</p><span class="text-xs font-semibold text-amber-300">{{ alert.severity }}</span></div><p class="mt-2 text-sm leading-6 text-amber-100/70">{{ alert.action }}</p></div></div><ng-template #noAlerts><p class="mt-5 rounded-2xl bg-white/5 p-4 text-sm leading-6 text-slate-400">No threshold-based advisories are active for this location. These are analytical signals, not official government warnings.</p></ng-template></article>
            </div>
          </section>

          <section *ngIf="activeView === 'chat'" class="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div class="mb-6"><p class="text-xs font-semibold uppercase tracking-widest text-sky-300">Grounded weather assistant</p><h2 class="mt-1 text-2xl font-semibold">Ask about {{ locationLabel() }}</h2><p class="mt-2 text-sm text-slate-400">Answers use the live forecast above. If data is unavailable, WeatherGPT says so instead of guessing.</p></div>
            <div class="space-y-4"><div *ngFor="let message of messages" class="flex" [ngClass]="message.role === 'user' ? 'justify-end' : 'justify-start'"><div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6" [ngClass]="message.role === 'user' ? 'bg-sky-300 text-slate-950' : 'bg-white/10 text-slate-200'">{{ message.text }}</div></div></div>
            <div class="mt-6 flex flex-wrap gap-2"><button type="button" *ngFor="let prompt of prompts" (click)="question = prompt; submitQuestion()" class="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">{{ prompt }}</button></div>
            <form class="mt-4 flex gap-2" (ngSubmit)="submitQuestion()"><input [(ngModel)]="question" name="question" placeholder="e.g. Will I need an umbrella tomorrow?" class="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-300" /><button *ngIf="voiceSupported" type="button" (click)="toggleVoice()" class="rounded-2xl border border-white/10 px-4 text-lg" [attr.aria-label]="listening ? 'Stop voice input' : 'Start voice input'">{{ listening ? '◼' : '◉' }}</button><button type="submit" [disabled]="pending || !question.trim()" class="rounded-2xl bg-sky-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{{ pending ? 'Thinking…' : 'Ask' }}</button></form>
            <p *ngIf="voiceError" class="mt-2 text-xs text-amber-300">{{ voiceError }}</p>
          </section>

          <section *ngIf="activeView === 'settings'" class="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <p class="text-xs font-semibold uppercase tracking-widest text-sky-300">Your defaults</p><h2 class="mt-1 text-2xl font-semibold">Settings</h2><p class="mt-2 text-sm text-slate-400">Preferences are stored in your session and locally for this prototype.</p>
            <div class="mt-8 space-y-6">
              <label class="flex items-center justify-between gap-5 rounded-2xl bg-white/5 p-4"><span><span class="block font-medium">Response language</span><span class="mt-1 block text-sm text-slate-400">Use English, Hindi, or Marathi in the assistant.</span></span><select [(ngModel)]="language" (ngModelChange)="savePreference('language', $event)" class="rounded-xl border border-white/10 bg-slate-900 px-3 py-2"><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select></label>
              <label class="flex items-center justify-between gap-5 rounded-2xl bg-white/5 p-4"><span><span class="block font-medium">Temperature unit</span><span class="mt-1 block text-sm text-slate-400">Choose how temperatures are displayed.</span></span><select [(ngModel)]="unit" (ngModelChange)="savePreference('temperature_unit', $event)" class="rounded-xl border border-white/10 bg-slate-900 px-3 py-2"><option value="celsius">Celsius</option><option value="fahrenheit">Fahrenheit</option></select></label>
              <label class="flex items-center justify-between gap-5 rounded-2xl bg-white/5 p-4"><span><span class="block font-medium">Browser notifications</span><span class="mt-1 block text-sm text-slate-400">Permission is requested only when you enable this.</span></span><input type="checkbox" [(ngModel)]="notifications" (ngModelChange)="setNotifications($event)" class="h-5 w-5 accent-sky-300" /></label>
              <p class="rounded-2xl border border-sky-300/15 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100">Notifications are currently a browser-permission preference. The prototype does not pretend to deliver push alerts when the app is closed.</p>
            </div>
          </section>
        </ng-container>

        <section *ngIf="!overview && !loading" class="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center"><span class="text-5xl">☁︎</span><h2 class="mt-5 text-2xl font-semibold">Pick a location to begin</h2><p class="mx-auto mt-2 max-w-lg text-slate-400">Search for a city or allow device location. WeatherGPT will then load live conditions, forecasts, advisories, and recommendations from Open-Meteo.</p></section>
      </main>
      <footer class="border-t border-white/10 px-4 py-6 text-center text-xs text-slate-500">Weather data by Open-Meteo · Analytical guidance is not an official emergency warning.</footer>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  activeView: 'overview' | 'chat' | 'settings' = 'overview';
  searchQuery = '';
  searchResults: WeatherLocation[] = [];
  selectedLocation: WeatherLocation | null = null;
  overview: WeatherOverview | null = null;
  errorMessage = '';
  loading = false;
  question = '';
  pending = false;
  language: 'en' | 'hi' | 'mr' = 'en';
  unit: 'celsius' | 'fahrenheit' = 'celsius';
  notifications = false;
  voiceSupported = false;
  listening = false;
  voiceError = '';
  messages: ChatMessage[] = [{ role: 'assistant', text: 'Choose a location and I’ll answer from its live forecast—not guesses.' }];
  prompts = ['Will I need an umbrella?', 'What should I wear today?', 'Is it safe to travel today?'];

  constructor(private weatherService: WeatherService) {}

  ngOnInit(): void {
    this.voiceSupported = typeof window !== 'undefined' && !!(window as any).webkitSpeechRecognition;
    this.weatherService.getPreferences().subscribe({ next: preferences => this.applyPreferences(preferences), error: () => undefined });
    try {
      const saved = localStorage.getItem('weathergpt-location');
      if (saved) this.loadLocation(JSON.parse(saved) as WeatherLocation);
    } catch { /* Local storage is optional. */ }
  }

  search(): void {
    if (this.searchQuery.trim().length < 2) return;
    this.errorMessage = '';
    this.weatherService.searchLocations(this.searchQuery).subscribe({
      next: response => this.searchResults = response.results || [],
      error: () => this.errorMessage = 'Location search is unavailable right now. Try again in a moment.',
    });
  }

  selectLocation(location: WeatherLocation): void {
    this.searchResults = [];
    this.searchQuery = location.name;
    this.loadLocation(location);
  }

  useMyLocation(): void {
    this.errorMessage = '';
    if (!navigator.geolocation) {
      this.errorMessage = 'Device location is not supported by this browser. Search for a city instead.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => this.loadLocation({ name: 'Current location', latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => this.errorMessage = 'Location access was denied or unavailable. Search for a city instead.',
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  loadLocation(location: WeatherLocation): void {
    this.selectedLocation = location;
    this.overview = null;
    this.loading = true;
    this.errorMessage = '';
    try { localStorage.setItem('weathergpt-location', JSON.stringify(location)); } catch { /* Local storage is optional. */ }
    this.weatherService.getOverview(location).subscribe({
      next: overview => { this.overview = overview; this.loading = false; this.messages = [{ role: 'assistant', text: `I’m ready with the live forecast for ${this.locationLabel()}. What would you like to know?` }]; },
      error: () => { this.loading = false; this.errorMessage = 'The weather provider could not be reached. Check your connection and try again.'; },
    });
  }

  submitQuestion(): void {
    if (!this.question.trim() || !this.selectedLocation || this.pending) return;
    const text = this.question.trim();
    this.messages.push({ role: 'user', text });
    this.question = '';
    this.pending = true;
    this.weatherService.ask(text, this.selectedLocation, this.language).subscribe({
      next: (response: ChatResponse) => { this.messages.push({ role: 'assistant', text: response.answer }); this.pending = false; },
      error: () => { this.messages.push({ role: 'assistant', text: 'I could not retrieve the live forecast right now. Please try again when the weather data is available.' }); this.pending = false; },
    });
  }

  toggleVoice(): void {
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (this.listening) { this.listening = false; return; }
    const recognition = new SpeechRecognition();
    recognition.lang = this.language === 'hi' ? 'hi-IN' : this.language === 'mr' ? 'mr-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.onstart = () => { this.listening = true; this.voiceError = ''; };
    recognition.onend = () => this.listening = false;
    recognition.onerror = () => { this.listening = false; this.voiceError = 'Voice input was unavailable. You can still type your question.'; };
    recognition.onresult = (event: any) => { this.question = event.results[0][0].transcript; };
    recognition.start();
  }

  savePreference(key: string, value: string): void {
    const patch: any = {};
    patch[key] = value;
    this.weatherService.savePreferences(patch).subscribe({ error: () => undefined });
  }

  setNotifications(enabled: boolean): void {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => { this.notifications = permission === 'granted'; this.savePreference('notifications', this.notifications ? 'true' : 'false'); });
      return;
    }
    this.savePreference('notifications', enabled ? 'true' : 'false');
  }

  applyPreferences(preferences: WeatherPreferences): void {
    this.language = preferences.language || 'en';
    this.unit = preferences.temperature_unit || 'celsius';
    this.notifications = preferences.notifications || false;
  }

  currentTime(): string { return this.overview?.weather.current.time || new Date().toISOString(); }
  today(): DailyWeather | undefined { return this.overview?.weather.daily[0]; }
  locationLabel(): string { const location = this.overview?.weather.location || this.selectedLocation; return location ? [location.name, location.admin1, location.country].filter(Boolean).join(', ') : 'Selected location'; }
  temp(value: number | null | undefined): string { if (value === null || value === undefined) return '—'; const converted = this.unit === 'fahrenheit' ? value * 9 / 5 + 32 : value; return `${Math.round(converted)}°`; }
  visibility(): string { const value = this.overview?.weather.current.visibility; return value ? `${(value / 1000).toFixed(1)} km` : 'Unavailable'; }
  timeLabel(value?: string): string { return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'; }
  dateLabel(value?: string): string { return value ? new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '—'; }
  weatherEmoji(code: number): string { if (code >= 95) return '⛈️'; if (code >= 80) return '🌦️'; if (code >= 61) return '🌧️'; if (code >= 45) return '🌫️'; if (code >= 3) return '☁️'; return '☀️'; }
  recommendationEmoji(category: string): string { return category === 'rain' ? '☂' : category === 'sun' ? '☀' : category === 'clothing' ? '◌' : category === 'agriculture' ? '⌁' : '✦'; }
}