from rest_framework import viewsets, permissions
from .models import Message
from .serializers import MessageSerializer
class MessageViewSet(viewsets.ModelViewSet):
    serializer_class=MessageSerializer
    permission_classes=[permissions.IsAuthenticated]
    http_method_names=['get','post','patch','head','options']
    def get_queryset(self):
        user=self.request.user
        if user.is_staff or getattr(getattr(user,'profile',None),'role','')=='admin': return Message.objects.select_related('sender','recipient')
        return Message.objects.filter(sender=user) | Message.objects.filter(recipient=user)
    def perform_create(self,serializer): serializer.save(sender=self.request.user)
