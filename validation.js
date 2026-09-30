import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(120),
  email: z.string().trim().email('Please enter a valid email address.').max(190),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72)
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(72)
});

export const bookingSchema = z.object({
  carId: z.coerce.number().int().positive('Car ID must be a valid positive number.'),
  borrowDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Borrow date format must be YYYY-MM-DD.'),
  borrowTime: z.string().regex(/^\d{2}:\d{2}$/, 'Borrow time format must be HH:MM.'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Return date format must be YYYY-MM-DD.'),
  returnTime: z.string().regex(/^\d{2}:\d{2}$/, 'Return time format must be HH:MM.'),
  pickupLocation: z.string().trim().min(2, 'Pickup location is required.').max(255),
  returnLocation: z.string().trim().min(2, 'Return location is required.').max(255),
  notes: z.string().trim().max(500).optional()
});

export const carSchema = z.object({
  name: z.string().trim().min(2, 'Vehicle name is required.').max(120),
  brand: z.string().trim().min(2, 'Brand is required.').max(80),
  type: z.string().trim().min(2, 'Type is required.').max(80),
  pricePerDay: z.coerce.number().positive('Price per day must be a positive number.'),
  transmission: z.string().trim().min(2, 'Transmission is required.').max(40),
  seats: z.coerce.number().int().min(1).max(20),
  fuel: z.string().trim().min(2, 'Fuel type is required.').max(40),
  status: z.enum(['Available', 'Booked', 'Maintenance', 'Inactive']).optional(),
  icon: z.string().max(20).optional(),
  tint: z.string().max(30).optional()
});

export const messageSchema = z.object({
  recipientId: z.coerce.number().int().positive().nullable().optional(),
  subject: z.string().trim().max(180).optional(),
  body: z.string().trim().min(1, 'Message body is required.')
});

export const settingSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled must be a boolean.' })
});

export function formatZodError(error) {
  if (!error?.errors?.length) return 'Validation failed.';
  return error.errors[0].message;
}
