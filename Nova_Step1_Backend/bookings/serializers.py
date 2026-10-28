from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from rest_framework import serializers
from .models import Booking
from cars.serializers import CarSerializer
from cars.models import Car
class BookingSerializer(serializers.ModelSerializer):
    car_details = CarSerializer(source='car', read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    car_id = serializers.PrimaryKeyRelatedField(source='car', queryset=Car.objects.all(), write_only=True)
    class Meta:
        model = Booking
        fields = ['id','customer','customer_name','customer_email','car','car_id','car_details','pickup_at','return_at','pickup_location','return_location','daily_rate','total_price','status','customer_note','admin_note','created_at','updated_at']
        read_only_fields = ['customer','daily_rate','total_price','admin_note','created_at','updated_at']
    def get_customer_name(self, obj): return obj.customer.get_full_name() or obj.customer.username
    def validate(self, attrs):
        start = attrs.get('pickup_at', getattr(self.instance,'pickup_at',None)); end = attrs.get('return_at', getattr(self.instance,'return_at',None)); car = attrs.get('car', getattr(self.instance,'car',None))
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        is_admin = bool(user and user.is_authenticated and (user.is_staff or getattr(getattr(user, 'profile', None), 'role', '') == 'admin'))
        requested_status = attrs.get('status')
        if requested_status and not is_admin and requested_status != 'cancelled':
            raise serializers.ValidationError({'status':'Customers cannot set booking status directly.'})
        if start and end and end <= start: raise serializers.ValidationError({'return_at':'Return date and time must be after pickup.'})
        if start and start < timezone.now(): raise serializers.ValidationError({'pickup_at':'Pickup must be in the future.'})
        if car and car.status != 'available': raise serializers.ValidationError({'car_id':'This vehicle is not available for booking.'})
        if car and start and end:
            conflicts = Booking.objects.filter(car=car, status__in=['pending','confirmed','approved'], pickup_at__lt=end, return_at__gt=start)
            if self.instance: conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists(): raise serializers.ValidationError({'car_id':'This vehicle is already booked for some or all of those dates.'})
        return attrs
    def create(self, validated_data):
        car = validated_data['car']; start=validated_data['pickup_at']; end=validated_data['return_at']
        seconds=(end-start).total_seconds(); days=max(1, int((seconds + 86399)//86400))
        rate=Decimal(car.daily_rate); total=(rate*days).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return Booking.objects.create(**validated_data, daily_rate=rate, total_price=total)
