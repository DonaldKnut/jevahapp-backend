#!/usr/bin/env node

/**
 * Cleanup temporary files script
 * Runs daily to clean up temporary files and old uploads
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// Configuration
const TEMP_DIRS = [
  './temp-recordings',
  './uploads/temp',
  './logs/temp'
];

const MAX_AGE_HOURS = 24; // Files older than 24 hours will be deleted
const MAX_FILE_SIZE_MB = 100; // Files larger than 100MB will be deleted

async function cleanupTempFiles() {
  logger.info('Starting temporary files cleanup...');
  
  let totalFilesDeleted = 0;
  let totalSizeFreed = 0;
  
  for (const dir of TEMP_DIRS) {
    try {
      if (!fs.existsSync(dir)) {
        logger.info(`Directory ${dir} does not exist, skipping...`);
        continue;
      }
      
      const files = fs.readdirSync(dir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        // Check if file is older than MAX_AGE_HOURS
        const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
        const sizeMB = stats.size / (1024 * 1024);
        
        if (ageHours > MAX_AGE_HOURS || sizeMB > MAX_FILE_SIZE_MB) {
          try {
            fs.unlinkSync(filePath);
            totalFilesDeleted++;
            totalSizeFreed += stats.size;
            
            logger.info(`Deleted file: ${filePath} (age: ${ageHours.toFixed(1)}h, size: ${sizeMB.toFixed(1)}MB)`);
          } catch (error) {
            logger.error(`Failed to delete file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Error processing directory ${dir}:`, error);
    }
  }
  
  logger.info(`Cleanup completed. Deleted ${totalFilesDeleted} files, freed ${(totalSizeFreed / (1024 * 1024)).toFixed(2)}MB`);
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupTempFiles()
    .then(() => {
      logger.info('Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupTempFiles;
