import { createSseParser } from "../lib/sse";

describe("createSseParser", () => {
  it("parses complete events and handles chunk splits mid-event", () => {
    const events: unknown[] = [];
    const parser = createSseParser((e) => events.push(e));
    parser.feed('data: {"delta":"سل');
    parser.feed('ام"}\n\ndata: {"del');
    parser.feed('ta":"!"}\n\n');
    expect(events).toEqual([{ delta: "سلام" }, { delta: "!" }]);
  });

  it("parses done and error events", () => {
    const events: unknown[] = [];
    const parser = createSseParser((e) => events.push(e));
    parser.feed('data: {"done":true,"message_id":"m1","title":null}\n\n');
    parser.feed('data: {"error":"provider_error"}\n\n');
    expect(events).toEqual([
      { done: true, message_id: "m1", title: null },
      { error: "provider_error" },
    ]);
  });

  it("ignores malformed json and non-data lines", () => {
    const events: unknown[] = [];
    const parser = createSseParser((e) => events.push(e));
    parser.feed(': keepalive\n\ndata: {broken\n\ndata: {"delta":"ok"}\n\n');
    expect(events).toEqual([{ delta: "ok" }]);
  });
});
