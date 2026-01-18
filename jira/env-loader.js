/**
 * Load jira.env from project root
 * 
 * Expected location: jira-assist/jira.env
 */

const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../jira.env');
dotenv.config({ path: envPath });

module.exports = {};
