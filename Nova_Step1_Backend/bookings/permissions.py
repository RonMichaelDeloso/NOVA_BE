from rest_framework.permissions import BasePermission
class IsBookingOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        user=request.user
        return bool(user and user.is_authenticated and (user.is_staff or getattr(getattr(user,'profile',None),'role','')=='admin' or obj.customer_id==user.id))
