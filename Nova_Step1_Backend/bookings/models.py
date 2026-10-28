from django.conf import settings
from django.db import models
class Booking(models.Model):
    STATUS_CHOICES = [('pending','Pending'),('confirmed','Confirmed'),('approved','Approved'),('rejected','Rejected'),('cancelled','Cancelled'),('completed','Completed')]
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='nova_bookings')
    car = models.ForeignKey('cars.Car', on_delete=models.PROTECT, related_name='bookings')
    pickup_at = models.DateTimeField()
    return_at = models.DateTimeField()
    pickup_location = models.CharField(max_length=255, blank=True)
    return_location = models.CharField(max_length=255, blank=True)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    customer_note = models.TextField(blank=True)
    admin_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['car','pickup_at','return_at','status'])]
    def __str__(self): return f'Booking #{self.pk} - {self.car} ({self.status})'
