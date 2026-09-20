import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  password: z.string().min(8).max(72)
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72)
});

export const bookingSchema = z.object({
  carId: z.coerce.number().int().positive(),
  borrowDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  borrowTime: z.string().regex(/^\d{2}:\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnTime: z.string().regex(/^\d{2}:\d{2}$/),
  pickupLocation: z.string().trim().min(2).max(255),
  returnLocation: z.string().trim().min(2).max(255),
  notes: z.string().trim().max(500).optional()
});

export const carSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brand: z.string().trim().min(2).max(80),
  type: z.string().trim().min(2).max(80),
  pricePerDay: z.coerce.number().positive(),
  transmission: z.string().trim().min(2).max(40),
  seats: z.coerce.number().int().min(1).max(20),
  fuel: z.string().trim().min(2).max(40),
  status: z.enum(['Available','Booked','Maintenance','Inactive']).optional(),
  icon: z.string().max(20).optional(),
  tint: z.string().max(30).optional()
});
