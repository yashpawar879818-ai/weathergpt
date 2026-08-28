from unittest.mock import patch

import requests
from django.test import SimpleTestCase

from .services import (
    WeatherServiceError,
    analyze_weather,
    fetch_forecast,
    grounded_chat_answer,
    normalize_weather,
)


class WeatherIntelligenceTests(SimpleTestCase):
    def setUp(self):
        self.forecast = {
            "latitude": 19.07,
            "longitude": 72.87,
            "timezone": "Asia/Kolkata",
            "current": {
                "time": "2026-08-28T12:00",
                "temperature_2m": 32,
                "relative_humidity_2m": 72,
                "apparent_temperature": 36,
                "weather_code": 63,
                "precipitation": 2,
                "rain": 2,
                "cloud_cover": 85,
                "pressure_msl": 1008,
                "wind_speed_10m": 18,
                "wind_direction_10m": 220,
                "wind_gusts_10m": 30,
                "visibility": 10000,
                "uv_index": 7,
                "is_day": 1,
            },
            "hourly": {
                "time": ["2026-08-28T12:00"],
                "temperature_2m": [32],
                "relative_humidity_2m": [72],
                "apparent_temperature": [36],
                "precipitation_probability": [80],
                "precipitation": [2],
                "weather_code": [63],
                "wind_speed_10m": [18],
                "uv_index": [7],
            },
            "daily": {
                "time": ["2026-08-28", "2026-08-29"],
                "temperature_2m_max": [33, 31],
                "temperature_2m_min": [27, 26],
                "apparent_temperature_max": [37, 35],
                "apparent_temperature_min": [28, 27],
                "weather_code": [63, 61],
                "sunrise": ["2026-08-28T06:20", "2026-08-29T06:19"],
                "sunset": ["2026-08-28T19:05", "2026-08-29T19:05"],
                "uv_index_max": [8, 7],
                "precipitation_probability_max": [80, 60],
                "precipitation_sum": [12, 8],
                "wind_speed_10m_max": [25, 23],
            },
        }

    def test_normalization_and_analysis_preserve_provider_values(self):
        weather = normalize_weather(self.forecast, {"name": "Mumbai"})
        analysis = analyze_weather(weather)

        self.assertEqual(weather["current"]["temperature"], 32)
        self.assertEqual(weather["daily"][1]["high"], 31)
        self.assertEqual(analysis["rain_probability"], 80)
        self.assertTrue(analysis["rain_likely"])

    def test_grounded_chat_uses_live_context_and_language(self):
        weather = normalize_weather(self.forecast, {"name": "Mumbai"})
        analysis = analyze_weather(weather)

        answer = grounded_chat_answer("Will I need an umbrella?", weather, analysis, "en")

        self.assertIn("80%", answer)
        self.assertIn("umbrella", answer.lower())
        self.assertIn("official warning", answer.lower())

    @patch("apps.weather.services.requests.get")
    def test_provider_failure_becomes_safe_service_error(self, get):
        get.side_effect = requests.RequestException("provider down")

        with self.assertRaises(WeatherServiceError):
            fetch_forecast(19.07, 72.87)