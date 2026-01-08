interface CarouselUploadAreaProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function CarouselUploadArea({ onFileSelect }: CarouselUploadAreaProps) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-zinc-300 px-4 py-3 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={onFileSelect}
        className="hidden"
      />
      <svg className="mr-2 h-5 w-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Upload Files
      </span>
    </label>
  )
}
