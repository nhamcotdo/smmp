interface ContentTextareaProps {
  content: string
  onChange: (content: string) => void
  isOptional?: boolean
}

export function ContentTextarea({ content, onChange, isOptional = false }: ContentTextareaProps) {
  return (
    <div>
      <label htmlFor="content" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Post Content {isOptional && '(Optional)'}
      </label>
      <textarea
        id="content"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        maxLength={500}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        placeholder="What's on your mind?"
      />
      <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
        {content.length}/500 characters
      </p>
    </div>
  )
}
