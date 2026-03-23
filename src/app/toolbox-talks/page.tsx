import { ToolboxTalkChatbot } from "./chatbot";

export default function ToolboxTalksPage() {
  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold mb-4">Toolbox Talks AI Assistant</h1>
      <ToolboxTalkChatbot />
    </div>
  );
}