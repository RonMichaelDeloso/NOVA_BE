import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { requireAuth, requireAdmin, signToken } from './auth.js';
import { registerSchema, loginSchema, bookingSchema, carSchema } from './validation.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(',').map(s => s.trim()) || 'http://localhost:5173'
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, message) => res.status(400).json({ message });

function dt(date, time) {
  return `${date} ${time}:00`;
}

function daysBetween(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms / 86400000;
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'nova-rental-api' });
}));

// ---------- AUTH ----------
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Please provide a valid name, email and password of at least 8 characters.');

  const { fullName, email, password } = parsed.data;
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing.length) return res.status(409).json({ message: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    'INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',
    [fullName, email.toLowerCase(), passwordHash, 'user']
  );

  const user = { id: result.insertId, full_name: fullName, email: email.toLowerCase(), role: 'user' };
  res.status(201).json({ user: { id: user.id, fullName, email: user.email, role: user.role }, token: signToken(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Invalid email or password.');

  const { email, password } = parsed.data;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.json({
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    token: signToken(user)
  });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, phone, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'User not found.' });
  const u = rows[0];
  res.json({ id: u.id, fullName: u.full_name, email: u.email, role: u.role, phone: u.phone, createdAt: u.created_at });
}));

// ---------- CARS ----------
app.get('/api/cars', requireAuth, asyncRoute(async (req, res) => {
  const { brand, status } = req.query;
  let sql = 'SELECT id,name,brand,type,price_per_day AS price,transmission,seats,fuel,status,icon,tint FROM cars WHERE 1=1';
  const params = [];
  if (brand && brand !== 'Any brand') { sql += ' AND brand = ?'; params.push(brand); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY brand, name';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.get('/api/cars/:id', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT id,name,brand,type,price_per_day AS price,transmission,seats,fuel,status,icon,tint FROM cars WHERE id=?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Vehicle not found.' });
  res.json(rows[0]);
}));

