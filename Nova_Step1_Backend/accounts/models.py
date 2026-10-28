from django.conf import settings
from django.db import models
class UserProfile(models.Model):
    ROLE_CHOICES = [('user','Customer'),('admin','Administrator')]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f'{self.user.email or self.user.username} ({self.role})'
