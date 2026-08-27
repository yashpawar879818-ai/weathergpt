import json
import os
from datetime import datetime
from typing import Any

import requests

OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search"


class WeatherServiceError(Exception):
    pass


def _coordinates(lat: str | float, lon: str | float) -> tuple[float, float]:
    try:
        latitude, longitude = float(lat), float(lon)
    except (TypeError, ValueError) as exc:
        raise WeatherServiceError("Latitude and longitude must be numbers.") from exc
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise WeatherServiceError("Latitude or longitude is outside its valid range.")
    return latitude, longitude


def fetch_forecast(lat: str | float, lon: str | float) -> dict[str, Any]:
    latitude, longitude = _coordinates(lat, lon)
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join([
            "temperature_2m", "relative_humidity_2m", "apparent_temperature",
            "is_day", "precipitation", "rain", "showers", "snowfall",
            "weather_code", "cloud_cover", "pressure_msl", "wind_speed_10m",
            "wind_direction_10m", "wind_gusts_10m", "visibility", "uv_index",
        ]),
        "hourly": ",".join([
            "temperature_2m", "relative_humidity_2m", "apparent_temperature",
            "precipitation_probability", "precipitation", "rain", "showers",
            "snowfall", "weather_code", "cloud_cover", "wind_speed_10m",
            "wind_direction_10m", "uv_index",
        ]),
        "daily": ",".join([
            "weather_code", "temperature_2m_max", "temperature_2m_min",
            "apparent_temperature_max", "apparent_temperature_min", "sunrise",
            "sunset", "uv_index_max", "precipitation_sum", "precipitation_probability_max",
            "wind_speed_10m_max",
        ]),
        "timezone": "auto",
        "forecast_days": 7,
    }
    try:
        response = requests.get(OPEN_METEO_FORECAST, params=params, timeout=12)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise WeatherServiceError("The weather provider is temporarily unavailable.") from exc


def search_locations(query: str) -> list[dict[str, Any]]:
    query = query.strip()
    if len(query) < 2:
        return []
    try:
        response = requests.get(
            OPEN_METEO_GEOCODING,
            params={"name": query[:80], "count": 8, "language": "en", "format": "json"},
            timeout=8,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        return [
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "country": item.get("country"),
                "admin1": item.get("admin1"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "timezone": item.get("timezone"),
            }
            for item in results
        ]
    except (requests.RequestException, ValueError) as exc:
        raise WeatherServiceError("Location search is temporarily unavailable.") from exc


def _value(data: dict[str, Any], key: str, fallback: Any = None) -> Any:
    value = data.get(key, fallback)
    return fallback if value is None else value


def normalize_weather(forecast: dict[str, Any], location: dict[str, Any] | None = None) -> dict[str, Any]:
    current = forecast.get("current") or {}
    hourly = forecast.get("hourly") or {}
    daily = forecast.get("daily") or {}
    hourly_times = hourly.get("time") or []
    now = datetime.fromisoformat(str(current.get("time", "")).replace("Z", "+00:00")) if current.get("time") else None
    current_weather = {
        "temperature": _value(current, "temperature_2m", 0),
        "feels_like": _value(current, "apparent_temperature", 0),
        "humidity": _value(current, "relative_humidity_2m", 0),
        "precipitation": _value(current, "precipitation", 0),
        "rain": _value(current, "rain", 0),
        "cloud_cover": _value(current, "cloud_cover", 0),
        "pressure": _value(current, "pressure_msl", 0),
        "wind_speed": _value(current, "wind_speed_10m", 0),
        "wind_direction": _value(current, "wind_direction_10m", 0),
        "wind_gusts": _value(current, "wind_gusts_10m", 0),
        "visibility": _value(current, "visibility", None),
        "uv_index": _value(current, "uv_index", 0),
        "weather_code": _value(current, "weather_code", 0),
        "is_day": _value(current, "is_day", 1),
        "time": current.get("time"),
    }
    hours = []
    for index, timestamp in enumerate(hourly_times[:48]):
        hours.append({
            "time": timestamp,
            "temperature": _value_at(hourly, "temperature_2m", index),
            "feels_like": _value_at(hourly, "apparent_temperature", index),
            "humidity": _value_at(hourly, "relative_humidity_2m", index),
            "rain_probability": _value_at(hourly, "precipitation_probability", index),
            "precipitation": _value_at(hourly, "precipitation", index),
            "weather_code": _value_at(hourly, "weather_code", index),
            "wind_speed": _value_at(hourly, "wind_speed_10m", index),
            "uv_index": _value_at(hourly, "uv_index", index),
        })
    days = []
    for index, day in enumerate(daily.get("time") or []):
        days.append({
            "date": day,
            "high": _value_at(daily, "temperature_2m_max", index),
            "low": _value_at(daily, "temperature_2m_min", index),
            "feels_like_high": _value_at(daily, "apparent_temperature_max", index),
            "feels_like_low": _value_at(daily, "apparent_temperature_min", index),
            "weather_code": _value_at(daily, "weather_code", index),
            "sunrise": _value_at(daily, "sunrise", index),
            "sunset": _value_at(daily, "sunset", index),
            "uv_index": _value_at(daily, "uv_index_max", index),
            "rain_probability": _value_at(daily, "precipitation_probability_max", index),
            "precipitation": _value_at(daily, "precipitation_sum", index),
            "wind_speed": _value_at(daily, "wind_speed_10m_max", index),
        })
    return {
        "location": location or {"latitude": forecast.get("latitude"), "longitude": forecast.get("longitude")},
        "timezone": forecast.get("timezone"),
        "updated_at": current.get("time"),
        "current": current_weather,
        "hourly": hours,
        "daily": days,
        "source": "Open-Meteo",
        "source_url": "https://open-meteo.com/",
        "raw": forecast,
    }


def _value_at(data: dict[str, Any], key: str, index: int, fallback: Any = 0) -> Any:
    values = data.get(key) or []
    return values[index] if index < len(values) and values[index] is not None else fallback


def weather_label(code: int | float | None) -> str:
    code = int(code or 0)
    labels = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle",
        55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Heavy freezing drizzle",
        61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain",
        67: "Heavy freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
        77: "Snow grains", 80: "Light showers", 81: "Showers", 82: "Heavy showers",
        85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm",
        96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
    }
    return labels.get(code, "Mixed conditions")


