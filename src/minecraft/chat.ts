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

    bot.on("chat", (username: string, message: string) => {
      const chatMsg: ChatMessage = {
        sender: username,
        senderUuid: "",
        message,
        timestamp: Date.now(),
        isWhisper: false,
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
