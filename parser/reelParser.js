function normalizeAuthor(user) {
  if (!user) {
    return {
      id: null,
      username: null,
      fullName: null,
      profilePicUrl: null,
    };
  }

  return {
    id: user.pk != null ? String(user.pk) : user.id != null ? String(user.id) : null,
    username: user.username || null,
    fullName: user.full_name || user.fullName || null,
    profilePicUrl: user.profile_pic_url || user.profilePicUrl || null,
  };
}

function normalizeAudioTrack(item) {
  const clipsMetadata = item.clips_metadata || item.clipsMetadata;
  const musicInfo =
    clipsMetadata?.music_info?.music_asset_info ||
    clipsMetadata?.original_sound_info ||
    clipsMetadata?.musicInfo?.musicAssetInfo;

  if (!musicInfo) {
    return { title: null, artist: null };
  }

  return {
    title: musicInfo.title || musicInfo.display_artist || null,
    artist: musicInfo.display_artist || musicInfo.artist_name || null,
  };
}

function getCaptionText(item) {
  if (typeof item.caption === 'string') {
    return item.caption;
  }
  if (item.caption?.text) {
    return item.caption.text;
  }
  if (item.edge_media_to_caption?.edges?.[0]?.node?.text) {
    return item.edge_media_to_caption.edges[0].node.text;
  }
  return null;
}

function getVideoUrl(item) {
  if (item.video_url) {
    return item.video_url;
  }

  const versions = item.video_versions || item.videoVersions;
  if (Array.isArray(versions) && versions.length > 0) {
    return versions[0].url || null;
  }

  return null;
}

function getThumbnailUrl(item) {
  if (item.image_versions2?.candidates?.[0]?.url) {
    return item.image_versions2.candidates[0].url;
  }
  if (item.display_url) {
    return item.display_url;
  }
  if (item.thumbnail_src) {
    return item.thumbnail_src;
  }
  return null;
}

function isReelItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const mediaType = item.media_type ?? item.mediaType;
  const productType = item.product_type || item.productType;

  if (mediaType === 2 && (productType === 'clips' || productType === 'reels')) {
    return true;
  }

  if (item.video_url || item.video_versions || item.videoVersions) {
    if (productType === 'clips' || productType === 'reels' || item.is_video) {
      return true;
    }
  }

  return false;
}

function normalizeReelItem(item) {
  if (!isReelItem(item)) {
    return null;
  }

  const id = item.pk != null ? String(item.pk) : item.id != null ? String(item.id) : null;
  const shortcode = item.code || item.shortcode || null;

  if (!id && !shortcode) {
    return null;
  }

  const url = shortcode
    ? `https://www.instagram.com/reel/${shortcode}/`
    : null;

  return {
    id,
    shortcode,
    url,
    videoUrl: getVideoUrl(item),
    thumbnailUrl: getThumbnailUrl(item),
    caption: getCaptionText(item),
    author: normalizeAuthor(item.user || item.owner),
    likeCount: item.like_count ?? item.likeCount ?? null,
    commentCount: item.comment_count ?? item.commentCount ?? null,
    viewCount: item.view_count ?? item.play_count ?? item.viewCount ?? null,
    durationSeconds: item.video_duration ?? item.videoDuration ?? null,
    takenAtTimestamp: item.taken_at ?? item.takenAtTimestamp ?? null,
    audioTrack: normalizeAudioTrack(item),
    fetchedAt: new Date().toISOString(),
  };
}

function extractItemsFromPayload(payload) {
  const items = [];

  if (!payload || typeof payload !== 'object') {
    return items;
  }

  if (Array.isArray(payload.items)) {
    items.push(...payload.items);
  }

  if (Array.isArray(payload.reels_media)) {
    for (const reelMedia of payload.reels_media) {
      if (Array.isArray(reelMedia.items)) {
        items.push(...reelMedia.items);
      }
    }
  }

  if (Array.isArray(payload.reels_tray)) {
    for (const tray of payload.reels_tray) {
      if (tray.media) {
        items.push(tray.media);
      }
    }
  }

  const graphqlConnections = [
    payload?.data?.xdt_api__v1__feed__timeline__connection,
    payload?.data?.xdt_api__v1__feed__reels_tray__connection,
    payload?.data?.xdt_api__v1__clips__home__connection_v2,
    payload?.data?.user?.edge_web_feed_timeline,
    payload?.data?.edge_web_feed_timeline,
  ];

  for (const connection of graphqlConnections) {
    if (!Array.isArray(connection?.edges)) {
      continue;
    }

    for (const edge of connection.edges) {
      const node = edge?.node;
      if (node?.media) {
        items.push(node.media);
      } else if (node) {
        items.push(node);
      }
    }
  }

  return items;
}

function parseReelsFromPayload(rawJson) {
  const items = extractItemsFromPayload(rawJson);
  const reels = [];

  for (const item of items) {
    const normalized = normalizeReelItem(item);
    if (normalized) {
      reels.push(normalized);
    }
  }

  return reels;
}

module.exports = {
  parseReelsFromPayload,
  normalizeReelItem,
  isReelItem,
};
