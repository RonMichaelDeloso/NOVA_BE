from datetime import datetime
from django.utils.dateparse import parse_datetime
from rest_framework import viewsets, filters, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Car
from .serializers import CarSerializer
from .permissions import IsAdminOrReadOnly
class CarViewSet(viewsets.ModelViewSet):
    queryset = Car.objects.all()
    serializer_class = CarSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name','brand','vehicle_type','fuel','transmission']
    ordering_fields = ['daily_rate','brand','name','seats']
    def get_queryset(self):
        qs = super().get_queryset()
        brand = self.request.query_params.get('brand')
        status_value = self.request.query_params.get('status')
        if brand and brand.lower() != 'any brand': qs = qs.filter(brand__iexact=brand)
        if status_value: qs = qs.filter(status=status_value)
        return qs
class AvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if not start or not end: return Response({'detail':'Provide start and end as ISO date-times.'}, status=400)
        start_dt = parse_datetime(start); end_dt = parse_datetime(end)
        if not start_dt or not end_dt or end_dt <= start_dt: return Response({'detail':'Return time must be after pickup time.'}, status=400)
        from bookings.models import Booking
        busy_ids = Booking.objects.filter(status__in=['pending','confirmed','approved'], pickup_at__lt=end_dt, return_at__gt=start_dt).values_list('car_id', flat=True)
        qs = Car.objects.filter(status='available').exclude(id__in=busy_ids)
        brand = request.query_params.get('brand')
        if brand and brand.lower() != 'any brand': qs = qs.filter(brand__iexact=brand)
        return Response(CarSerializer(qs, many=True).data)
