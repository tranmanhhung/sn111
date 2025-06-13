/* eslint-disable no-console */
import chalk from 'chalk';
import time from '#modules/time/index.js';

/**
 * Log a message with a timestamp and green color
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments to log
 */
function info(message, ...arguments_) {
  const timestamp = time.getCurrentTimestamp();
  console.log(chalk.green(`${timestamp} [INFO] ${message}`), ...arguments_);
}

/**
 * Log a message with a timestamp and yellow color
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments to log
 */
function warning(message, ...arguments_) {
  const timestamp = time.getCurrentTimestamp();
  console.log(chalk.yellow(`${timestamp} [WARNING] ${message}`), ...arguments_);
}

/**
 * Alias for warning function
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments to log
 */
function warn(message, ...arguments_) {
  warning(message, ...arguments_);
}

/**
 * Log a debug message with a timestamp and gray color
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments to log
 */
function debug(message, ...arguments_) {
  const timestamp = time.getCurrentTimestamp();
  console.log(chalk.gray(`${timestamp} [DEBUG] ${message}`), ...arguments_);
}

/**
 * Log a message with a timestamp and red color
 * @param {string} message - The message to log
 * @param {...any} args - Additional arguments to log
 */
function error(message, ...arguments_) {
  const timestamp = time.getCurrentTimestamp();
  console.error(chalk.red(`${timestamp} [ERROR] ${message}`), ...arguments_);
}

export default {
  info,
  warning,
  warn,
  debug,
  error
};
