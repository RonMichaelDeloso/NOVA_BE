from django.db import models
class Car(models.Model):
    STATUS_CHOICES = [('available','Available'),('maintenance','Maintenance'),('inactive','Inactive')]
    name = models.CharField(max_length=120)
    brand = models.CharField(max_length=80)
    vehicle_type = models.CharField(max_length=80, blank=True)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2)
    transmission = models.CharField(max_length=30, default='Automatic')
    seats = models.PositiveSmallIntegerField(default=5)
    fuel = models.CharField(max_length=30, default='Petrol')
    image_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    plate_number = models.CharField(max_length=20, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta: ordering = ['brand','name']
    def __str__(self): return f'{self.brand} {self.name}'
