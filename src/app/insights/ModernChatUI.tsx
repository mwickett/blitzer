"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useEffect, useRef } from "react";

export default function ModernChatUI() {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    status,
    error,
  } = useChat({
    api: "/api/chat",
  });

  // Check if the chat is in a loading state (either submitted or streaming)
  const isLoading = status === "submitted" || status === "streaming";

  // Custom submit handler to maintain focus
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    originalHandleSubmit(e);
    // Focus will be handled by useEffect
  };

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Maintain input focus after submission
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col h-[600px]">
        {/* Chat messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground p-8">
              <p>Ask basic questions about your game history!</p>
              <p className="text-sm mt-2">Try questions like:</p>
              <ul className="text-sm text-left mt-2 max-w-md mx-auto space-y-1">
                <li>• How many games have I played?</li>
                <li>• What&apos;s my win-loss record?</li>
                <li>• Summarize my recent gameplay</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <span key={`${message.id}-${i}`}>{part.text}</span>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                <div className="flex space-x-2 items-center">
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-destructive text-destructive-foreground">
                Error:{" "}
                {error.message || "Something went wrong. Please try again."}
              </div>
            </div>
          )}
        </div>

        {/* Input form */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about your game data..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? "Thinking..." : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
