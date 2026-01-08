interface MediaTypeSelectorProps {
  onImageSelect: () => void
  onVideoSelect: () => void
}

export function MediaTypeSelector({ onImageSelect, onVideoSelect }: MediaTypeSelectorProps) {
  return (
    <div className="mt-3 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
      <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
        Couldn&apos;t detect media type. Please select:
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onImageSelect}
          className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          📷 Image
        </button>
        <button
          type="button"
          onClick={onVideoSelect}
          className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          🎥 Video
        </button>
      </div>
    </div>
  )
}
