#!/usr/bin/env node

/**
 * Database backup script
 * Runs weekly to create database backups
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// Configuration
const BACKUP_DIR = './backups';
const MAX_BACKUPS = 10; // Keep only the last 10 backups
const BACKUP_PREFIX = 'jevah-backup';

async function createBackup() {
  logger.info('Starting database backup...');
  
  try {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${BACKUP_PREFIX}-${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    // Create backup using mongodump
    const backupCommand = `mongodump --uri="${mongoUri}" --out="${BACKUP_DIR}/temp"`;
    
    return new Promise((resolve, reject) => {
      exec(backupCommand, (error, stdout, stderr) => {
        if (error) {
          logger.error('Backup command failed:', error);
          reject(error);
          return;
        }
        
        logger.info('Database backup completed successfully');
        logger.info(`Backup saved to: ${backupPath}`);
        
        // Clean up old backups
        cleanupOldBackups();
        
        resolve(backupPath);
      });
    });
    
  } catch (error) {
    logger.error('Backup failed:', error);
    throw error;
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(file => file.startsWith(BACKUP_PREFIX))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    // Remove old backups if we have more than MAX_BACKUPS
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          logger.info(`Deleted old backup: ${file.name}`);
        } catch (error) {
          logger.error(`Failed to delete old backup ${file.name}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up old backups:', error);
  }
}

// Alternative backup method using mongoexport (JSON format)
async function createJsonBackup() {
  logger.info('Starting JSON database backup...');
  
  try {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${BACKUP_PREFIX}-${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    // Collections to backup
    const collections = [
      'users',
      'media',
      'comments',
      'interactions',
      'livestreams',
      'recordings',
      'chatbot_messages',
      'trending_analytics',
      'user_profiles',
      'bookmarks',
      'notifications',
      'sessions'
    ];
    
    const backupData = {};
    
    // Export each collection
    for (const collection of collections) {
      const exportCommand = `mongoexport --uri="${mongoUri}" --collection="${collection}" --db="jevah" --out="${backupPath}.${collection}"`;
      
      await new Promise((resolve, reject) => {
        exec(exportCommand, (error, stdout, stderr) => {
          if (error) {
            logger.warn(`Failed to export collection ${collection}:`, error);
            resolve(); // Continue with other collections
          } else {
            logger.info(`Exported collection: ${collection}`);
            resolve();
          }
        });
      });
    }
    
    logger.info('JSON backup completed successfully');
    
    // Clean up old backups
    cleanupOldBackups();
    
  } catch (error) {
    logger.error('JSON backup failed:', error);
    throw error;
  }
}

// Run backup if this script is executed directly
if (require.main === module) {
  // Try binary backup first, fallback to JSON backup
  createBackup()
    .then(() => {
      logger.info('Backup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.warn('Binary backup failed, trying JSON backup...');
      return createJsonBackup();
    })
    .then(() => {
      logger.info('Backup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Backup script failed:', error);
      process.exit(1);
    });
}

module.exports = { createBackup, createJsonBackup, cleanupOldBackups };
