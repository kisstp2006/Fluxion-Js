// @ts-check

/** @typedef {{ level: LogLevel, name: string, time: Date, args: any[] }} LogEvent */

/** Simple structured logger for game/editor scripts. */
export class Logger {
  /**
   * @param {{ name?: string, level?: LogLevel, handler?: LogHandler }} [opts]
   */
  constructor(opts = {}) {
    this.name = opts.name || 'app';
    this.level = opts.level || 'debug';
    this.handler = opts.handler || defaultHandler;
  }

  /** @param {LogLevel} level @param {...any} args */
  log(level, ...args) {
    if (!shouldEmit(this.level, level)) return;
    this.handler({
      level,
      name: this.name,
      time: new Date(),
      args,
    });
  }

  /** @param {...any} args */
  debug(...args) { this.log('debug', ...args); }
  /** @param {...any} args */
  info(...args) { this.log('info', ...args); }
  /** @param {...any} args */
  warn(...args) { this.log('warn', ...args); }
  /** @param {...any} args */
  error(...args) { this.log('error', ...args); }

  /** Create a scoped child logger. */
  /** @param {string} scope */
  child(scope) {
    const childName = this.name ? `${this.name}:${scope}` : scope;
    return new Logger({ name: childName, level: this.level, handler: this.handler });
  }

  /** Change minimum level. */
  /** @param {LogLevel} level */
  setLevel(level) { this.level = level; }

  /** Replace handler (e.g., to forward into in-editor console). */
  /** @param {LogHandler} handler */
  setHandler(handler) { this.handler = handler; }
}

/** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */
/** @typedef {(evt: LogEvent) => void} LogHandler */

/** @type {Record<LogLevel, number>} */
const order = { debug: 10, info: 20, warn: 30, error: 40 };
/** @param {LogLevel} min @param {LogLevel} level */
function shouldEmit(min, level) {
  return (order[level] ?? 999) >= (order[min] ?? 10);
}

/** Default handler prints to console with timestamp and scope. */
/** @param {LogEvent} evt */
const defaultHandler = (evt) => {
  const ts = evt.time.toISOString();
  const prefix = `[${ts}] [${evt.name}]`;
  switch (evt.level) {
    case 'debug': console.debug(prefix, ...evt.args); break;
    case 'info':  console.info(prefix, ...evt.args); break;
    case 'warn':  console.warn(prefix, ...evt.args); break;
    case 'error': console.error(prefix, ...evt.args); break;
  }
};

/** Create a logger with an optional name and level. */
/** @param {string} [name='app'] @param {LogLevel} [level='debug'] @param {LogHandler} [handler=defaultHandler] */
export function createLogger(name = 'app', level = 'debug', handler = defaultHandler) {
  return new Logger({ name, level, handler });
}

/** A shared singleton logger for convenience. */
export const log = new Logger({ name: 'game', level: 'debug' });
