CREATE DATABASE IF NOT EXISTS nova_rental
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nova_rental;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  phone VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cars (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  type VARCHAR(80) NOT NULL,
  price_per_day DECIMAL(10,2) NOT NULL,
  transmission VARCHAR(40) NOT NULL,
  seats TINYINT UNSIGNED NOT NULL,
  fuel VARCHAR(40) NOT NULL,
  status ENUM('Available','Booked','Maintenance','Inactive') NOT NULL DEFAULT 'Available',
  icon VARCHAR(20) NULL,
  tint VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  car_id BIGINT UNSIGNED NOT NULL,
  borrow_at DATETIME NOT NULL,
  return_at DATETIME NOT NULL,
  pickup_location VARCHAR(255) NOT NULL,
  return_location VARCHAR(255) NOT NULL,
  total_days DECIMAL(8,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('Pending','Confirmed','Cancelled','Completed','Rejected') NOT NULL DEFAULT 'Pending',
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_booking_car FOREIGN KEY (car_id) REFERENCES cars(id),
  INDEX idx_booking_dates (car_id, borrow_at, return_at),
  INDEX idx_booking_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NULL,
  subject VARCHAR(180) NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  CONSTRAINT fk_message_recipient FOREIGN KEY (recipient_id) REFERENCES users(id),
  INDEX idx_message_recipient (recipient_id, created_at)
);

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  note VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO settings(setting_key, enabled, note) VALUES
('auto_confirm_bookings', TRUE, 'Send instant confirmation to customers'),
('document_reminders', TRUE, 'Remind customers before pickup'),
('late_return_alerts', FALSE, 'Notify managers on return issues')
ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);

INSERT INTO cars(name,brand,type,price_per_day,transmission,seats,fuel,status,icon,tint) VALUES
('Mazda 3','Mazda','Compact Sedan',85,'Automatic',5,'Petrol','Available','🚘','blue'),
('Toyota Camry','Toyota','Comfort Sedan',95,'Automatic',5,'Hybrid','Available','🚙','navy'),
('Suzuki Ertiga','Suzuki','Family MPV',80,'Automatic',7,'Petrol','Available','🚙','slate'),
('Honda Civic','Honda','Sport Sedan',105,'Automatic',5,'Petrol','Available','🚗','sky'),
('Nissan X-Trail','Nissan','Luxury SUV',125,'Automatic',7,'Petrol','Available','🚘','blue');
