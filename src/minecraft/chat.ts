import type { Bot } from "mineflayer";
import type { XykeelLogger } from "../logging/logger.js";

export interface ChatMessage {
  sender: string;
  senderUuid: string;
  message: string;
  timestamp: number;
  isWhisper: boolean;
}

export interface ChatObserver {
  messages: ChatMessage[];
  onMessage(callback: (msg: ChatMessage) => void): void;
  start(bot: Bot): void;
  stop(): void;
  getRecent(count: number): ChatMessage[];
}

export function createChatObserver(logger: XykeelLogger): ChatObserver {
  const messages: ChatMessage[] = [];
  const listeners: Array<(msg: ChatMessage) => void> = [];
  function onMessage(callback: (msg: ChatMessage) => void): void {
    listeners.push(callback);
  }

  function start(bot: Bot): void {

    bot.on("chat", (mfChatMsg: unknown) => {
      const msg = mfChatMsg as { toString(): string; sender?: string; uuid?: string };
      const chatMsg: ChatMessage = {
        sender: msg.sender ?? "unknown",
        senderUuid: msg.uuid ?? "",
        message: msg.toString(),
        timestamp: Date.now(),
        isWhisper: msg.toString().includes("whispers") || msg.toString().includes("msg"),
      };

      messages.push(chatMsg);

      while (messages.length > 500) {
        messages.shift();
      }

      logger.chat(`[${chatMsg.sender}] ${chatMsg.message}`);

      for (const cb of listeners) {
        cb(chatMsg);
      }
    });
  }

  function stop(): void {
    listeners.length = 0;
  }

  function getRecent(count: number): ChatMessage[] {
    return messages.slice(-count);
  }

  return { messages, onMessage, start, stop, getRecent };
}
