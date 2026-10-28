from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from .models import Booking
from .serializers import BookingSerializer
from .permissions import IsBookingOwnerOrAdmin
class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated, IsBookingOwnerOrAdmin]
    http_method_names = ['get','post','patch','delete','head','options']
    def get_queryset(self):
        qs = Booking.objects.select_related('customer','car')
        user=self.request.user
        if user.is_staff or getattr(getattr(user,'profile',None),'role','')=='admin': return qs
        return qs.filter(customer=user)
    def perform_create(self, serializer): serializer.save(customer=self.request.user)
    def update(self, request, *args, **kwargs):
        instance=self.get_object(); is_admin=request.user.is_staff or getattr(getattr(request.user,'profile',None),'role','')=='admin'
        if not is_admin:
            if instance.customer_id != request.user.id: raise PermissionDenied()
            if set(request.data.keys()) - {'status'}: raise PermissionDenied('Customers may only cancel their own booking.')
            if request.data.get('status') != 'cancelled': raise PermissionDenied('Customers may only cancel their own booking.')
            if instance.status not in ('pending','confirmed'): raise PermissionDenied('This booking can no longer be cancelled.')
        return super().update(request,*args,**kwargs)
    def partial_update(self, request, *args, **kwargs):
        instance=self.get_object(); is_admin=request.user.is_staff or getattr(getattr(request.user,'profile',None),'role','')=='admin'
        if not is_admin:
            if request.data.get('status') != 'cancelled' or instance.status not in ('pending','confirmed'):
                raise PermissionDenied('Customers may only cancel pending or confirmed bookings.')
        return super().partial_update(request,*args,**kwargs)
