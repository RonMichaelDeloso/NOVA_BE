from rest_framework.permissions import BasePermission, SAFE_METHODS
class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS: return True
        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or getattr(getattr(user,'profile',None),'role','') == 'admin'))
