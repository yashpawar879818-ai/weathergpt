from django.urls import path

from apps.weather.views import (
    chat,
    get_forecast,
    get_forecast_summary,
    get_overview,
    location_search,
    preferences,
    update_preferences,
)

urlpatterns = [
    path("forecast/<str:lat>/<str:lon>/", get_forecast),
    path("forecast/<str:lat>/<str:lon>/summary/", get_forecast_summary),
    path("overview/<str:lat>/<str:lon>/", get_overview),
    path("locations/search/", location_search),
    path("chat/", chat),
    path("preferences/", preferences),
    path("preferences/update/", update_preferences),
]
