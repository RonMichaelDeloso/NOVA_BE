from rest_framework import serializers
from .models import Car
class CarSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source='vehicle_type', required=False, allow_blank=True)
    price = serializers.DecimalField(source='daily_rate', max_digits=10, decimal_places=2, required=False)
    class Meta:
        model = Car
        fields = ['id','name','brand','type','vehicle_type','price','daily_rate','transmission','seats','fuel','image_url','description','status','plate_number','created_at','updated_at']
