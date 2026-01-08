interface MediaUploadAreaProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  label?: string
}

export function MediaUploadArea({ fileInputRef, onFileSelect, label = 'Upload Image or Video' }: MediaUploadAreaProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={onFileSelect}
          className="hidden"
        />
        <div className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-zinc-300 px-4 py-3 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
          <svg className="mr-2 h-5 w-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
        </div>
      </label>
    </div>
  )
}
