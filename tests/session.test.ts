import { describe, it, expect } from "vitest";
import {
  createSessionState,
  shouldXykeelTakeOver,
  markHumanDisconnect,
  markXykeelConnect,
  markXykeelDisconnect,
  incrementReconnect,
  pause,
  resume,
  markUnknown,
  confirmOwnership,
} from "../src/handoff/session.js";

describe("Session State", () => {
  it("creates initial state", () => {
    const state = createSessionState();
    expect(state.active).toBe(false);
    expect(state.mode).toBe("human");
    expect(state.lastHumanDisconnect).toBe(0);
    expect(state.reconnectAttempts).toBe(0);
    expect(state.paused).toBe(false);
    expect(state.ownershipConfirmed).toBe(false);
  });

  it("does not take over when mode is human", () => {
    const state = createSessionState();
    expect(shouldXykeelTakeOver(state, 30000)).toBe(false);
  });

  it("does not take over when paused", () => {
    let state = markHumanDisconnect(createSessionState());
    state = pause(state);
    expect(shouldXykeelTakeOver(state, 30000)).toBe(false);
  });

  it("marks human disconnect", () => {
    const state = markHumanDisconnect(createSessionState());
    expect(state.mode).toBe("human");
    expect(state.lastHumanDisconnect).toBeGreaterThan(0);
    expect(state.ownershipConfirmed).toBe(true);
  });

  it("marks xykeel connect", () => {
    let state = markHumanDisconnect(createSessionState());
    state = markXykeelConnect(state);
    expect(state.mode).toBe("xykeel");
    expect(state.lastXykeelConnect).toBeGreaterThan(0);
    expect(state.reconnectAttempts).toBe(0);
    expect(state.ownershipConfirmed).toBe(true);
  });

  it("marks xykeel disconnect", () => {
    let state = markXykeelConnect(markHumanDisconnect(createSessionState()));
    state = markXykeelDisconnect(state);
    expect(state.active).toBe(false);
    expect(state.mode).toBe("xykeel");
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

  it("does not take over when mode is unknown and ownership not confirmed", () => {
    let state = createSessionState();
    state = markHumanDisconnect(state);
    state = markUnknown(state);
    expect(state.mode).toBe("unknown");
    expect(state.ownershipConfirmed).toBe(false);
    expect(shouldXykeelTakeOver(state, 30000)).toBe(false);
  });

  it("takes over when mode is unknown but ownership confirmed", () => {
    let state = createSessionState();
    state = markHumanDisconnect(state);
    state = markUnknown(state);
    state = confirmOwnership(state);
    expect(state.mode).toBe("unknown");
    expect(state.ownershipConfirmed).toBe(true);
    // Should be able to take over (elapsed check is separate)
    const result = shouldXykeelTakeOver(state, 0);
    expect(result).toBe(true);
  });

  it("does not take over when no human disconnect recorded", () => {
    const state = createSessionState();
    state.mode = "xykeel";
    expect(shouldXykeelTakeOver(state, 0)).toBe(false);
  });
});
