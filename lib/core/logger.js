const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFile = path.join(this.logDir, `session_${timestamp}.log`);
        this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });

        console.log(`[LOGGER] Logging to file: ${this.logFile}`);
    }

    _format(level, message, data = null) {
        const time = new Date().toLocaleTimeString();
        let logMsg = `[${time}] [${level}] ${message}`;
        if (data) {
            logMsg += `\n${JSON.stringify(data, null, 2)}`;
        }
        return logMsg;
    }

    _write(level, message, data) {
        const logMsg = this._format(level, message, data);

        // Write to file
        this.logStream.write(logMsg + '\n');

        // Write to console with colors
        switch (level) {
            case 'ERROR':
                console.error('\x1b[31m%s\x1b[0m', logMsg); // Red
                break;
            case 'ACTION':
                console.log('\x1b[32m%s\x1b[0m', logMsg); // Green
                break;
            case 'WARN':
                console.log('\x1b[33m%s\x1b[0m', logMsg); // Yellow
                break;
            case 'DEBUG':
                // Only log debug to file to keep console clean, unless verbose needed
                // For now, let's keep it in console too but grey/dim if possible, or just standard
                console.log('\x1b[90m%s\x1b[0m', logMsg); // Grey
                break;
            default:
                console.log(logMsg);
        }
    }

    info(message, data) { this._write('INFO', message, data); }
    action(message, data) { this._write('ACTION', message, data); }
    warn(message, data) { this._write('WARN', message, data); }
    error(message, data) { this._write('ERROR', message, data); }
    debug(message, data) { this._write('DEBUG', message, data); }
}

module.exports = new Logger();
