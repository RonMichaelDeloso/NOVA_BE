import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import { pool } from './db.js';
import { requireAuth, requireAdmin, signToken } from './auth.js';
import {
  registerSchema,
  loginSchema,
  bookingSchema,
  carSchema,
  messageSchema,
  settingSchema,
  formatZodError
} from './validation.js';

dotenv.config();

const app = express();

// Security and middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(',').map(s => s.trim()) || 'http://localhost:5173',
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

// Rate limiting on sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Utilities
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const badRequest = (res, message) => res.status(400).json({ message });

function formatDateTime(date, time) {
  return `${date} ${time}:00`;
}

function calculateDaysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return 0;
  return Number((diffMs / 86400000).toFixed(2));
}

const bookingQuerySelect = `
  SELECT b.id,
         b.user_id AS "userId",
         b.vehicle_id AS "vehicleId",
         b.vehicle_id AS "carId",
         u.full_name AS customer,
         u.email,
         v.name AS "vehicleName",
         v.name AS "carName",
         v.brand,
         v.category,
         v.category AS type,
         v.price_per_day AS price,
         b.start_date AS "startDate",
         b.start_date AS "borrowAt",
         b.end_date AS "endDate",
         b.end_date AS "returnAt",
         TO_CHAR(b.start_date, 'YYYY-MM-DD') AS "borrowDate",
         TO_CHAR(b.end_date, 'YYYY-MM-DD') AS "returnDate",
         'Main Office' AS "pickupLocation",
         'Main Office' AS "returnLocation",
         b.total_price AS "totalPrice",
         b.total_price AS "totalAmount",
         b.status,
         b.created_at AS "createdAt"
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  LEFT JOIN vehicles v ON v.id = b.vehicle_id
`;

// ==========================================
// 1. HEALTH CHECK
// ==========================================
app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'nova-rental-api', timestamp: new Date().toISOString() });
}));

// ==========================================
// 2. AUTHENTICATION
// ==========================================
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  const { fullName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing.length) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [fullName, normalizedEmail, passwordHash, 'user']
  );

  const user = { id: result.insertId, fullName, email: normalizedEmail, role: 'user' };
  res.status(201).json({ user, token: signToken(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  const { email, password } = parsed.data;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const userPayload = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role
  };

  res.json({ user: userPayload, token: signToken(userPayload) });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, phone, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  const user = rows[0];
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    createdAt: user.created_at
  });
}));

