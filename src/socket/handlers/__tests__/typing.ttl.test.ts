import {
  handleTypingStart,
  handleTypingStop,
  _resetTypingTimersForTests,
} from "../engagement.handlers";

describe("typing TTL", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    _resetTypingTimersForTests();
  });

  afterEach(() => {
    _resetTypingTimersForTests();
    jest.useRealTimers();
  });

  it("broadcasts user-typing true then auto-clears after TTL", () => {
    const emitted: any[] = [];
    const socket = {
      to: (room: string) => ({
        emit: (event: string, payload: any) => {
          emitted.push({ room, event, payload });
        },
      }),
    };
    const user = { userId: "u1", firstName: "Ada", lastName: "L", email: "a@b.c" };

    handleTypingStart(socket, user as any, { contentId: "c1", contentType: "media" });

    expect(emitted.some((e) => e.event === "user-typing" && e.payload.isTyping === true)).toBe(
      true
    );

    emitted.length = 0;
    jest.advanceTimersByTime(3000);

    expect(emitted.some((e) => e.event === "user-typing" && e.payload.isTyping === false)).toBe(
      true
    );
  });

  it("typing-stop clears immediately without waiting for TTL", () => {
    const emitted: any[] = [];
    const socket = {
      to: () => ({
        emit: (event: string, payload: any) => {
          emitted.push({ event, payload });
        },
      }),
    };
    const user = { userId: "u1", firstName: "Ada", lastName: "L", email: "a@b.c" };

    handleTypingStart(socket, user as any, "media123");
    emitted.length = 0;
    handleTypingStop(socket, user as any, "media123");

    expect(emitted.some((e) => e.payload.isTyping === false)).toBe(true);
    emitted.length = 0;
    jest.advanceTimersByTime(5000);
    expect(emitted.length).toBe(0);
  });
});
