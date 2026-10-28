from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import RegisterView, NovaTokenObtainPairView, MeView
from cars.views import CarViewSet, AvailabilityView
from bookings.views import BookingViewSet
from chat.views import MessageViewSet
router = DefaultRouter()
router.register('cars', CarViewSet, basename='car')
router.register('bookings', BookingViewSet, basename='booking')
router.register('messages', MessageViewSet, basename='message')
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', lambda request: JsonResponse({'status': 'ok', 'service': 'Nova API'})),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', NovaTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', MeView.as_view(), name='me'),
    path('api/cars/availability/', AvailabilityView.as_view(), name='car-availability'),
    path('api/', include(router.urls)),
]
