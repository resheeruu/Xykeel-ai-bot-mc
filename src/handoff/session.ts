export type SessionMode = "xykeel" | "disconnected";

export interface SessionState {
  active: boolean;
  mode: SessionMode;
  lastConnect: number;
  lastDisconnect: number;
  reconnectAttempts: number;
  paused: boolean;
}

export function createSessionState(): SessionState {
  return {
    active: false,
    mode: "xykeel",
    lastConnect: 0,
    lastDisconnect: 0,
    reconnectAttempts: 0,
    paused: false,
  };
}

export function shouldAttemptConnect(state: SessionState): boolean {
  if (state.paused) return false;
  if (state.active) return false;
  return state.mode === "xykeel";
}

export function markConnect(state: SessionState): SessionState {
  return {
    ...state,
    active: true,
    mode: "xykeel",
    lastConnect: Date.now(),
    reconnectAttempts: 0,
  };
}

export function markDisconnect(state: SessionState): SessionState {
  return {
    ...state,
    active: false,
    mode: "xykeel",
    lastDisconnect: Date.now(),
  };
}

export function incrementReconnect(state: SessionState): SessionState {
  return {
    ...state,
    reconnectAttempts: state.reconnectAttempts + 1,
  };
}

export function pause(state: SessionState): SessionState {
  return { ...state, paused: true };
}

export function resume(state: SessionState): SessionState {
  return { ...state, paused: false };
}