app.post('/api/cars', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = carSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Invalid vehicle data.');
  const c = parsed.data;
  const [result] = await pool.query(
    `INSERT INTO cars(name,brand,type,price_per_day,transmission,seats,fuel,status,icon,tint)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [c.name,c.brand,c.type,c.pricePerDay,c.transmission,c.seats,c.fuel,c.status || 'Available',c.icon || '🚗',c.tint || 'blue']
  );
  const [rows] = await pool.query('SELECT * FROM cars WHERE id=?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/cars/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = carSchema.partial().safeParse(req.body);
  if (!parsed.success) return bad(res, 'Invalid vehicle data.');
  const c = parsed.data;
  const fields = {
    name:'name', brand:'brand', type:'type', pricePerDay:'price_per_day',
    transmission:'transmission', seats:'seats', fuel:'fuel', status:'status',
    icon:'icon', tint:'tint'
  };
  const sets = [], params = [];
  for (const [key, column] of Object.entries(fields)) {
    if (c[key] !== undefined) { sets.push(`${column}=?`); params.push(c[key]); }
  }
  if (!sets.length) return bad(res, 'No fields to update.');
  params.push(req.params.id);
  await pool.query(`UPDATE cars SET ${sets.join(', ')} WHERE id=?`, params);
  const [rows] = await pool.query('SELECT * FROM cars WHERE id=?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Vehicle not found.' });
  res.json(rows[0]);
}));

app.delete('/api/cars/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  try {
    await pool.query('DELETE FROM cars WHERE id=?', [req.params.id]);
    res.status(204).end();
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'Vehicle has booking history and cannot be deleted. Set it inactive instead.' });
    throw e;
  }
}));

// ---------- AVAILABILITY ----------
app.get('/api/bookings/availability', requireAuth, asyncRoute(async (req, res) => {
  const { borrowDate, borrowTime, returnDate, returnTime, brand } = req.query;
  if (!borrowDate || !borrowTime || !returnDate || !returnTime) return bad(res, 'Borrow and return date/time are required.');

  const borrowAt = dt(borrowDate, borrowTime);
  const returnAt = dt(returnDate, returnTime);
  const days = daysBetween(borrowAt, returnAt);
  if (!(days > 0)) return bad(res, 'Return date/time must be after the borrow date/time.');

  let sql = `
    SELECT c.id,c.name,c.brand,c.type,c.price_per_day AS price,c.transmission,c.seats,c.fuel,c.status,c.icon,c.tint
    FROM cars c
    WHERE c.status = 'Available'
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.car_id = c.id
          AND b.status IN ('Pending','Confirmed')
          AND b.borrow_at < ? AND b.return_at > ?
      )`;
  const params = [returnAt, borrowAt];
  if (brand && brand !== 'Any brand') { sql += ' AND c.brand=?'; params.push(brand); }
  sql += ' ORDER BY c.brand,c.name';
  const [rows] = await pool.query(sql, params);
  res.json({ borrowAt, returnAt, cars: rows });
}));

// ---------- BOOKINGS ----------
app.post('/api/bookings', requireAuth, asyncRoute(async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Invalid booking details.');
  const b = parsed.data;
  const borrowAt = dt(b.borrowDate, b.borrowTime);
  const returnAt = dt(b.returnDate, b.returnTime);
  const totalDays = daysBetween(borrowAt, returnAt);
  if (!(totalDays > 0)) return bad(res, 'Return date/time must be after borrow date/time.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cars] = await conn.query('SELECT * FROM cars WHERE id=? FOR UPDATE', [b.carId]);
    const car = cars[0];
    if (!car || car.status !== 'Available') {
      await conn.rollback();
      return res.status(409).json({ message: 'This vehicle is not available.' });
    }

    const [conflicts] = await conn.query(
      `SELECT id FROM bookings
       WHERE car_id=? AND status IN ('Pending','Confirmed')
       AND borrow_at < ? AND return_at > ?
       FOR UPDATE`,
      [b.carId, returnAt, borrowAt]
    );
    if (conflicts.length) {
      await conn.rollback();
      return res.status(409).json({ message: 'This vehicle has already been booked for part of that period.' });
    }

    const totalAmount = Number(car.price_per_day) * totalDays;
    const [result] = await conn.query(
      `INSERT INTO bookings
       (user_id,car_id,borrow_at,return_at,pickup_location,return_location,total_days,total_amount,status,notes)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id,b.carId,borrowAt,returnAt,b.pickupLocation,b.returnLocation,totalDays,totalAmount,'Pending',b.notes || null]
    );

    await conn.commit();
    res.status(201).json({ id: result.insertId, status: 'Pending', totalDays, totalAmount });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

const bookingSelect = `
  SELECT b.id,b.user_id AS userId,b.car_id AS carId,
         u.full_name AS customer,u.email,
         c.name AS carName,c.brand,c.type,c.price_per_day AS price,
         b.borrow_at AS borrowAt,b.return_at AS returnAt,
         DATE_FORMAT(b.borrow_at,'%Y-%m-%d') AS borrowDate,
         DATE_FORMAT(b.borrow_at,'%H:%i') AS borrowTime,
         DATE_FORMAT(b.return_at,'%Y-%m-%d') AS returnDate,
         DATE_FORMAT(b.return_at,'%H:%i') AS returnTime,
         b.pickup_location AS pickupLocation,b.return_location AS returnLocation,
         b.total_days AS totalDays,b.total_amount AS totalAmount,b.status,b.notes,b.created_at AS createdAt
  FROM bookings b
  JOIN users u ON u.id=b.user_id
  JOIN cars c ON c.id=b.car_id
`;

app.get('/api/bookings/my', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`${bookingSelect} WHERE b.user_id=? ORDER BY b.created_at DESC`, [req.user.id]);
  res.json(rows);
}));

app.get('/api/bookings', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`${bookingSelect} ORDER BY b.created_at DESC`);
  res.json(rows);
}));