def analyze_weather(weather: dict[str, Any]) -> dict[str, Any]:
    current = weather["current"]
    today = weather.get("daily", [{}])[0]
    rain_probability = max(
        float(today.get("rain_probability") or 0),
        max((float(hour.get("rain_probability") or 0) for hour in weather.get("hourly", [])[:24]), default=0),
    )
    code = int(current.get("weather_code") or 0)
    heat = float(current.get("temperature") or 0) >= 35
    cold = float(current.get("temperature") or 0) <= 12
    strong_wind = float(current.get("wind_speed") or 0) >= 35
    thunderstorm = code >= 95
    heavy_rain = code in {65, 82} or float(today.get("precipitation") or 0) >= 20
    return {
        "condition": weather_label(code),
        "rain_likely": rain_probability >= 50 or code in {61, 63, 65, 80, 81, 82},
        "rain_probability": round(rain_probability),
        "heat_risk": heat,
        "cold_risk": cold,
        "strong_wind": strong_wind,
        "thunderstorm": thunderstorm,
        "heavy_rain": heavy_rain,
        "outdoor_suitability": "caution" if heat or strong_wind or thunderstorm or heavy_rain else "good",
    }


def recommendations(weather: dict[str, Any], analysis: dict[str, Any], language: str = "en") -> list[dict[str, str]]:
    current = weather["current"]
    items = []
    temperature = float(current.get("temperature") or 0)
    if temperature <= 15:
        items.append({"category": "clothing", "title": "Warm layers", "body": "A jacket or warm layers should be comfortable today."})
    elif temperature >= 30:
        items.append({"category": "clothing", "title": "Light, breathable clothing", "body": "Choose light fabrics and take regular water breaks."})
    else:
        items.append({"category": "clothing", "title": "Comfortable layers", "body": "Light to moderate layers should suit the current conditions."})
    if analysis["rain_likely"]:
        items.append({"category": "rain", "title": "Carry rain protection", "body": f"Rain probability reaches {analysis['rain_probability']}%; an umbrella is sensible."})
    if float(current.get("uv_index") or 0) >= 6:
        items.append({"category": "sun", "title": "Sun protection", "body": "Use sunscreen, shade, and sunglasses during the brightest hours."})
    if analysis["outdoor_suitability"] == "good":
        items.append({"category": "outdoors", "title": "Good for outdoor plans", "body": "Conditions look generally suitable for outdoor activity."})
    else:
        items.append({"category": "travel", "title": "Plan with care", "body": "Allow extra travel time and check local conditions before heading out."})
    if analysis["heavy_rain"] or analysis["thunderstorm"]:
        items.append({"category": "agriculture", "title": "Farm advisory", "body": "Protect exposed equipment and avoid field work during intense rain or lightning."})
    if language == "hi":
        translations = {"Warm layers": "गर्म कपड़ों की परतें", "Light, breathable clothing": "हल्के और आरामदायक कपड़े", "Comfortable layers": "आरामदायक परतें", "Carry rain protection": "बारिश से बचाव रखें", "Sun protection": "धूप से बचाव", "Good for outdoor plans": "बाहर की गतिविधियों के लिए अच्छा", "Plan with care": "सावधानी से योजना बनाएं", "Farm advisory": "कृषि सलाह"}
        for item in items: item["title"] = translations.get(item["title"], item["title"])
    elif language == "mr":
        translations = {"Warm layers": "उबदार कपड्यांचे थर", "Light, breathable clothing": "हलके आणि हवेशीर कपडे", "Comfortable layers": "आरामदायक कपड्यांचे थर", "Carry rain protection": "पावसापासून संरक्षण ठेवा", "Sun protection": "सूर्यापासून संरक्षण", "Good for outdoor plans": "बाहेरील उपक्रमांसाठी चांगले", "Plan with care": "काळजीपूर्वक योजना करा", "Farm advisory": "शेती सल्ला"}
        for item in items: item["title"] = translations.get(item["title"], item["title"])
    return items


