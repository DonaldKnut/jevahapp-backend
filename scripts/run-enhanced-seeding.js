#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  SCRIPT_PATH: path.join(__dirname, 'enhanced-multi-translation-seeder.js'),
  LOG_FILE: 'enhanced-seeding.log',
  PROGRESS_INTERVAL: 30000, // 30 seconds
  MAX_RUNTIME: 24 * 60 * 60 * 1000, // 24 hours
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  
  try {
    fs.appendFileSync(CONFIG.LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch (error) {
    // Ignore logging errors
  }
}

function showProgress() {
  try {
    if (fs.existsSync('translation-seeding-progress.json')) {
      const progress = JSON.parse(fs.readFileSync('translation-seeding-progress.json', 'utf8'));
      
      log('\n📊 CURRENT PROGRESS:', 'cyan');
      log(`   Current Book: ${progress.currentBook || 'None'}`, 'blue');
      log(`   Current Chapter: ${progress.currentChapter || 'None'}`, 'blue');
      log(`   Total Processed: ${progress.totalProcessed || 0}`, 'blue');
      log(`   Total Added: ${progress.totalAdded || 0}`, 'green');
      log(`   Total Updated: ${progress.totalUpdated || 0}`, 'yellow');
      log(`   Total Skipped: ${progress.totalSkipped || 0}`, 'magenta');
      log(`   Errors: ${progress.errors?.length || 0}`, 'red');
      
      if (progress.translations) {
        log('\n📈 TRANSLATION PROGRESS:', 'cyan');
        for (const [code, data] of Object.entries(progress.translations)) {
          const duration = data.endTime ? 
            Math.round((new Date(data.endTime) - new Date(data.startTime)) / 1000) : 
            Math.round((Date.now() - new Date(data.startTime)) / 1000);
          log(`   ${code}: ${data.booksProcessed}/${data.totalBooks} books (${duration}s)`, 'blue');
        }
      }
    }
  } catch (error) {
    log(`⚠️  Could not read progress: ${error.message}`, 'yellow');
  }
}

function runSeeding() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting enhanced multi-translation seeding...', 'green');
    log(`   Script: ${CONFIG.SCRIPT_PATH}`, 'blue');
    log(`   Log file: ${CONFIG.LOG_FILE}`, 'blue');
    log(`   Max runtime: ${CONFIG.MAX_RUNTIME / 1000 / 60} minutes`, 'blue');
    
    const startTime = Date.now();
    let progressInterval;
    let timeoutId;
    
    // Start the seeding process
    const seeder = spawn('node', [CONFIG.SCRIPT_PATH], {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: __dirname
    });
    
    // Handle stdout
    seeder.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
    });
    
    // Handle stderr
    seeder.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output);
    });
    
    // Set up progress monitoring
    progressInterval = setInterval(() => {
      const runtime = Date.now() - startTime;
      if (runtime > CONFIG.MAX_RUNTIME) {
        log('⏰ Maximum runtime exceeded, stopping seeding...', 'yellow');
        seeder.kill('SIGTERM');
        return;
      }
      
      showProgress();
    }, CONFIG.PROGRESS_INTERVAL);
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      log('⏰ Seeding timeout reached, stopping...', 'yellow');
      seeder.kill('SIGTERM');
    }, CONFIG.MAX_RUNTIME);
    
    // Handle process completion
    seeder.on('close', (code) => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      
      const runtime = Math.round((Date.now() - startTime) / 1000);
      
      if (code === 0) {
        log(`✅ Seeding completed successfully in ${runtime}s!`, 'green');
        showProgress();
        resolve();
      } else {
        log(`❌ Seeding failed with exit code ${code} after ${runtime}s`, 'red');
        reject(new Error(`Seeding process exited with code ${code}`));
      }
    });
    
    // Handle process errors
    seeder.on('error', (error) => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      log(`❌ Seeding process error: ${error.message}`, 'red');
      reject(error);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      log('\n🛑 Received SIGINT, stopping seeding...', 'yellow');
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      seeder.kill('SIGTERM');
      
      setTimeout(() => {
        if (!seeder.killed) {
          seeder.kill('SIGKILL');
        }
        process.exit(0);
      }, 5000);
    });
  });
}

async function main() {
  try {
    // Check if MongoDB URI is set
    if (!process.env.MONGODB_URI) {
      log('⚠️  MONGODB_URI not set, using default localhost', 'yellow');
    }
    
    // Check if progress file exists (resume mode)
    if (fs.existsSync('translation-seeding-progress.json')) {
      log('📂 Found existing progress file, will resume from previous session', 'cyan');
      showProgress();
    }
    
    // Run the seeding
    await runSeeding();
    
    // Run monitoring after completion
    log('\n🔍 Running post-seeding monitoring...', 'cyan');
    const { spawn: spawnMonitor } = require('child_process');
    const monitor = spawnMonitor('node', [path.join(__dirname, 'translation-monitor.js'), 'monitor'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    monitor.on('close', (code) => {
      if (code === 0) {
        log('✅ Monitoring completed successfully!', 'green');
      } else {
        log(`⚠️  Monitoring completed with warnings (exit code ${code})`, 'yellow');
      }
    });
    
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runSeeding, showProgress };