app.patch('/api/bookings/:id/status', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const allowed = ['Pending','Confirmed','Cancelled','Completed','Rejected'];
  if (!allowed.includes(req.body.status)) return bad(res, 'Invalid booking status.');

  await pool.query('UPDATE bookings SET status=? WHERE id=?', [req.body.status, req.params.id]);
  const [rows] = await pool.query(`${bookingSelect} WHERE b.id=?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Booking not found.' });
  res.json(rows[0]);
}));

// ---------- MESSAGES ----------
app.get('/api/messages', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id,m.subject,m.body,m.is_read AS isRead,m.created_at AS createdAt,
            s.id AS senderId,s.full_name AS senderName,
            r.id AS recipientId,r.full_name AS recipientName
     FROM messages m
     JOIN users s ON s.id=m.sender_id
     LEFT JOIN users r ON r.id=m.recipient_id
     WHERE m.recipient_id=? OR m.sender_id=?
     ORDER BY m.created_at DESC`,
    [req.user.id, req.user.id]
  );
  res.json(rows);
}));

app.post('/api/messages', requireAuth, asyncRoute(async (req, res) => {
  const { recipientId, subject, body } = req.body;
  if (!body || typeof body !== 'string' || body.trim().length < 1) return bad(res, 'Message body is required.');

  let recipient = recipientId || null;
  if (recipient) {
    const [u] = await pool.query('SELECT id FROM users WHERE id=?', [recipient]);
    if (!u.length) return bad(res, 'Recipient not found.');
  }
  const [result] = await pool.query(
    'INSERT INTO messages(sender_id,recipient_id,subject,body) VALUES(?,?,?,?)',
    [req.user.id, recipient, subject || null, body.trim()]
  );
  res.status(201).json({ id: result.insertId });
}));

app.patch('/api/messages/:id/read', requireAuth, asyncRoute(async (req, res) => {
  await pool.query('UPDATE messages SET is_read=TRUE WHERE id=? AND recipient_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- SETTINGS ----------
app.get('/api/settings', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT setting_key AS `key`,enabled,note FROM settings ORDER BY setting_key');
  res.json(rows);
}));

app.patch('/api/settings/:key', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (typeof req.body.enabled !== 'boolean') return bad(res, 'enabled must be boolean.');
  await pool.query('UPDATE settings SET enabled=? WHERE setting_key=?', [req.body.enabled, req.params.key]);
  const [rows] = await pool.query('SELECT setting_key AS `key`,enabled,note FROM settings WHERE setting_key=?', [req.params.key]);
  if (!rows[0]) return res.status(404).json({ message: 'Setting not found.' });
  res.json(rows[0]);
}));

// ---------- DASHBOARD ----------
app.get('/api/dashboard/admin', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const [[available]] = await pool.query(`SELECT COUNT(*) AS count FROM cars WHERE status='Available'`);
  const [[bookings]] = await pool.query(`SELECT COUNT(*) AS count FROM bookings WHERE status IN ('Pending','Confirmed')`);
  const [[revenue]] = await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM bookings WHERE status IN ('Confirmed','Completed')`);
  const [[maintenance]] = await pool.query(`SELECT COUNT(*) AS count FROM cars WHERE status='Maintenance'`);
  res.json({
    availableCars: Number(available.count),
    bookings: Number(bookings.count),
    revenue: Number(revenue.total),
    maintenance: Number(maintenance.count)
  });
}));

app.get('/api/dashboard/user', requireAuth, asyncRoute(async (req, res) => {
  const [[upcoming]] = await pool.query(
    `SELECT COUNT(*) AS count FROM bookings WHERE user_id=? AND status IN ('Pending','Confirmed') AND borrow_at >= NOW()`,
    [req.user.id]
  );
  const [[month]] = await pool.query(
    `SELECT COUNT(*) AS count FROM bookings WHERE user_id=? AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())`,
    [req.user.id]
  );
  res.json({ upcomingRentals: Number(upcoming.count), rentalsThisMonth: Number(month.count) });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

const port = Number(process.env.PORT || 4000);

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@nova.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const [rows] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',
      ['System Admin', email, hash, 'admin']
    );
    console.log(`Seeded admin account: ${email}`);
  }
}

async function start() {
  await pool.query('SELECT 1');
  await seedAdmin();
  app.listen(port, () => console.log(`Nova API running on http://localhost:${port}`));
}

start().catch(err => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
