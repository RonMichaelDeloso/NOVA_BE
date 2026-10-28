from django.contrib import admin
from .models import Booking
@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id','customer','car','pickup_at','return_at','total_price','status','created_at')
    list_filter = ('status','pickup_at')
    search_fields = ('customer__email','car__name','car__brand')
    readonly_fields = ('daily_rate','total_price','created_at','updated_at')
