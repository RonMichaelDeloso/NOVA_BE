from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import UserProfile
from cars.models import Car
User=get_user_model()
class Command(BaseCommand):
    help='Create local demo users and starter vehicle records.'
    def handle(self,*args,**options):
        admin,created=User.objects.get_or_create(username='admin@nova.local', defaults={'email':'admin@nova.local','first_name':'Nova Admin','is_staff':True,'is_superuser':True})
        if created: admin.set_password('ChangeMe123!'); admin.save()
        profile,_=UserProfile.objects.get_or_create(user=admin, defaults={'role':'admin'}); profile.role='admin'; profile.save()
        demo,created=User.objects.get_or_create(username='demo@nova.local', defaults={'email':'demo@nova.local','first_name':'Demo Customer'})
        if created: demo.set_password('ChangeMe123!'); demo.save()
        UserProfile.objects.get_or_create(user=demo, defaults={'role':'user'})
        cars=[('Mazda 3','Mazda','Compact Sedan','85','Automatic',5,'Petrol'),('Toyota Camry','Toyota','Comfort Sedan','95','Automatic',5,'Hybrid'),('Suzuki Ertiga','Suzuki','Family MPV','80','Automatic',7,'Petrol'),('Honda Civic','Honda','Sport Sedan','105','Automatic',5,'Petrol'),('Nissan X-Trail','Nissan','Luxury SUV','125','Automatic',7,'Petrol')]
        for name,brand,typ,rate,trans,seats,fuel in cars:
            Car.objects.get_or_create(name=name, brand=brand, defaults={'vehicle_type':typ,'daily_rate':rate,'transmission':trans,'seats':seats,'fuel':fuel,'status':'available'})
        self.stdout.write(self.style.SUCCESS('Seeded Nova demo users and cars. Change demo passwords before using outside local development.'))