// ==========================================
// 3. VEHICLES & CARS MANAGEMENT
// ==========================================
app.get(['/api/vehicles', '/api/cars'], requireAuth, asyncRoute(async (req, res) => {
  const { brand, category, status } = req.query;
  let sql = `
    SELECT id, name, category, brand, model, plate_number AS "plateNumber",
           price_per_day AS price, price_per_day AS "pricePerDay",
           status, image_url AS "imageUrl"
    FROM vehicles
    WHERE 1=1
  `;
  const params = [];

  if (brand && brand !== 'Any brand') {
    sql += ' AND brand = ?';
    params.push(brand);
  }
  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND LOWER(status) = LOWER(?)';
    params.push(status);
  }

  sql += ' ORDER BY id';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.get(['/api/vehicles/:id', '/api/cars/:id'], requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, category, brand, model, plate_number AS "plateNumber",
            price_per_day AS price, price_per_day AS "pricePerDay",
            status, image_url AS "imageUrl"
     FROM vehicles WHERE id = ?`,
    [req.params.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ message: 'Vehicle not found.' });
  }
  res.json(rows[0]);
}));

app.post('/api/cars', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = carSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  const c = parsed.data;
  const [result] = await pool.query(
    `INSERT INTO cars (name, brand, type, price_per_day, transmission, seats, fuel, status, icon, tint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.name,
      c.brand,
      c.type,
      c.pricePerDay,
      c.transmission,
      c.seats,
      c.fuel,
      c.status || 'Available',
      c.icon || '🚗',
      c.tint || 'blue'
    ]
  );

  const [rows] = await pool.query('SELECT * FROM cars WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/cars/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = carSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  const c = parsed.data;
  const fields = {
    name: 'name',
    brand: 'brand',
    type: 'type',
    pricePerDay: 'price_per_day',
    transmission: 'transmission',
    seats: 'seats',
    fuel: 'fuel',
    status: 'status',
    icon: 'icon',
    tint: 'tint'
  };

  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(fields)) {
    if (c[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(c[key]);
    }
  }

  if (!sets.length) {
    return badRequest(res, 'No fields provided to update.');
  }

  params.push(req.params.id);
  await pool.query(`UPDATE cars SET ${sets.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.query('SELECT * FROM cars WHERE id = ?', [req.params.id]);
  if (!rows[0]) {
    return res.status(404).json({ message: 'Vehicle not found.' });
  }

  res.json(rows[0]);
}));

app.delete('/api/cars/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM cars WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'Vehicle has active or past bookings and cannot be deleted. You can set its status to Inactive instead.'
      });
    }
    throw err;
  }
}));

// ==========================================
// 4. AVAILABILITY & BOOKINGS
// ==========================================
app.get('/api/bookings/availability', requireAuth, asyncRoute(async (req, res) => {
  const { borrowDate, borrowTime, returnDate, returnTime, brand } = req.query;

  if (!borrowDate || !borrowTime || !returnDate || !returnTime) {
    return badRequest(res, 'Borrow date/time and return date/time are required.');
  }

  const borrowAt = formatDateTime(borrowDate, borrowTime);
  const returnAt = formatDateTime(returnDate, returnTime);
  const totalDays = calculateDaysBetween(borrowAt, returnAt);

  if (totalDays <= 0) {
    return badRequest(res, 'Return date and time must be after borrow date and time.');
  }

  let sql = `
    SELECT c.id, c.name, c.brand, c.type, c.price_per_day AS price,
           c.transmission, c.seats, c.fuel, c.status, c.icon, c.tint
    FROM cars c
    WHERE c.status = 'Available'
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.car_id = c.id
          AND b.status IN ('Pending', 'Confirmed')
          AND b.borrow_at < ? AND b.return_at > ?
      )
  `;
  const params = [returnAt, borrowAt];

  if (brand && brand !== 'Any brand') {
    sql += ' AND c.brand = ?';
    params.push(brand);
  }

  sql += ' ORDER BY c.brand, c.name';
  const [rows] = await pool.query(sql, params);

  res.json({ borrowAt, returnAt, totalDays, cars: rows });
}));

app.post('/api/bookings', requireAuth, asyncRoute(async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  const b = parsed.data;
  const borrowAt = formatDateTime(b.borrowDate, b.borrowTime);
  const returnAt = formatDateTime(b.returnDate, b.returnTime);
  const totalDays = calculateDaysBetween(borrowAt, returnAt);

  if (totalDays <= 0) {
    return badRequest(res, 'Return date and time must be after borrow date and time.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cars] = await conn.query('SELECT * FROM cars WHERE id = ? FOR UPDATE', [b.carId]);
    const car = cars[0];

    if (!car || car.status !== 'Available') {
      await conn.rollback();
      return res.status(409).json({ message: 'This vehicle is currently unavailable.' });
    }

    const [conflicts] = await conn.query(
      `SELECT id FROM bookings
       WHERE car_id = ?
         AND status IN ('Pending', 'Confirmed')
         AND borrow_at < ? AND return_at > ?
       FOR UPDATE`,
      [b.carId, returnAt, borrowAt]
    );

    if (conflicts.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'This vehicle is already booked for the selected schedule.' });
    }

    const totalAmount = Number((Number(car.price_per_day) * totalDays).toFixed(2));

    const [result] = await conn.query(
      `INSERT INTO bookings
       (user_id, car_id, borrow_at, return_at, pickup_location, return_location, total_days, total_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [req.user.id, b.carId, borrowAt, returnAt, b.pickupLocation, b.returnLocation, totalDays, totalAmount, b.notes || null]
    );

    await conn.commit();
    res.status(201).json({
      id: result.insertId,
      status: 'Pending',
      totalDays,
      totalAmount
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.get('/api/bookings/my', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`${bookingQuerySelect} WHERE b.user_id = ? ORDER BY b.created_at DESC`, [req.user.id]);
  res.json(rows);
}));

app.get('/api/bookings', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(`${bookingQuerySelect} ORDER BY b.created_at DESC`);
  res.json(rows);
}));

app.patch('/api/bookings/:id/status', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const allowedStatuses = ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'Rejected'];
  if (!allowedStatuses.includes(req.body.status)) {
    return badRequest(res, `Invalid booking status. Allowed: ${allowedStatuses.join(', ')}`);
  }

  await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [req.body.status, req.params.id]);

  const [rows] = await pool.query(`${bookingQuerySelect} WHERE b.id = ?`, [req.params.id]);
  if (!rows[0]) {
    return res.status(404).json({ message: 'Booking not found.' });
  }

  res.json(rows[0]);
}));

