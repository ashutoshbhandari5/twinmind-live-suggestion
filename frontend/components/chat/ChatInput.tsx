export function ChatInput() {
  return (
    <div className="flex items-center gap-2 border-t border-zinc-800 p-3">
      <input
        type="text"
        placeholder="Ask anything..."
        className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        disabled
      />
      <button
        type="button"
        className="rounded bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400"
        disabled
      >
        Send
      </button>
    </div>
  );
}
