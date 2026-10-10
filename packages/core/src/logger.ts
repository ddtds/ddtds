const LOG_LEVELS = ["silent", "error", "info", "debug", "trace"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Logger {
  error: (message: string) => void;
  info: (message: string) => void;
  debug: (message: string) => void;
  trace: (message: string) => void;
}

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

function isEnabled(configuredLevel: LogLevel, messageLevel: Exclude<LogLevel, "silent">): boolean {
  return LOG_LEVELS.indexOf(configuredLevel) >= LOG_LEVELS.indexOf(messageLevel);
}

export function parseLogLevel(value: string | undefined): LogLevel {
  if (value === undefined) return "info";

  const normalized = value.trim().toLowerCase();
  if (!isLogLevel(normalized)) {
    throw new Error(`Invalid log level "${value}". Must be one of: ${LOG_LEVELS.join(", ")}.`);
  }
  return normalized;
}

export function createLogger(level: LogLevel = "info"): Logger {
  return {
    error: (message) => {
      if (isEnabled(level, "error")) console.error(message);
    },
    info: (message) => {
      if (isEnabled(level, "info")) console.log(message);
    },
    debug: (message) => {
      if (isEnabled(level, "debug")) console.debug(message);
    },
    trace: (message) => {
      if (isEnabled(level, "trace")) console.debug(message);
    },
  };
}

export function createLoggerFromEnv(): Logger {
  return createLogger(parseLogLevel(process.env.DDT_LOG_LEVEL));
}
