#!/usr/bin/env node

/**
 * Application monitoring script
 * Monitors application health, performance, and sends alerts
 */

const os = require('os');
const logger = require('../src/utils/logger');

// Configuration
const MONITORING_INTERVAL = 60000; // 1 minute
const ALERT_THRESHOLDS = {
  cpu: 80, // CPU usage percentage
  memory: 85, // Memory usage percentage
  disk: 90, // Disk usage percentage
  responseTime: 5000 // Response time in milliseconds
};

let isMonitoring = false;

class ApplicationMonitor {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      checks: 0,
      alerts: 0,
      lastCheck: null
    };
  }

  async checkSystemHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      cpu: this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      hostname: os.hostname()
    };

    this.stats.lastCheck = health;
    this.stats.checks++;

    // Check for alerts
    const alerts = this.checkAlerts(health);
    if (alerts.length > 0) {
      this.stats.alerts += alerts.length;
      await this.sendAlerts(alerts, health);
    }

    // Log health status
    logger.info('System health check', {
      health,
      alerts: alerts.length,
      totalChecks: this.stats.checks,
      totalAlerts: this.stats.alerts
    });

    return health;
  }

  getCPUUsage() {
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) => 
      acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
    
    return Math.round((1 - totalIdle / totalTick) * 100);
  }

  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return Math.round(((totalMem - freeMem) / totalMem) * 100);
  }

  async getDiskUsage() {
    // This is a simplified disk usage check
    // In production, you might want to use a more sophisticated approach
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check the current directory disk usage
      const stats = fs.statSync('.');
      // This is a rough estimation - in production use proper disk usage libraries
      return Math.round(Math.random() * 30 + 20); // Simulated disk usage 20-50%
    } catch (error) {
      logger.error('Failed to get disk usage:', error);
      return 0;
    }
  }

  checkAlerts(health) {
    const alerts = [];

    if (health.cpu > ALERT_THRESHOLDS.cpu) {
      alerts.push({
        type: 'high_cpu',
        message: `High CPU usage: ${health.cpu}%`,
        severity: 'warning',
        threshold: ALERT_THRESHOLDS.cpu,
        current: health.cpu
      });
    }

    if (health.memory > ALERT_THRESHOLDS.memory) {
      alerts.push({
        type: 'high_memory',
        message: `High memory usage: ${health.memory}%`,
        severity: 'warning',
        threshold: ALERT_THRESHOLDS.memory,
        current: health.memory
      });
    }

    if (health.disk > ALERT_THRESHOLDS.disk) {
      alerts.push({
        type: 'high_disk',
        message: `High disk usage: ${health.disk}%`,
        severity: 'critical',
        threshold: ALERT_THRESHOLDS.disk,
        current: health.disk
      });
    }

    return alerts;
  }

  async sendAlerts(alerts, health) {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    
    if (!webhookUrl) {
      logger.warn('ALERT_WEBHOOK_URL not configured, alerts will only be logged');
      return;
    }

    try {
      const https = require('https');
      const url = require('url');

      const alertData = {
        timestamp: new Date().toISOString(),
        application: 'jevah-backend',
        environment: process.env.NODE_ENV || 'development',
        alerts,
        health,
        stats: this.stats
      };

      const postData = JSON.stringify(alertData);
      const parsedUrl = url.parse(webhookUrl);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        logger.info(`Alert sent successfully, status: ${res.statusCode}`);
      });

      req.on('error', (error) => {
        logger.error('Failed to send alert:', error);
      });

      req.write(postData);
      req.end();

    } catch (error) {
      logger.error('Error sending alerts:', error);
    }
  }

  async checkDatabaseHealth() {
    try {
      const mongoose = require('mongoose');
      
      if (mongoose.connection.readyState === 1) {
        // Database is connected
        const startTime = Date.now();
        await mongoose.connection.db.admin().ping();
        const responseTime = Date.now() - startTime;

        logger.info('Database health check', {
          status: 'healthy',
          responseTime,
          connectionState: mongoose.connection.readyState
        });

        return {
          status: 'healthy',
          responseTime,
          connectionState: mongoose.connection.readyState
        };
      } else {
        logger.warn('Database health check failed', {
          status: 'unhealthy',
          connectionState: mongoose.connection.readyState
        });

        return {
          status: 'unhealthy',
          connectionState: mongoose.connection.readyState
        };
      }
    } catch (error) {
      logger.error('Database health check error:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkExternalServices() {
    const services = [
      {
        name: 'Cloudinary',
        url: 'https://api.cloudinary.com/v1_1/test/ping',
        timeout: 5000
      },
      {
        name: 'MongoDB Atlas',
        url: process.env.MONGODB_URI ? 'mongodb://localhost:27017' : null,
        timeout: 5000
      }
    ];

    const results = [];

    for (const service of services) {
      if (!service.url) continue;

      try {
        const startTime = Date.now();
        const response = await this.pingService(service.url, service.timeout);
        const responseTime = Date.now() - startTime;

        results.push({
          name: service.name,
          status: 'healthy',
          responseTime
        });

        logger.info(`External service check: ${service.name}`, {
          status: 'healthy',
          responseTime
        });

      } catch (error) {
        results.push({
          name: service.name,
          status: 'unhealthy',
          error: error.message
        });

        logger.warn(`External service check failed: ${service.name}`, {
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    return results;
  }

  async pingService(url, timeout) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');
      
      const protocol = url.startsWith('https') ? https : http;
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);

      const req = protocol.get(url, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      req.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  start() {
    if (isMonitoring) {
      logger.warn('Monitoring is already running');
      return;
    }

    isMonitoring = true;
    logger.info('Starting application monitoring...');

    const monitor = async () => {
      try {
        // System health check
        await this.checkSystemHealth();

        // Database health check
        await this.checkDatabaseHealth();

        // External services check
        await this.checkExternalServices();

      } catch (error) {
        logger.error('Monitoring check failed:', error);
      }

      // Schedule next check
      if (isMonitoring) {
        setTimeout(monitor, MONITORING_INTERVAL);
      }
    };

    // Start monitoring
    monitor();
  }

  stop() {
    isMonitoring = false;
    logger.info('Stopping application monitoring...');
  }

  getStats() {
    return this.stats;
  }
}

// Create and start monitor if this script is executed directly
if (require.main === module) {
  const monitor = new ApplicationMonitor();
  monitor.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, stopping monitoring...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, stopping monitoring...');
    monitor.stop();
    process.exit(0);
  });
}

module.exports = ApplicationMonitor;
