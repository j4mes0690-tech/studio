"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ToolboxTalkChatbot() {
  const [messages, setMessages] = useState<
    { sender: string; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Simulate API call to generate toolbox talk
    try {
      const response = await fetch("/api/generate-toolbox-talk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate toolbox talk.");
      }

      const data = await response.json();
      const botMessage = { sender: "bot", text: data.toolboxTalkContent };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      const errorMessage = {
        sender: "bot",
        text: `Error: ${error.message}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <ScrollArea className="flex-grow p-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 ${
              msg.sender === "user" ? "text-right" : "text-left"
            }`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {msg.text}
            </span>
          </div>
        ))}
        {loading && (
          <div className="text-center text-gray-500">Generating...</div>
        )}
      </ScrollArea>
      <div className="flex p-4 border-t">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Request a toolbox talk (e.g., 'site tidiness')"
          className="flex-grow mr-2"
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleSendMessage();
            }
          }}
        />
        <Button onClick={handleSendMessage} disabled={loading}>
          Send
        </Button>
      </div>
    </div>
  );
}