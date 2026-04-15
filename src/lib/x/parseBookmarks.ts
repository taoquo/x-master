function getTimelineInstructions(response: any) {
  return (
    response?.data?.bookmark_timeline_v2?.timeline?.instructions ??
    response?.data?.search_by_raw_query?.bookmarks_search_timeline?.timeline?.instructions ??
    []
  )
}

function unwrapTweetResult(result: any) {
  if (result?.tweet) {
    return result.tweet
  }
  return result
}

function getMediaPayload(item: any) {
  const type = item?.type
  const posterUrl = item?.media_url_https ?? item?.media_url ?? ""

  if (type !== "video" && type !== "animated_gif") {
    return {
      url: posterUrl,
      posterUrl: undefined
    }
  }

  const mp4Variants = (item?.video_info?.variants ?? [])
    .filter((variant: any) => variant?.content_type === "video/mp4" && variant?.url)
    .sort((left: any, right: any) => (right?.bitrate ?? 0) - (left?.bitrate ?? 0))

  return {
    url: mp4Variants[0]?.url ?? posterUrl,
    posterUrl
  }
}

export function parseBookmarkEntries(response: any) {
  const instructions = getTimelineInstructions(response)
  const addEntries = instructions.find((instruction: any) => instruction?.type === "TimelineAddEntries")
  const entries = addEntries?.entries ?? []
  const seenAt = new Date().toISOString()

  const bookmarks = entries
    .filter((entry: any) => String(entry?.entryId ?? "").startsWith("tweet-"))
    .flatMap((entry: any) => {
      const rawResult = entry?.content?.itemContent?.tweet_results?.result
      const result = unwrapTweetResult(rawResult)
      const legacy = result?.legacy ?? {}
      const noteTweetText = result?.note_tweet?.note_tweet_results?.result?.text
      const userLegacy = result?.core?.user_results?.result?.legacy ?? {}
      const screenName = userLegacy?.screen_name
      const restId = result?.rest_id

      if (!restId) {
        return []
      }

      return [
        {
          tweetId: restId,
          tweetUrl: screenName
            ? `https://x.com/${screenName}/status/${restId}`
            : `https://x.com/i/status/${restId}`,
          authorName: userLegacy?.name ?? "",
          authorHandle: screenName ?? "",
          text: noteTweetText ?? legacy?.full_text ?? "",
          createdAtOnX: legacy?.created_at ?? "",
          savedAt: seenAt,
          lastSeenAt: seenAt,
          media: (legacy?.extended_entities?.media ?? []).map((item: any) => {
            const mediaPayload = getMediaPayload(item)

            return {
              type: item?.type,
              url: mediaPayload.url,
              posterUrl: mediaPayload.posterUrl,
              altText: item?.ext_alt_text
            }
          }),
          metrics: {
            likes: legacy?.favorite_count ?? 0,
            retweets: legacy?.retweet_count ?? 0,
            replies: legacy?.reply_count ?? 0
          },
          rawPayload: result,
          sourceKind: noteTweetText ? "x-note-tweet" : "x-bookmark"
        }
      ]
    })

  const nextCursorEntry = entries.find((entry: any) => String(entry?.entryId ?? "").startsWith("cursor-bottom-"))

  return {
    bookmarks,
    nextCursor: nextCursorEntry?.content?.value ?? null
  }
}
