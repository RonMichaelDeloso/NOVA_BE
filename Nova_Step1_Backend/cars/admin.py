from django.contrib import admin
from .models import Car
@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ('name','brand','vehicle_type','daily_rate','status','seats')
    list_filter = ('status','brand','transmission','fuel')
    search_fields = ('name','brand','plate_number')
