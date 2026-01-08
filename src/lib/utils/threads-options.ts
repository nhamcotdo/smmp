import type { ThreadsOptions, PollOptions } from '@/lib/types/posts'

/**
 * Builds Threads API options from form input
 * Combines threads-specific options with poll options
 */
export function buildThreadsOptionsFromForm(
  threadsOptions: ThreadsOptions,
  pollOptions: PollOptions
): ThreadsOptions {
  const built: ThreadsOptions = {}

  if (threadsOptions.linkAttachment) built.linkAttachment = threadsOptions.linkAttachment
  if (threadsOptions.topicTag) built.topicTag = threadsOptions.topicTag
  if (threadsOptions.replyControl) built.replyControl = threadsOptions.replyControl
  if (threadsOptions.replyToId) built.replyToId = threadsOptions.replyToId
  if (threadsOptions.locationId) built.locationId = threadsOptions.locationId
  if (threadsOptions.autoPublishText !== undefined) built.autoPublishText = threadsOptions.autoPublishText
  if (threadsOptions.textEntities) built.textEntities = threadsOptions.textEntities
  if (threadsOptions.gifAttachment) built.gifAttachment = threadsOptions.gifAttachment
  if (threadsOptions.isGhostPost !== undefined) built.isGhostPost = threadsOptions.isGhostPost

  if (pollOptions.optionA && pollOptions.optionB) {
    built.pollAttachment = {
      option_a: pollOptions.optionA,
      option_b: pollOptions.optionB,
      ...(pollOptions.optionC && { option_c: pollOptions.optionC }),
      ...(pollOptions.optionD && { option_d: pollOptions.optionD }),
    }
  }

  return built
}
