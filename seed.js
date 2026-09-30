import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { rawPool, pool } from './db.js';

dotenv.config();

async function runSeed() {
    console.log('🌱 Starting PostgreSQL database seeding process...');

    try {
        console.log('📄 Ensuring database tables exist in PostgreSQL...');
        await rawPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        phone VARCHAR(40),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        type VARCHAR(100) NOT NULL,
        price_per_day NUMERIC(10, 2) NOT NULL,
        transmission VARCHAR(40) DEFAULT 'Automatic',
        seats SMALLINT DEFAULT 5,
        fuel VARCHAR(40) DEFAULT 'Gasoline',
        status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Booked', 'Maintenance', 'Inactive')),
        icon VARCHAR(50),
        tint VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        car_id INTEGER REFERENCES cars(id) ON DELETE RESTRICT,
        borrow_at TIMESTAMP NOT NULL,
        return_at TIMESTAMP NOT NULL,
        pickup_location VARCHAR(255) NOT NULL,
        return_location VARCHAR(255) NOT NULL,
        total_days NUMERIC(8, 2) NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Ongoing', 'Completed', 'Cancelled', 'Declined')),
        notes TEXT,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        subject VARCHAR(255),
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        note VARCHAR(255)
      );
    `);

        console.log('✅ Tables verified in PostgreSQL.');

        // Seed default admin account
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@nova.com').toLowerCase().trim();
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        const [existingAdmin] = await pool.query('SELECT id, email FROM users WHERE email = ?', [adminEmail]);
        const passwordHash = await bcrypt.hash(adminPassword, 12);

        if (!existingAdmin.length) {
            await pool.query(
                'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['System Admin', adminEmail, passwordHash, 'admin']
            );
            console.log(`👤 Admin user created: ${adminEmail} (password: ${adminPassword})`);
        } else {
            await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, adminEmail]);
            console.log(`ℹ️ Admin user exists: ${adminEmail} (password synchronized: ${adminPassword})`);
        }

        // Seed sample cars if table is empty
        const [existingCars] = await pool.query('SELECT id FROM cars LIMIT 1');
        if (!existingCars.length) {
            const sampleCars = [
                ['Apex GT', 'Nova', 'Sports Coupe', 12000.00, 'Automatic', 2, 'Premium Gasoline', 'Available', 'fa-bolt', '#3b82f6'],
                ['Solaris EV', 'Nova', 'Electric Sedan', 8500.00, 'Automatic', 5, 'Electric', 'Available', 'fa-car', '#10b981'],
                ['Terra SUV', 'Nova', 'Luxury SUV', 9500.00, 'Automatic', 7, 'Diesel', 'Available', 'fa-shield-halved', '#f59e0b'],
                ['Phantom Black', 'Nova', 'Executive Sedan', 15000.00, 'Automatic', 5, 'Premium Gasoline', 'Available', 'fa-gem', '#8b5cf6']
            ];

            for (const car of sampleCars) {
                await pool.query(
                    'INSERT INTO cars (name, brand, type, price_per_day, transmission, seats, fuel, status, icon, tint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    car
                );
            }
            console.log('🚗 Seeded sample vehicle fleet.');
        }

        console.log('✨ PostgreSQL database seeding completed successfully.');
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runSeed();
