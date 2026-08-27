export interface WeatherLocation {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface CurrentWeather {
  temperature: number;
  feels_like: number;
  humidity: number;
  precipitation: number;
  rain: number;
  cloud_cover: number;
  pressure: number;
  wind_speed: number;
  wind_direction: number;
  wind_gusts: number;
  visibility: number | null;
  uv_index: number;
  weather_code: number;
  is_day: number;
  time: string;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  rain_probability: number;
  precipitation: number;
  weather_code: number;
  wind_speed: number;
  uv_index: number;
}

export interface DailyWeather {
  date: string;
  high: number;
  low: number;
  feels_like_high: number;
  feels_like_low: number;
  weather_code: number;
  sunrise: string;
  sunset: string;
  uv_index: number;
  rain_probability: number;
  precipitation: number;
  wind_speed: number;
}

export interface WeatherData {
  location: WeatherLocation;
  timezone: string;
  updated_at: string;
  current: CurrentWeather;
  hourly: HourlyWeather[];
  daily: DailyWeather[];
  source: string;
  source_url: string;
}

export interface WeatherAnalysis {
  condition: string;
  rain_likely: boolean;
  rain_probability: number;
  heat_risk: boolean;
  cold_risk: boolean;
  strong_wind: boolean;
  thunderstorm: boolean;
  heavy_rain: boolean;
  outdoor_suitability: string;
}

export interface Recommendation {
  category: string;
  title: string;
  body: string;
}

export interface WeatherAlert {
  severity: string;
  condition: string;
  location: string;
  action: string;
}

export interface WeatherOverview {
  weather: WeatherData;
  analysis: WeatherAnalysis;
  recommendations: Recommendation[];
  alerts: WeatherAlert[];
}

export interface ChatResponse {
  answer: string;
  grounded: boolean;
  source: string;
}

export interface WeatherPreferences {
  language: 'en' | 'hi' | 'mr';
  temperature_unit: 'celsius' | 'fahrenheit';
  notifications: boolean;
  severe_alerts: boolean;
  clothing_recommendations: boolean;
}