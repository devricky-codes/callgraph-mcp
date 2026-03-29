function writeLine(stream: NodeJS.WriteStream, message: string): void {
  stream.write(message + '\n');
}

export function logVerbose(message: string): void {
  if (process.env.FLOWMAP_VERBOSE === 'false') {
    return;
  }

  writeLine(process.stderr, `Log: ${message}`);
}

export function logWarning(message: string): void {
  writeLine(process.stderr, `Warning: ${message}`);
}

export function logError(message: string): void {
  writeLine(process.stderr, `Error: ${message}`);
}