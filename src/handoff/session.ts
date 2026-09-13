export type GameMode = "human" | "xykeel";

export interface SessionState {
  active: boolean;
  mode: GameMode;
  lastHumanDisconnect: number;
  lastXykeelConnect: number;
  reconnectAttempts: number;
  paused: boolean;
}

export function createSessionState(): SessionState {
  return {
    active: false,
    mode: "human",
    lastHumanDisconnect: 0,
    lastXykeelConnect: 0,
    reconnectAttempts: 0,
    paused: false,
  };
}

export function shouldXykeelTakeOver(state: SessionState, handoffDelay: number): boolean {
  if (state.mode === "human") return false;
  if (state.paused) return false;
  if (!state.lastHumanDisconnect) return false;
  const elapsed = Date.now() - state.lastHumanDisconnect;
  return elapsed >= handoffDelay;
}

export function markHumanDisconnect(state: SessionState): SessionState {
  return {
    ...state,
    active: true,
    mode: "human",
    lastHumanDisconnect: Date.now(),
  };
}

export function markXykeelConnect(state: SessionState): SessionState {
  return {
    ...state,
    mode: "xykeel",
    lastXykeelConnect: Date.now(),
    reconnectAttempts: 0,
  };
}

export function markXykeelDisconnect(state: SessionState): SessionState {
  return {
    ...state,
    active: false,
    mode: "xykeel",
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