// ==========================================
// 5. MESSAGES
// ==========================================
app.get('/api/messages', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id,
            m.subject,
            m.content,
            m.content AS body,
            m.is_read AS "isRead",
            m.created_at AS "createdAt",
            s.id AS "senderId",
            s.full_name AS "senderName",
            r.id AS "recipientId",
            r.id AS "receiverId",
            r.full_name AS "recipientName",
            r.full_name AS "receiverName"
     FROM messages m
     JOIN users s ON s.id = m.sender_id
     LEFT JOIN users r ON r.id = m.receiver_id
     WHERE m.receiver_id = ? OR m.sender_id = ?
     ORDER BY m.created_at DESC`,
    [req.user.id, req.user.id]
  );
  res.json(rows);
}));

app.post('/api/messages', requireAuth, asyncRoute(async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  const { recipientId, receiverId, subject, body, content } = parsed.data;
  let targetReceiver = receiverId || recipientId || null;

  if (targetReceiver) {
    const [recipientUser] = await pool.query('SELECT id FROM users WHERE id = ?', [targetReceiver]);
    if (!recipientUser.length) {
      return badRequest(res, 'Specified recipient was not found.');
    }
  }

  const messageText = content || body;
  const [result] = await pool.query(
    'INSERT INTO messages (sender_id, receiver_id, subject, content) VALUES (?, ?, ?, ?)',
    [req.user.id, targetReceiver, subject || null, messageText]
  );

  res.status(201).json({ id: result.insertId });
}));

app.patch('/api/messages/:id/read', requireAuth, asyncRoute(async (req, res) => {
  await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ? AND receiver_id = ?', [
    req.params.id,
    req.user.id
  ]);
  res.json({ ok: true });
}));

// ==========================================
// 6. SETTINGS
// ==========================================
app.get('/api/settings', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT setting_key AS `key`, enabled, note FROM settings ORDER BY setting_key');
  res.json(rows);
}));

app.patch('/api/settings/:key', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = settingSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, formatZodError(parsed.error));
  }

  await pool.query('UPDATE settings SET enabled = ? WHERE setting_key = ?', [parsed.data.enabled, req.params.key]);

  const [rows] = await pool.query('SELECT setting_key AS `key`, enabled, note FROM settings WHERE setting_key = ?', [
    req.params.key
  ]);
  if (!rows[0]) {
    return res.status(404).json({ message: 'Setting not found.' });
  }

  res.json(rows[0]);
}));

// ==========================================
// 7. DASHBOARD METRICS
// ==========================================
app.get('/api/dashboard/admin', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const [availableRows] = await pool.query(`SELECT COUNT(*) AS count FROM vehicles WHERE LOWER(status) = 'available'`);
  const [bookingRows] = await pool.query(`SELECT COUNT(*) AS count FROM bookings WHERE LOWER(status) IN ('pending', 'confirmed')`);
  const [revenueRows] = await pool.query(`SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE LOWER(status) IN ('confirmed', 'completed')`);
  const [maintRows] = await pool.query(`SELECT COUNT(*) AS count FROM vehicles WHERE LOWER(status) = 'maintenance'`);
  const [userRows] = await pool.query(`SELECT COUNT(*) AS count FROM users WHERE role = 'user'`);

  const available = availableRows[0] || { count: 0 };
  const bookings = bookingRows[0] || { count: 0 };
  const revenue = revenueRows[0] || { total: 0 };
  const maintenance = maintRows[0] || { count: 0 };
  const totalUsers = userRows[0] || { count: 0 };

  res.json({
    availableCars: Number(available.count),
    availableVehicles: Number(available.count),
    bookings: Number(bookings.count),
    revenue: Number(revenue.total),
    maintenance: Number(maintenance.count),
    totalUsers: Number(totalUsers.count)
  });
}));

app.get('/api/dashboard/user', requireAuth, asyncRoute(async (req, res) => {
  const [upcomingRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM bookings WHERE user_id = ? AND LOWER(status) IN ('pending', 'confirmed') AND start_date >= CURRENT_DATE`,
    [req.user.id]
  );
  const [monthRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM bookings WHERE user_id = ? AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)`,
    [req.user.id]
  );
  const [totalSpentRows] = await pool.query(
    `SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE user_id = ? AND LOWER(status) IN ('confirmed', 'completed')`,
    [req.user.id]
  );

  const upcoming = upcomingRows[0] || { count: 0 };
  const month = monthRows[0] || { count: 0 };
  const spent = totalSpentRows[0] || { total: 0 };

  res.json({
    upcomingRentals: Number(upcoming.count),
    rentalsThisMonth: Number(month.count),
    totalSpent: Number(spent.total)
  });
}));

// ==========================================
// 8. 404 & ERROR HANDLERS
// ==========================================
app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// ==========================================
// 9. STARTUP & SHUTDOWN
// ==========================================
const port = Number(process.env.PORT || 4000);

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@nova.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['System Admin', email, hash, 'admin']
    );
    console.log(`[Nova API] Seeded default admin account: ${email}`);
  }
}

let server;

async function start() {
  await pool.query('SELECT 1');
  await seedAdmin();
  server = app.listen(port, () => {
    console.log(`[Nova API] Server running on http://localhost:${port}`);
  });
}

const gracefulShutdown = async signal => {
  console.log(`[Nova API] Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await pool.end();
      console.log('[Nova API] Connections closed. Process exiting.');
      process.exit(0);
    });
  } else {
    await pool.end();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start().catch(err => {
  console.error('[Nova API] Failed to start server:', err);
  process.exit(1);
});

export default app;
