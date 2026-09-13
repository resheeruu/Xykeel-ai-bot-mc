import { describe, it, expect } from "vitest";
import {
  createSessionState,
  shouldAttemptConnect,
  markConnect,
  markDisconnect,
  incrementReconnect,
  pause,
  resume,
} from "../src/handoff/session.js";

describe("Session State", () => {
  it("creates initial state with xykeel mode (independent)", () => {
    const state = createSessionState();
    expect(state.active).toBe(false);
    expect(state.mode).toBe("xykeel");
    expect(state.lastConnect).toBe(0);
    expect(state.lastDisconnect).toBe(0);
    expect(state.reconnectAttempts).toBe(0);
    expect(state.paused).toBe(false);
  });

  it("should attempt connect when not active and not paused", () => {
    const state = createSessionState();
    expect(shouldAttemptConnect(state)).toBe(true);
  });

  it("should not attempt connect when paused", () => {
    let state = createSessionState();
    state = pause(state);
    expect(shouldAttemptConnect(state)).toBe(false);
  });

  it("should not attempt connect when already active", () => {
    let state = createSessionState();
    state = markConnect(state);
    expect(shouldAttemptConnect(state)).toBe(false);
  });

  it("marks connect", () => {
    let state = createSessionState();
    state = markConnect(state);
    expect(state.mode).toBe("xykeel");
    expect(state.active).toBe(true);
    expect(state.lastConnect).toBeGreaterThan(0);
    expect(state.reconnectAttempts).toBe(0);
  });

  it("marks disconnect", () => {
    let state = markConnect(createSessionState());
    state = markDisconnect(state);
    expect(state.active).toBe(false);
    expect(state.mode).toBe("xykeel");
    expect(state.lastDisconnect).toBeGreaterThan(0);
  });

  it("increments reconnect attempts", () => {
    let state = createSessionState();
    state = incrementReconnect(state);
    state = incrementReconnect(state);
    expect(state.reconnectAttempts).toBe(2);
  });

  it("pause and resume", () => {
    let state = createSessionState();
    state = pause(state);
    expect(state.paused).toBe(true);
    state = resume(state);
    expect(state.paused).toBe(false);
  });

  it("should attempt connect after disconnect with reconnect attempts", () => {
    let state = createSessionState();
    state = markConnect(state);
    state = markDisconnect(state);
    state = incrementReconnect(state);
    // Should still attempt connect (not paused, not active)
    expect(shouldAttemptConnect(state)).toBe(true);
  });
});
