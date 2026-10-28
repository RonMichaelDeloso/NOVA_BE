from django.contrib import admin
from .models import Message
@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display=('id','sender','recipient','subject','is_read','created_at')
    list_filter=('is_read','created_at')
    search_fields=('sender__email','recipient__email','subject','body')
