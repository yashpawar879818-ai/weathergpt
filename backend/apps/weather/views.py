import json
import os

from django.core.cache import cache
from django.db.utils import OperationalError
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .services import (
    WeatherServiceError,
    alerts,
    analyze_weather,
    fetch_forecast,
    generate_chat_answer,
    normalize_weather,
    recommendations,
    search_locations,
)

CACHE_SECONDS = 15 * 60


def _error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _lat_lon(lat: str, lon: str) -> tuple[float, float] | None:
    try:
        latitude, longitude = float(lat), float(lon)
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return None
        return latitude, longitude
    except (TypeError, ValueError):
        return None


def _load_overview(lat: str, lon: str, location: dict | None = None) -> dict:
    coordinates = _lat_lon(lat, lon)
    if coordinates is None:
        raise WeatherServiceError("Invalid latitude or longitude value.")
    latitude, longitude = coordinates
    key = f"overview_{latitude:.4f}_{longitude:.4f}"
    cached = cache.get(key)
    if cached:
        return cached
    forecast = fetch_forecast(latitude, longitude)
    weather = normalize_weather(forecast, location or {"latitude": latitude, "longitude": longitude})
    analysis = analyze_weather(weather)
    result = {
        "weather": weather,
        "analysis": analysis,
        "recommendations": recommendations(weather, analysis),
        "alerts": alerts(weather, analysis),
    }
    cache.set(key, result, CACHE_SECONDS)
    return result


@require_http_methods(["GET"])
def get_forecast(request: HttpRequest, lat: str, lon: str) -> HttpResponse:
    try:
        return JsonResponse(fetch_forecast(lat, lon))
    except WeatherServiceError as exc:
        return _error(str(exc), 502)


@require_http_methods(["GET"])
def get_forecast_summary(request: HttpRequest, lat: str, lon: str) -> HttpResponse:
    try:
        overview = _load_overview(lat, lon)
        current = overview["weather"]["current"]
        analysis = overview["analysis"]
        return JsonResponse({"summary": f"{analysis['condition']} with {round(current['temperature'])}°C currently. Rain probability reaches {analysis['rain_probability']}% in the available forecast."})
    except WeatherServiceError as exc:
        return _error(str(exc), 502)


@require_http_methods(["GET"])
def get_overview(request: HttpRequest, lat: str, lon: str) -> JsonResponse:
    try:
        location = {"latitude": float(lat), "longitude": float(lon), "name": request.GET.get("name") or "Selected location"}
        return JsonResponse(_load_overview(lat, lon, location))
    except (WeatherServiceError, ValueError) as exc:
        return _error(str(exc), 502)


@require_http_methods(["GET"])
def location_search(request: HttpRequest) -> JsonResponse:
    try:
        return JsonResponse({"results": search_locations(request.GET.get("q", ""))})
    except WeatherServiceError as exc:
        return _error(str(exc), 502)


@csrf_exempt
@require_http_methods(["POST"])
def chat(request: HttpRequest) -> JsonResponse:
    try:
        payload = json.loads(request.body or "{}")
        question = str(payload.get("question", "")).strip()
        language = payload.get("language", "en") if payload.get("language") in {"en", "hi", "mr"} else "en"
        if not question or len(question) > 500:
            return _error("Ask a weather question between 1 and 500 characters.")
        overview = _load_overview(str(payload.get("latitude")), str(payload.get("longitude")), payload.get("location"))
        answer = generate_chat_answer(question, overview["weather"], overview["analysis"], language)
        return JsonResponse({"answer": answer, "grounded": True, "source": "Open-Meteo", "analysis": overview["analysis"]})
    except (json.JSONDecodeError, TypeError):
        return _error("Request body must be valid JSON.")
    except WeatherServiceError as exc:
        return _error(str(exc), 502)


@require_http_methods(["GET"])
def preferences(request: HttpRequest) -> JsonResponse:
    defaults = {
        "language": "en", "temperature_unit": "celsius", "notifications": False,
        "severe_alerts": True, "clothing_recommendations": True,
    }
    try:
        return JsonResponse({**defaults, **request.session.get("weather_preferences", {})})
    except OperationalError:
        return JsonResponse(defaults)


@csrf_exempt
@require_http_methods(["PUT"])
def update_preferences(request: HttpRequest) -> JsonResponse:
    try:
        payload = json.loads(request.body or "{}")
        try:
            current = request.session.get("weather_preferences", {})
        except OperationalError:
            current = {}
        allowed = {"language", "temperature_unit", "notifications", "severe_alerts", "clothing_recommendations", "location"}
        current.update({key: value for key, value in payload.items() if key in allowed})
        request.session["weather_preferences"] = current
        try:
            request.session.save()
        except OperationalError:
            pass
        return JsonResponse(current)
    except json.JSONDecodeError:
        return _error("Request body must be valid JSON.")
