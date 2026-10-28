from rest_framework import serializers
from .models import Message
class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True)
    class Meta:
        model=Message
        fields=['id','sender','sender_name','recipient','recipient_email','subject','body','is_read','created_at']
        read_only_fields=['sender','is_read','created_at']
    def get_sender_name(self,obj): return obj.sender.get_full_name() or obj.sender.username
