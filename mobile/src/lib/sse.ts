/**
 * Minimal SSE parser for the chat stream: buffers chunks, splits on the
 * blank-line event boundary, JSON-parses `data:` lines. Pure, no I/O.
 */
export function createSseParser(onEvent: (evt: unknown) => void) {
  let buffer = "";
  return {
    feed(chunk: string): void {
      buffer += chunk;
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            onEvent(JSON.parse(line.slice(6)));
          } catch {
            // malformed frame — skip, never crash the stream
          }
        }
      }
    },
  };
}