def alerts(weather: dict[str, Any], analysis: dict[str, Any]) -> list[dict[str, Any]]:
    location = weather.get("location", {})
    label = location.get("name") or "Selected location"
    items = []
    if analysis["thunderstorm"]:
        items.append({"severity": "WARNING", "condition": "Thunderstorm indicators", "location": label, "action": "Stay indoors during lightning and follow local authorities."})
    if analysis["heavy_rain"]:
        items.append({"severity": "ADVISORY", "condition": "Heavy rain possible", "location": label, "action": "Carry rain protection and watch for local flooding."})
    if analysis["heat_risk"]:
        items.append({"severity": "ADVISORY", "condition": "High heat", "location": label, "action": "Hydrate and limit prolonged exposure during the hottest hours."})
    if analysis["strong_wind"]:
        items.append({"severity": "ADVISORY", "condition": "Strong winds", "location": label, "action": "Secure loose objects and take care when travelling."})
    return items


def _language_text(language: str, en: str, hi: str, mr: str) -> str:
    return hi if language == "hi" else mr if language == "mr" else en


def grounded_chat_answer(question: str, weather: dict[str, Any], analysis: dict[str, Any], language: str = "en") -> str:
    current = weather["current"]
    today = weather.get("daily", [{}])[0]
    tomorrow = weather.get("daily", [{}, {}])[1] if len(weather.get("daily", [])) > 1 else {}
    q = question.lower()
    temp = round(float(current.get("temperature") or 0))
    rain = analysis["rain_probability"]
    condition = analysis["condition"]
    if any(word in q for word in ["umbrella", "rain", "पाऊस", "बारिश"]):
        if rain >= 50 or analysis["rain_likely"]:
            return _language_text(language, f"Yes—rain is possible, with a peak probability of {rain}% in the available forecast. Carry an umbrella. This is forecast guidance, not an official warning.", f"हाँ—उपलब्ध पूर्वानुमान में बारिश की अधिकतम संभावना {rain}% है। छाता साथ रखें। यह पूर्वानुमान आधारित सलाह है, आधिकारिक चेतावनी नहीं।", f"हो—उपलब्ध अंदाजानुसार पावसाची कमाल शक्यता {rain}% आहे. छत्री सोबत ठेवा. ही अंदाजावर आधारित सूचना आहे, अधिकृत इशारा नाही.")
        return _language_text(language, f"Rain does not look likely in the available forecast (peak probability {rain}%). An umbrella is optional, though conditions can change.", f"उपलब्ध पूर्वानुमान में बारिश की संभावना कम है (अधिकतम {rain}%)। छाता वैकल्पिक है, पर मौसम बदल सकता है।", f"उपलब्ध अंदाजात पावसाची शक्यता कमी आहे (कमाल {rain}%). छत्री ऐच्छिक आहे, पण हवामान बदलू शकते.")
    if any(word in q for word in ["wear", "clothing", "कपड़े", "कपडे"]):
        return _language_text(language, f"It is {temp}°C and {condition.lower()}. Choose {'light, breathable clothing' if temp >= 30 else 'comfortable light layers' if temp > 15 else 'warm layers'}." , f"तापमान {temp}°C है और मौसम {condition.lower()} है। {'हल्के, हवादार कपड़े' if temp >= 30 else 'आरामदायक हल्की परतें' if temp > 15 else 'गर्म कपड़े'} पहनें।", f"तापमान {temp}°C आहे आणि हवामान {condition.lower()} आहे. {'हलके, हवेशीर कपडे' if temp >= 30 else 'आरामदायक हलके थर' if temp > 15 else 'उबदार कपडे'} निवडा.")
    if "tomorrow" in q or "उद्या" in q or "कल" in q:
        return _language_text(language, f"Tomorrow's forecast is {weather_label(tomorrow.get('weather_code'))}, with a high of {tomorrow.get('high')}°C, low of {tomorrow.get('low')}°C, and rain probability up to {tomorrow.get('rain_probability')}%.", f"कल का पूर्वानुमान {weather_label(tomorrow.get('weather_code'))} है; अधिकतम तापमान {tomorrow.get('high')}°C, न्यूनतम {tomorrow.get('low')}°C और बारिश की संभावना {tomorrow.get('rain_probability')}% तक है।", f"उद्याचा अंदाज {weather_label(tomorrow.get('weather_code'))} आहे; कमाल तापमान {tomorrow.get('high')}°C, किमान {tomorrow.get('low')}°C आणि पावसाची शक्यता {tomorrow.get('rain_probability')}% पर्यंत आहे.")
    if any(word in q for word in ["safe", "travel", "यात्रा", "प्रवास"]):
        return _language_text(language, f"Weather-based guidance: travel looks {'cautious' if analysis['outdoor_suitability'] != 'good' else 'generally suitable'} right now. Check official local advisories before making safety-critical decisions.", f"मौसम आधारित सलाह: अभी यात्रा {'सावधानी से करें' if analysis['outdoor_suitability'] != 'good' else 'सामान्य रूप से ठीक'} है। सुरक्षा से जुड़े निर्णयों के लिए स्थानीय आधिकारिक सलाह देखें।", f"हवामानावर आधारित सूचना: सध्या प्रवास {'काळजीपूर्वक करा' if analysis['outdoor_suitability'] != 'good' else 'सामान्यतः योग्य'} आहे. सुरक्षिततेच्या निर्णयांसाठी स्थानिक अधिकृत सूचना तपासा.")
    return _language_text(language, f"Currently it is {temp}°C with {condition.lower()}. Rain probability is up to {rain}%. Ask me about rain, clothing, travel, outdoor plans, or tomorrow's forecast.", f"अभी तापमान {temp}°C है और मौसम {condition.lower()} है। बारिश की संभावना {rain}% तक है। बारिश, कपड़े, यात्रा, बाहर की गतिविधियों या कल के पूर्वानुमान के बारे में पूछें।", f"सध्या तापमान {temp}°C आहे आणि हवामान {condition.lower()} आहे. पावसाची शक्यता {rain}% पर्यंत आहे. पाऊस, कपडे, प्रवास, बाहेरील उपक्रम किंवा उद्याच्या अंदाजाबद्दल विचारा.")


def generate_chat_answer(question: str, weather: dict[str, Any], analysis: dict[str, Any], language: str = "en") -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return grounded_chat_answer(question, weather, analysis, language)
    try:
        import openai
        openai.api_key = api_key
        context = {"current": weather["current"], "today": weather.get("daily", [{}])[0], "forecast": weather.get("daily", [])[:7], "analysis": analysis}
        result = openai.ChatCompletion.create(
            model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
            temperature=0.2,
            max_tokens=220,
            messages=[
                {"role": "system", "content": "You are WeatherGPT. Answer only from the supplied weather JSON. Never invent values or official warnings. Distinguish forecast guidance from official alerts. Reply in the requested language."},
                {"role": "user", "content": json.dumps({"language": language, "question": question, "weather": context}, ensure_ascii=False)},
            ],
        )
        return result["choices"][0]["message"]["content"].strip()
    except Exception:
        return grounded_chat_answer(question, weather, analysis, language)
