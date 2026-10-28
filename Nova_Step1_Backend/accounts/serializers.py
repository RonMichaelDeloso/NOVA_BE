from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile
User = get_user_model()
class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    fullName = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ['id','username','email','first_name','last_name','fullName','role']
    def get_role(self, obj):
        return getattr(getattr(obj,'profile',None),'role','admin' if obj.is_staff else 'user')
    def get_fullName(self, obj): return obj.get_full_name() or obj.username
class RegisterSerializer(serializers.Serializer):
    fullName = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists(): raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()
    def validate_password(self, value): validate_password(value); return value
    def create(self, validated_data):
        name = validated_data['fullName'].strip()
        email = validated_data['email']
        user = User.objects.create_user(username=email, email=email, password=validated_data['password'], first_name=name[:150])
        UserProfile.objects.create(user=user, role='user')
        return user
class NovaTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD
    def validate(self, attrs):
        attrs[self.username_field] = attrs.get(self.username_field, '').lower()
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
