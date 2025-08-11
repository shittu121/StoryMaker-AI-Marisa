require('dotenv').config();
const mysql = require('mysql2/promise');

// Database configuration without database name (to create it)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 3306
};

const initDatabase = async () => {
  let connection;

  try {
    console.log('🔌 Connecting to MySQL server...');

    // Connect without specifying database
    connection = await mysql.createConnection(dbConfig);

    const dbName = process.env.DB_NAME || 'storymaker';

    // Create database if it doesn't exist
    console.log(`📦 Creating database '${dbName}' if it doesn't exist...`);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' is ready`);

    // Use the database
    await connection.execute(`USE \`${dbName}\``);

    // Create users table with AUTO_INCREMENT
    console.log('👥 Creating users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        subscription_status ENUM('free', 'premium', 'pro') DEFAULT 'free',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_subscription (subscription_status),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Users table created');

    // Create refresh_tokens table with INT user_id
    console.log('🔄 Creating refresh_tokens table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_token (user_id, token),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Refresh tokens table created');

    // Create user_sessions table with INT user_id
    console.log('🖥️ Creating user_sessions table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id INT NOT NULL,
        session_token VARCHAR(500) NOT NULL,
        device_info TEXT,
        ip_address VARCHAR(45),
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_session (user_id, session_token),
        INDEX idx_last_activity (last_activity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ User sessions table created');

    // Create stories table with INT user_id


    // Create subscription_plans table
    console.log('💳 Creating subscription_plans table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name ENUM('free', 'premium', 'pro') UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0.00,
        story_limit INT DEFAULT 0,
        features JSON,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Subscription plans table created');

    // Insert default subscription plans
    console.log('📋 Inserting default subscription plans...');
    await connection.execute(`
      INSERT IGNORE INTO subscription_plans (name, display_name, description, price, story_limit, features) VALUES
      ('free', 'Free Plan', 'Basic access with limited features', 0.00, 0, '["basic_story_creation", "community_support"]'),
      ('premium', 'Premium Plan', 'Enhanced features for content creators', 9.99, 10, '["unlimited_stories", "advanced_ai", "priority_support", "export_options"]'),
      ('pro', 'Pro Plan', 'Professional features for power users', 19.99, 100, '["unlimited_stories", "advanced_ai", "priority_support", "export_options", "custom_branding", "api_access", "dedicated_support"]')
    `);
    console.log('✅ Default subscription plans inserted');

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📊 Database Summary:');
    console.log(`   Database: ${dbName}`);
    console.log(`   Tables: users, refresh_tokens, user_sessions, stories, subscription_plans`);
    console.log(`   Character Set: utf8mb4`);
    console.log(`   Collation: utf8mb4_unicode_ci`);

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run the initialization
initDatabase(); 