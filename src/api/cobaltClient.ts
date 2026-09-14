import { detectPlatform } from '../services/platformDetector';
import { ResolveResult } from '../navigation/types';

export interface CobaltRequestOptions {
  url: string;
  videoQuality?: '144' | '240' | '360' | '480' | '720' | '1080' | '1440' | '2160' | 'max';
  audioFormat?: 'mp3' | 'ogg' | 'wav' | 'opus';
  audioOnly?: boolean;
  filenamePattern?: 'classic' | 'basic' | 'pretty' | 'nerdy';
}

export interface CobaltApiResponse {
  status: 'tunnel' | 'redirect' | 'picker' | 'error';
  url?: string;
  filename?: string;
  picker?: Array<{
    type: 'video' | 'photo' | 'audio';
    url: string;
    thumb?: string;
  }>;
  error?: {
    code: string;
    context?: {
      service?: string;
      limit?: number;
    };
  };
}

// Configurable backend URL with persistence (only used if user sets a custom self-hosted server)
const isWebEnv = typeof window !== 'undefined' && typeof document !== 'undefined';
export let currentCobaltServerUrl: string | null = isWebEnv ? 'http://localhost:9000' : null;
export let useDemoMode = false;
let lastDetectedRestrictedTitle: string | null = null;

export const PUBLIC_COBALT_SERVERS = [
  'https://api.cobalt.tools',
];

export function setCobaltServerUrl(url: string) {
  let cleaned = url.trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  currentCobaltServerUrl = cleaned;
}

export function setUseDemoMode(enabled: boolean) {
  useDemoMode = enabled;
}

/**
 * Universal media resolver:
 * 1. If Demo Mode enabled -> Built-in simulator
 * 2. Direct client-side extractor for Twitter/X & TikTok (No backend needed!)
 * 3. Self-hosted Cobalt instance (if user runs Docker)
 * 4. Community Cobalt instance fallback pool
 * 5. Clear actionable error if media cannot be downloaded
 */
export async function resolveCobaltMedia(
  url: string,
  options: Partial<CobaltRequestOptions> = {}
): Promise<ResolveResult> {
  const platformInfo = detectPlatform(url);
  lastDetectedRestrictedTitle = null;

  if (useDemoMode) {
    return mockResolveMedia(url);
  }

  // 1. Explicitly block YouTube per policy
  if (platformInfo.platform === 'youtube' || /(?:youtube\.com|youtu\.be)/i.test(url)) {
    throw new Error('YouTube downloads are not supported.');
  }

  // 2. Direct in-app extractor for Twitter/X
  if (platformInfo.platform === 'twitter') {
    const directTwitter = await resolveTwitterDirect(url);
    if (directTwitter) return directTwitter;
  }

  // 3. Direct in-app extractor for TikTok
  if (platformInfo.platform === 'tiktok') {
    const directTikTok = await resolveTikTokDirect(url);
    if (directTikTok) return directTikTok;
  }

  // 4. Direct in-app extractor for Facebook (Videos, Watch, Reels, Shares)
  if (platformInfo.platform === 'facebook') {
    const directFB = await resolveFacebookDirect(url, options);
    if (directFB) return directFB;
  }

  // 5. Direct in-app extractor for Instagram (Posts, Reels, Stories)
  if (platformInfo.platform === 'instagram') {
    const directIG = await resolveInstagramDirect(url);
    if (directIG) return directIG;
  }

  // 6. Direct in-app extractor for Reddit
  if (platformInfo.platform === 'reddit') {
    const directReddit = await resolveRedditDirect(url);
    if (directReddit) return directReddit;
  }

  // 7. Direct in-app extractor for Snapchat
  if (platformInfo.platform === 'snapchat') {
    const directSnap = await resolveSnapchatDirect(url);
    if (directSnap) return directSnap;
  }

  // 8. Direct in-app extractor for Pinterest
  if (platformInfo.platform === 'pinterest') {
    const directPin = await resolvePinterestDirect(url);
    if (directPin) return directPin;
  }

  // 3. Try custom configured Cobalt server or public community instances fallback
  const candidateServers = currentCobaltServerUrl
    ? [currentCobaltServerUrl, ...PUBLIC_COBALT_SERVERS]
    : PUBLIC_COBALT_SERVERS;

  for (const server of candidateServers) {
    try {
      const result = await fetchFromCobalt(server, url, options, platformInfo);
      if (result) return result;
    } catch {}
  }

  // 4. If all network resolvers failed, provide actionable feedback
  if (lastDetectedRestrictedTitle) {
    throw new Error(
      `"${lastDetectedRestrictedTitle}" is restricted by the broadcaster/content owner (e.g. beIN SPORTS / UEFA) and cannot be downloaded.`
    );
  }

  throw new Error(
    `Unable to download media from this link. The video may be private, age-restricted, or protected by the content owner.`
  );
}

async function fetchFromCobalt(
  endpoint: string,
  url: string,
  options: Partial<CobaltRequestOptions>,
  platformInfo: any
): Promise<ResolveResult | null> {
  const payload = {
    url,
    videoQuality: options.videoQuality || '1080',
    audioFormat: options.audioFormat || 'mp3',
    downloadMode: options.audioOnly ? 'audio' : 'auto',
    filenamePattern: 'pretty',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s fast timeout

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    return null;
  }

  const data: CobaltApiResponse = await response.json();

  if (data.status === 'error' || (!data.url && !data.picker)) {
    return null;
  }

  return {
    status: data.status,
    url: data.url,
    filename: data.filename || `black_hole_${Date.now()}.mp4`,
    title: formatFilenameToTitle(data.filename) || `${platformInfo.displayName} Video`,
    thumbnail: getThumbnailFromCobalt(data, platformInfo.platform),
    duration: undefined,
    platform: platformInfo.platform,
    originalUrl: url,
    picker: data.picker,
    availableQualities: ['1080p Full HD', '720p HD', '480p SD'],
    audioOnlyAvailable: false,
  };
}

// Direct In-App Extractor for Twitter / X
async function resolveTwitterDirect(url: string): Promise<ResolveResult | null> {
  try {
    const match = url.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)\/status\/([0-9]+)/i);
    if (!match) return null;
    const user = match[1];
    const statusId = match[2];

    // 1. Try fxtwitter API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://api.fxtwitter.com/${user}/status/${statusId}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const tweet = data.tweet;
        const video = tweet?.media?.videos?.[0] || tweet?.media?.all?.find((m: any) => m.type === 'video');
        if (video && video.url) {
          return {
            status: 'redirect',
            url: video.url,
            filename: `media_${statusId}.mp4`,
            title: tweet.text ? tweet.text.substring(0, 90) : 'Video File',
            thumbnail: video.thumbnail_url || tweet.media?.photos?.[0]?.url,
            platform: 'twitter',
            originalUrl: url,
            availableQualities: ['Original Quality (High Res)'],
            audioOnlyAvailable: false,
          };
        }
      }
    } catch {
      // Fallback to vxtwitter
    }

    // 2. Fallback to vxtwitter API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.vxtwitter.com/${user}/status/${statusId}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.media_extended && data.media_extended.length > 0) {
        const media = data.media_extended[0];
        return {
          status: 'redirect',
          url: media.url,
          filename: `x_${statusId}.mp4`,
          title: data.text ? data.text.substring(0, 90) : `Post by @${user}`,
          thumbnail: media.thumbnail_url,
          platform: 'twitter',
          originalUrl: url,
          availableQualities: ['Original Quality (High Res)'],
          audioOnlyAvailable: false,
        };
      }
    }
  } catch (e) {
    // Handled by fallback
  }
  return null;
}

// Direct In-App Extractor for TikTok
async function resolveTikTokDirect(url: string): Promise<ResolveResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();

    if (json.code === 0 && json.data) {
      return {
        status: 'redirect',
        url: json.data.play || json.data.wmplay,
        filename: `media_${json.data.id || Date.now()}.mp4`,
        title: json.data.title || 'Video File',
        thumbnail: json.data.cover,
        duration: json.data.duration,
        platform: 'tiktok',
        originalUrl: url,
        availableQualities: ['HD No Watermark', 'With Watermark'],
        audioOnlyAvailable: false,
      };
    }
  } catch {
    // Handled by fallback
  }
  return null;
}

// Direct In-App Extractor for Reddit (Videos, Gifs, Mobile Shortlinks, Images)
async function resolveRedditDirect(url: string): Promise<ResolveResult | null> {
  try {
    let targetUrl = url.trim();

    // 1. Resolve Reddit mobile shortlinks (/s/ or redd.it/) & extract OpenGraph video
    try {
      const ogCtrl = new AbortController();
      const ogTimeout = setTimeout(() => ogCtrl.abort(), 6000);
      const ogRes = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
        redirect: 'follow',
        signal: ogCtrl.signal,
      });
      clearTimeout(ogTimeout);

      if (ogRes.url && ogRes.url.includes('/comments/')) {
        targetUrl = ogRes.url;
      }

      if (ogRes.ok) {
        const html = await ogRes.text();
        const ogVideo =
          html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);
        const ogTitle =
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        const ogImage =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

        // Check for modern Reddit packaged media or shreddit stream
        const packagedMatch = html.match(/https?:\/\/packaged-media\.redd\.it\/[^"'\s<>]+\.mp4[^"'\s<>]*/i);

        if (packagedMatch) {
          return {
            status: 'redirect',
            url: packagedMatch[0].replace(/&amp;/g, '&'),
            filename: `media_${Date.now()}.mp4`,
            title: ogTitle?.[1] || 'Video File',
            thumbnail: ogImage?.[1],
            platform: 'reddit',
            originalUrl: url,
            availableQualities: ['Original HD Video'],
            audioOnlyAvailable: false,
          };
        }

        // If direct video found via crawler
        if (ogVideo?.[1]) {
          return {
            status: 'redirect',
            url: ogVideo[1].replace(/&amp;/g, '&'),
            filename: `media_${Date.now()}.mp4`,
            title: ogTitle?.[1] || 'Video File',
            thumbnail: ogImage?.[1],
            platform: 'reddit',
            originalUrl: url,
            availableQualities: ['Original Quality'],
            audioOnlyAvailable: false,
          };
        }

        // Extract canonical comments URL for shortlinks
        const canonMatch =
          html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
        if (canonMatch?.[1] && canonMatch[1].includes('/comments/')) {
          targetUrl = canonMatch[1];
        }
      }
    } catch {}

    // 2. Strategy 1: RapidSave API (Specialized Reddit engine, merges video + audio into crisp MP4)
    try {
      const rsCtrl = new AbortController();
      const rsTimeout = setTimeout(() => rsCtrl.abort(), 6000);
      const rsRes = await fetch(
        `https://api.rapidsave.com/info?url=${encodeURIComponent(targetUrl)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          signal: rsCtrl.signal,
        }
      );
      clearTimeout(rsTimeout);

      if (rsRes.ok) {
        const rsData = await rsRes.json();
        const bestUrl = rsData.video_hd || rsData.video_sd || rsData.download_url;
        if (bestUrl) {
          return {
            status: 'redirect',
            url: bestUrl,
            filename: `media_${Date.now()}.mp4`,
            title: rsData.title || 'Video File',
            thumbnail: rsData.thumbnail,
            platform: 'reddit',
            originalUrl: url,
            availableQualities: ['HD Video'],
            audioOnlyAvailable: false,
          };
        }
      }
    } catch {}

    // 3. Strategy 2: SaveFrom Gateway (handles full MP4 with merged audio)
    try {
      const sfCtrl = new AbortController();
      const sfTimeout = setTimeout(() => sfCtrl.abort(), 6000);
      const sfRes = await fetch(
        `https://worker.sf-tools.com/savefrom.php?sf_url=${encodeURIComponent(targetUrl)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
            Referer: 'https://en.savefrom.net/',
          },
          signal: sfCtrl.signal,
        }
      );
      clearTimeout(sfTimeout);

      if (sfRes.ok) {
        const sfData = await sfRes.json();
        const urls = sfData?.url || [];
        if (Array.isArray(urls) && urls.length > 0) {
          const best =
            urls.find((u: any) => u.url && (u.ext === 'mp4' || u.type === 'video')) || urls[0];
          if (best?.url) {
            return {
              status: 'redirect',
              url: best.url,
              filename: `media_${Date.now()}.mp4`,
              title: sfData?.meta?.title || 'Video File',
              thumbnail: sfData?.thumb,
              platform: 'reddit',
              originalUrl: url,
              availableQualities: ['Original Quality'],
              audioOnlyAvailable: false,
            };
          }
        }
      }
    } catch {}

    // 4. Strategy 3: Reddit Native .json API (Videos, Gifs, and High-Res Photos)
    let cleanUrl = targetUrl.split('?')[0].replace(/\/$/, '');
    if (cleanUrl.includes('/comments/')) {
      try {
        const jsonUrl = `${cleanUrl}.json`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(jsonUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const post = data?.[0]?.data?.children?.[0]?.data;
          if (post) {
            const title = post.title || 'Reddit Media';
            const thumbnail =
              post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined;
            const video =
              post.media?.reddit_video ||
              post.secure_media?.reddit_video ||
              post.crosspost_parent_list?.[0]?.secure_media?.reddit_video ||
              post.preview?.reddit_video_preview;

            let videoStreamUrl = video?.fallback_url;
            if (
              !videoStreamUrl &&
              post.url &&
              (post.url.endsWith('.mp4') || post.url.endsWith('.gifv') || post.url.endsWith('.gif'))
            ) {
              videoStreamUrl = post.url.replace('.gifv', '.mp4');
            }

            if (videoStreamUrl) {
              return {
                status: 'redirect',
                url: videoStreamUrl,
                filename: `media_${post.id || Date.now()}.mp4`,
                title,
                thumbnail,
                duration: video?.duration,
                platform: 'reddit',
                originalUrl: url,
                availableQualities: ['Original Quality'],
                audioOnlyAvailable: false,
              };
            }

            // If image or gallery post
            let imageUrl: string | null = null;
            if (post.url && (/\.(jpe?g|png|webp|gif)$/i.test(post.url) || post.url.includes('i.redd.it'))) {
              imageUrl = post.url;
            } else if (post.preview?.images?.[0]?.source?.url) {
              imageUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
            }

            if (imageUrl) {
              const ext = imageUrl.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || 'jpg';
              return {
                status: 'redirect',
                url: imageUrl,
                filename: `reddit_${post.id || Date.now()}.${ext}`,
                title,
                thumbnail: imageUrl,
                platform: 'reddit',
                originalUrl: url,
                availableQualities: ['Original High-Res Photo'],
                audioOnlyAvailable: false,
              };
            }
          }
        }
      } catch {}
    }

    // 5. Strategy 4: Public Community Cobalt Fleet for Reddit
    for (const cobaltHost of PUBLIC_COBALT_SERVERS) {
      try {
        const cobaltRes = await fetchFromCobalt(cobaltHost, targetUrl, {}, { displayName: 'Reddit', platform: 'reddit' });
        if (cobaltRes && cobaltRes.url) {
          return cobaltRes;
        }
      } catch {}
    }
  } catch {}
  return null;
}

// Direct In-App Extractor for Snapchat (Spotlight, Stories)
async function resolveSnapchatDirect(url: string): Promise<ResolveResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const ogVideoMatch =
        html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);
      const ogTitleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const ogImageMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      if (ogVideoMatch?.[1]) {
        return {
          status: 'redirect',
          url: ogVideoMatch[1].replace(/&amp;/g, '&'),
          filename: `media_${Date.now()}.mp4`,
          title: ogTitleMatch?.[1] || 'Video File',
          thumbnail: ogImageMatch?.[1],
          platform: 'snapchat',
          originalUrl: url,
          availableQualities: ['Original Quality'],
          audioOnlyAvailable: false,
        };
      }
    }
  } catch {}
  return null;
}

// Direct In-App Extractor for Pinterest (Videos, Pins, Idea Pins, High-Res Images)
async function resolvePinterestDirect(url: string): Promise<ResolveResult | null> {
  try {
    let targetUrl = url.trim();

    // 1. Follow pin.it shortlinks to canonical Pinterest URL
    if (targetUrl.includes('pin.it/')) {
      try {
        const headCtrl = new AbortController();
        const headTimeout = setTimeout(() => headCtrl.abort(), 6000);
        const headRes = await fetch(targetUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          signal: headCtrl.signal,
        });
        clearTimeout(headTimeout);
        if (headRes.url && headRes.url.includes('pinterest.')) {
          targetUrl = headRes.url;
        }
      } catch {}
    }

    // 2. Strategy 1: Official Pinterest Public Pidgets API (Instant, unauthenticated, full HD video & originals)
    const pinIdMatch = targetUrl.match(/\/pin\/([0-9]+)/i) || targetUrl.match(/([0-9]{15,})/i);
    if (pinIdMatch && pinIdMatch[1]) {
      const pinId = pinIdMatch[1];
      try {
        const pidgetCtrl = new AbortController();
        const pidgetTimeout = setTimeout(() => pidgetCtrl.abort(), 6000);
        const pidgetRes = await fetch(
          `https://api.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
            signal: pidgetCtrl.signal,
          }
        );
        clearTimeout(pidgetTimeout);

        if (pidgetRes.ok) {
          const pData = await pidgetRes.json();
          const pin = pData?.data?.pins?.[0];
          if (pin) {
            const title = pin.description || 'Pinterest Pin';
            const thumb = pin.images?.originals?.url || pin.images?.['564x']?.url;

            // Check if Video Pin
            const videoList = pin.videos?.video_list;
            let videoStream: string | null = null;
            if (videoList) {
              const preferredOrder = ['V_720P', 'V_EXP_720P', 'V_480P', 'V_HLSV4', 'V_HLSV3'];
              for (const q of preferredOrder) {
                if (videoList[q]?.url && videoList[q].url.includes('.mp4')) {
                  videoStream = videoList[q].url;
                  break;
                }
              }
              if (!videoStream) {
                for (const key of Object.keys(videoList)) {
                  if (videoList[key]?.url && videoList[key].url.includes('.mp4')) {
                    videoStream = videoList[key].url;
                    break;
                  }
                }
              }
            }

            if (videoStream) {
              return {
                status: 'redirect',
                url: videoStream,
                filename: `media_${pinId}.mp4`,
                title: title || 'Media File',
                thumbnail: thumb,
                platform: 'pinterest',
                originalUrl: url,
                availableQualities: ['Original 720p HD MP4'],
                audioOnlyAvailable: false,
              };
            }

            // High-res photo pin
            const origImg = pin.images?.originals?.url || pin.images?.['564x']?.url;
            if (origImg) {
              return {
                status: 'redirect',
                url: origImg,
                filename: `media_${pinId}.jpg`,
                title: title || 'Media File',
                thumbnail: origImg,
                platform: 'pinterest',
                originalUrl: url,
                availableQualities: ['Original High-Res Photo'],
                audioOnlyAvailable: false,
              };
            }
          }
        }
      } catch {}
    }

    // 3. Strategy 2: SaveFrom Gateway for Pinterest
    try {
      const sfCtrl = new AbortController();
      const sfTimeout = setTimeout(() => sfCtrl.abort(), 7000);
      const sfRes = await fetch(
        `https://worker.sf-tools.com/savefrom.php?sf_url=${encodeURIComponent(targetUrl)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
            Referer: 'https://en.savefrom.net/',
          },
          signal: sfCtrl.signal,
        }
      );
      clearTimeout(sfTimeout);

      if (sfRes.ok) {
        const sfData = await sfRes.json();
        const urls = sfData?.url || [];
        if (Array.isArray(urls) && urls.length > 0) {
          const video = urls.find((u: any) => u.url && (u.ext === 'mp4' || u.type === 'video'));
          const chosen = video || urls[0];
          if (chosen?.url) {
            const isVid = !!video || chosen.url.includes('.mp4');
            return {
              status: 'redirect',
              url: chosen.url,
              filename: `media_${Date.now()}.${isVid ? 'mp4' : 'jpg'}`,
              title: sfData?.meta?.title || 'Media File',
              thumbnail: sfData?.thumb,
              platform: 'pinterest',
              originalUrl: url,
              availableQualities: ['Original Quality'],
              audioOnlyAvailable: false,
            };
          }
        }
      }
    } catch {}

    // 4. Strategy 3: Direct Page Fetch with Crawler Headers & JSON parsing
    try {
      const pageCtrl = new AbortController();
      const pageTimeout = setTimeout(() => pageCtrl.abort(), 7000);
      const pageRes = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          Accept: 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: pageCtrl.signal,
      });
      clearTimeout(pageTimeout);

      if (pageRes.ok) {
        const html = await pageRes.text();

        // Check OpenGraph video
        const ogVideo =
          html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);
        const ogImage =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        const ogTitle =
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

        let mediaUrl = ogVideo?.[1]?.replace(/&amp;/g, '&');
        let isVideo = true;

        // If no og:video, check embedded video URLs in __PWS_DATA__ or scripts
        if (!mediaUrl) {
          const vMatch = html.match(/https?:\/\/[^"'\s<>]+\.pinimg\.com\/videos\/[^"'\s<>]+\.mp4/i);
          if (vMatch) {
            mediaUrl = vMatch[0].replace(/\\u002F/g, '/');
          }
        }

        // If still no video, fall back to high-res image
        if (!mediaUrl && ogImage?.[1]) {
          mediaUrl = ogImage[1].replace(/&amp;/g, '&');
          isVideo = false;
        }

        if (mediaUrl) {
          return {
            status: 'redirect',
            url: mediaUrl,
            filename: `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
            title: ogTitle?.[1] || 'Media File',
            thumbnail: ogImage?.[1],
            platform: 'pinterest',
            originalUrl: url,
            availableQualities: ['Original Quality'],
            audioOnlyAvailable: false,
          };
        }
      }
    } catch {}

    // 5. Strategy 4: Public Community Cobalt Fleet for Pinterest
    for (const cobaltHost of PUBLIC_COBALT_SERVERS) {
      try {
        const cobaltRes = await fetchFromCobalt(cobaltHost, targetUrl, {}, { displayName: 'Pinterest', platform: 'pinterest' });
        if (cobaltRes && cobaltRes.url) {
          return cobaltRes;
        }
      } catch {}
    }
  } catch (err) {
    console.log('resolvePinterestDirect error:', err);
  }
  return null;
}

// Helpers for Facebook Direct Extractor
const FB_LINK_CRAWLER_AGENT =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const FB_BROWSER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FB_MOBILE_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36';
const FB_BOT_AGENT =
  'Googlebot/2.1 (+http://www.google.com/bot.html)';

function decodeFacebookString(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\u0025/g, '%')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u003F/gi, '?')
    .replace(/&amp;/g, '&')
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\/g, '');
}

function cleanFbStreamUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return decodeFacebookString(raw);
}

function decodeFbHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#xb7;/g, '·')
    .replace(/&#xa0;/g, ' ')
    .replace(/&#x2014;/g, '—')
    .replace(/&#x2013;/g, '–')
    .replace(/&#x2019;/g, '’')
    .replace(/&#x2018;/g, '‘')
    .replace(/&#064;/g, '@')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

function extractFbVideoId(url: string, html?: string): string | null {
  // 1. URL query parameters ?v= or &v=
  const vMatch = url.match(/[?&]v=([0-9]+)/);
  if (vMatch) return vMatch[1];

  // 2. URL paths: /videos/123/ or /reel/123/ or /posts/123/ or /share/r/123/
  const pathMatch = url.match(/\/(?:videos|reel|posts|share\/[rv])\/([0-9]+)/);
  if (pathMatch) return pathMatch[1];

  // 3. HTML metadata payload
  if (html) {
    const idMatch =
      html.match(/"video_id":\s*"([0-9]+)"/) ||
      html.match(/video_id=([0-9]+)/) ||
      html.match(/"entity_id":\s*"([0-9]+)"/);
    if (idMatch) return idMatch[1];
  }

  return null;
}

function isValidFbCdnStream(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  // Reject crawler placeholder redirect URLs that serve 327-byte HTML redirect scripts instead of video
  if (url.includes('lookaside.fbsbx.com')) return false;
  // Reject manifest/playlist files – we need a direct MP4
  if (url.includes('.m3u8') || url.includes('.mpd')) return false;
  return true;
}

function parseFbStreams(html: string): { hdUrl: string | null; sdUrl: string | null } {
  if (!html) return { hdUrl: null, sdUrl: null };

  const hdKeys = [
    'browser_native_hd_url',
    'playable_url_quality_hd',
    'hd_src_no_ratelimit',
    'hd_src',
  ];
  const sdKeys = [
    'browser_native_sd_url',
    'playable_url',
    'sd_src_no_ratelimit',
    'sd_src',
  ];

  const pickUrl = (keys: string[]): string | null => {
    for (const key of keys) {
      // 1. Check JSON property format "key":"..."
      const jsonMatch = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
      if (jsonMatch && jsonMatch[1]) {
        const decoded = decodeFacebookString(jsonMatch[1]);
        if (isValidFbCdnStream(decoded)) return decoded;
      }
      // 2. Check HTML / XML attribute format key="..."
      const attrMatch = html.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`));
      if (attrMatch && attrMatch[1]) {
        const decoded = decodeFacebookString(attrMatch[1]);
        if (isValidFbCdnStream(decoded)) return decoded;
      }
    }
    return null;
  };

  let hdUrl = pickUrl(hdKeys);
  let sdUrl = pickUrl(sdKeys);

  // Extra pass: scan for any fna.fbcdn.net or video.xx.fbcdn.net CDN URLs in the page
  // These appear in JSON blobs for restricted/age-gated content differently
  if (!hdUrl && !sdUrl) {
    const cdnPattern = /https?:\/\/[\w.-]*\.(?:fbcdn\.net|fbcdnp\.com)\/v\/[^"'\s>]+\.mp4[^"'\s>]*/gi;
    const cdnMatches = html.match(cdnPattern);
    if (cdnMatches) {
      for (const raw of cdnMatches) {
        const decoded = decodeFacebookString(raw);
        if (isValidFbCdnStream(decoded)) {
          if (!sdUrl) sdUrl = decoded;
        }
      }
    }
  }

  return { hdUrl, sdUrl };
}

// Fetch a Facebook page with a given User-Agent and return text, or null on failure
async function fetchFbPage(
  url: string,
  userAgent: string,
  timeoutMs = 6000,
  extraHeaders: Record<string, string> = {}
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Direct In-App Extractor for Facebook (Watch, Reels, Videos, Shares)
async function resolveFacebookDirect(
  url: string,
  options: Partial<CobaltRequestOptions> = {}
): Promise<ResolveResult | null> {
  try {
    let canonicalUrl = url;
    let videoId = extractFbVideoId(url);
    let pageHtml = '';

    const isShortLink = /fb\.watch\/|facebook\.com\/share\/[rvp]\//i.test(url);

    // Step 1: Only resolve shortlinks & redirects via Crawler User Agent if it is actually a share link
    if (isShortLink) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': FB_LINK_CRAWLER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          pageHtml = await res.text();
          let finalDest = res.url || url;

          // If redirected to login.php?next=..., extract the real canonical URL from query param
          if (finalDest.includes('login.php') && finalDest.includes('next=')) {
            try {
              const parsed = new URL(finalDest, 'https://www.facebook.com');
              const nextParam = parsed.searchParams.get('next');
              if (nextParam) finalDest = decodeURIComponent(nextParam);
            } catch {}
          }
          canonicalUrl = finalDest;

          // Check canonical tag in HTML
          const canonicalMatch =
            pageHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
            pageHtml.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
          if (canonicalMatch && canonicalMatch[1] && !canonicalMatch[1].includes('login.php')) {
            canonicalUrl = canonicalMatch[1];
          }
        }
      } catch (err) {
        console.log('Crawler resolve error (proceeding with original URL):', err);
      }
    }

    if (!videoId) {
      videoId = extractFbVideoId(canonicalUrl, pageHtml);
    }

    let streams = { hdUrl: null as string | null, sdUrl: null as string | null };

    // ─── Strategy 1: Standard embed plugin (desktop UA) ─────────────────────────
    {
      const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonicalUrl)}&show_text=false&autoplay=false`;
      const embedHtml = await fetchFbPage(embedUrl, FB_BROWSER_AGENT, 7000, {
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      });
      if (embedHtml) {
        const s = parseFbStreams(embedHtml);
        if (s.hdUrl || s.sdUrl) { streams = s; pageHtml = embedHtml; }
      }
    }

    // ─── Strategy 2: embed plugin with story_fbid format (age-gate bypass) ───────
    if (!streams.hdUrl && !streams.sdUrl && videoId) {
      const storyEmbedUrl = `https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fvideo%2F${videoId}&show_text=false`;
      const storyHtml = await fetchFbPage(storyEmbedUrl, FB_BROWSER_AGENT, 6000);
      if (storyHtml) {
        const s = parseFbStreams(storyHtml);
        if (s.hdUrl || s.sdUrl) { streams = s; pageHtml = storyHtml; }
      }
    }

    // ─── Strategy 3: Mobile web fetch (stripped UA — often no age gate) ──────────
    if (!streams.hdUrl && !streams.sdUrl) {
      const mobileCandidates: string[] = [
        videoId ? `https://m.facebook.com/watch/?v=${videoId}` : '',
        videoId ? `https://m.facebook.com/video/embed?video_id=${videoId}` : '',
        canonicalUrl.replace('www.facebook.com', 'm.facebook.com'),
      ].filter(Boolean);

      for (const mUrl of mobileCandidates) {
        const mHtml = await fetchFbPage(mUrl, FB_MOBILE_AGENT, 6000, {
          'Accept-Language': 'en-US,en;q=0.5',
        });
        if (mHtml) {
          if (!videoId) videoId = extractFbVideoId(mUrl, mHtml);
          const s = parseFbStreams(mHtml);
          if (s.hdUrl || s.sdUrl) { streams = s; pageHtml = mHtml; break; }
        }
      }
    }

    // ─── Strategy 4: Googlebot UA — Facebook serves clean JSON for crawlers ──────
    if (!streams.hdUrl && !streams.sdUrl && videoId) {
      const botCandidates = [
        `https://www.facebook.com/video.php?v=${videoId}`,
        `https://www.facebook.com/watch/?v=${videoId}`,
      ];
      for (const bUrl of botCandidates) {
        const bHtml = await fetchFbPage(bUrl, FB_BOT_AGENT, 6000);
        if (bHtml) {
          const s = parseFbStreams(bHtml);
          if (s.hdUrl || s.sdUrl) { streams = s; pageHtml = bHtml; break; }
        }
      }
    }

    // ─── Strategy 5: Third-party proxy — getfvid.com (handles restricted/private) ─
    if (!streams.hdUrl && !streams.sdUrl) {
      try {
        const proxyController = new AbortController();
        const proxyTimeout = setTimeout(() => proxyController.abort(), 8000);
        const proxyRes = await fetch('https://www.getfvid.com/downloader', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': FB_BROWSER_AGENT,
            'Referer': 'https://www.getfvid.com/',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: `url=${encodeURIComponent(canonicalUrl)}&token=`,
          signal: proxyController.signal,
        });
        clearTimeout(proxyTimeout);
        if (proxyRes.ok) {
          const proxyText = await proxyRes.text();
          // getfvid returns JSON or HTML containing CDN links
          const fnaMatch = proxyText.match(/https?:\/\/[\w.-]*\.fbcdn\.net\/v\/[^"'\s>]+\.mp4[^"'\s>]*/i);
          if (fnaMatch) {
            const decoded = decodeFacebookString(fnaMatch[0]);
            if (isValidFbCdnStream(decoded)) {
              streams.sdUrl = decoded;
              pageHtml = proxyText;
            }
          }
          // Also try JSON fields
          if (!streams.sdUrl) {
            try {
              const proxyJson = JSON.parse(proxyText);
              const hdLink = proxyJson?.links?.HD || proxyJson?.hd || proxyJson?.data?.hd;
              const sdLink = proxyJson?.links?.SD || proxyJson?.sd || proxyJson?.data?.sd;
              if (hdLink && isValidFbCdnStream(hdLink)) streams.hdUrl = hdLink;
              if (sdLink && isValidFbCdnStream(sdLink)) streams.sdUrl = sdLink;
            } catch {}
          }
        }
      } catch (err) {
        console.log('FB proxy (getfvid) error:', err);
      }
    }

    // ─── Strategy 6: savefrom.net API fallback ───────────────────────────────────
    if (!streams.hdUrl && !streams.sdUrl) {
      try {
        const sfController = new AbortController();
        const sfTimeout = setTimeout(() => sfController.abort(), 8000);
        const sfRes = await fetch(
          `https://worker.sf-tools.com/savefrom.php?sf_url=${encodeURIComponent(canonicalUrl)}`,
          {
            headers: {
              'User-Agent': FB_BROWSER_AGENT,
              'Accept': 'application/json',
              'Referer': 'https://en.savefrom.net/',
            },
            signal: sfController.signal,
          }
        );
        clearTimeout(sfTimeout);
        if (sfRes.ok) {
          const sfJson = await sfRes.json();
          // savefrom returns { url: [ { id, url, quality } ] }
          const sfLinks: any[] = sfJson?.url || [];
          const hdEntry = sfLinks.find((l: any) => l.id?.includes('hd') || (l.quality && parseInt(l.quality) >= 720));
          const sdEntry = sfLinks.find((l: any) => l.url && !l.id?.includes('audio'));
          if (hdEntry?.url && isValidFbCdnStream(hdEntry.url)) streams.hdUrl = hdEntry.url;
          if (!streams.hdUrl && sdEntry?.url && isValidFbCdnStream(sdEntry.url)) streams.sdUrl = sdEntry.url;
        }
      } catch (err) {
        console.log('FB proxy (savefrom) error:', err);
      }
    }

    // ─── Strategy 7: Fallback to any prior crawler page HTML ─────────────────────
    if (!streams.hdUrl && !streams.sdUrl && pageHtml) {
      streams = parseFbStreams(pageHtml);
    }

    if (!streams.hdUrl && !streams.sdUrl) {
      return null;
    }

    // Step 5: Extract Clean Title
    let pageTitle = 'Video File';
    const ogTitleMatch =
      pageHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      pageHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
      pageHtml.match(/<title>([^<]+)<\/title>/i);

    if (ogTitleMatch) {
      let rawTitle = decodeFbHtmlEntities(ogTitleMatch[1]);
      rawTitle = rawTitle.replace(/\s*\|\s*Facebook$/i, '');
      if (rawTitle.includes(' | ')) {
        const parts = rawTitle.split(' | ');
        rawTitle = parts[parts.length - 1];
      }
      if (rawTitle.length > 0 && rawTitle.toLowerCase() !== 'facebook') {
        pageTitle = rawTitle;
      }
    }

    // Step 6: Extract Thumbnail
    let thumbnail: string | undefined = undefined;

    // A. og:image
    const ogImageMatch =
      pageHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      pageHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1] && !ogImageMatch[1].includes('static.xx.fbcdn.net')) {
      thumbnail = decodeFacebookString(decodeFbHtmlEntities(ogImageMatch[1])) || undefined;
    }

    // B. JSON thumbnail metadata
    if (!thumbnail) {
      const thumbJsonMatch =
        pageHtml.match(/"preferred_thumbnail"\s*:\s*\{\s*"image"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"/i) ||
        pageHtml.match(/"thumbnailImage"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"/i);
      if (thumbJsonMatch && thumbJsonMatch[1]) {
        thumbnail = decodeFacebookString(thumbJsonMatch[1]);
      }
    }

    // C. CDN poster image (/t15. or /t39.)
    if (!thumbnail) {
      const cdnThumbMatch =
        pageHtml.match(/https:\\\/\\\/[^"'\s]+?\/(?:t15\.|t39\.)[^"'\s]*?\.(?:jpg|jpeg|png|webp)[^"'\s]*/i) ||
        pageHtml.match(/https:\/\/[^"'\s]+?\/(?:t15\.|t39\.)[^"'\s]*?\.(?:jpg|jpeg|png|webp)[^"'\s]*/i);
      if (cdnThumbMatch) {
        thumbnail = decodeFacebookString(cdnThumbMatch[0]);
      }
    }

    // Quality selection
    let chosenUrl = streams.hdUrl || streams.sdUrl!;
    if (options.videoQuality === '480' || options.videoQuality === '360') {
      chosenUrl = streams.sdUrl || streams.hdUrl!;
    }

    const availableQualities: string[] = [];
    if (streams.hdUrl) availableQualities.push('HD (High Quality)');
    if (streams.sdUrl) availableQualities.push('SD (Standard Quality)');

    return {
      status: 'redirect',
      url: chosenUrl,
      filename: `media_${videoId || Date.now()}.mp4`,
      title: pageTitle,
      thumbnail,
      platform: 'facebook',
      originalUrl: url,
      availableQualities,
      audioOnlyAvailable: false,
    };
  } catch (err) {
    console.log('resolveFacebookDirect error:', err);
    return null;
  }
}

// Helper: unpack Snapsave Dean Edwards packed JavaScript
function unpackSnapsave(raw: string): string | null {
  try {
    const evalIdx = raw.lastIndexOf('eval(');
    if (evalIdx === -1) return null;
    const code = raw.substring(0, evalIdx) + 'return (' + raw.substring(evalIdx + 5);
    const fn = new Function(code);
    return fn() as string;
  } catch {
    return null;
  }
}

// Direct In-App Extractor for Instagram (Posts, Reels, Stories)
async function resolveInstagramDirect(url: string): Promise<ResolveResult | null> {
  try {
    // Normalise: strip tracking params, ensure https, no trailing slash
    let cleanUrl = url.trim().replace(/^http:\/\//, 'https://');
    try {
      const u = new URL(cleanUrl);
      u.search = '';
      cleanUrl = u.toString().replace(/\/$/, '');
    } catch {}

    // Extract shortcode from /p/, /reel/, /tv/, /stories/account/, /share/reel/
    const scMatch =
      cleanUrl.match(/(?:instagram\.com|instagr\.am)\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv|stories\/[^/]+|share\/(?:reel|p))\/([A-Za-z0-9_-]+)/i) ||
      cleanUrl.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i);
    const shortcode = scMatch ? scMatch[1] : null;

    let title = 'Video File';
    let thumbnail: string | undefined;

    // Helper: build a result object
    const buildResult = (videoUrl: string, method?: string): ResolveResult => {
      console.log(`[Instagram] Successfully resolved video using: ${method || 'direct stream'}`);
      return {
        status: 'redirect',
        url: videoUrl,
        filename: `media_${shortcode || Date.now()}.mp4`,
        title,
        thumbnail,
        platform: 'instagram',
        originalUrl: url,
        availableQualities: ['Original Quality'],
        audioOnlyAvailable: false,
      };
    };

    // Helper: decode escaped URL strings
    const decodeIg = (s: string) =>
      s
        .replace(/\\u0026/gi, '&')
        .replace(/\\u002F/gi, '/')
        .replace(/&amp;/gi, '&')
        .replace(/\\/g, '');

    if (!shortcode) return null;

    // Fast concurrent checks with tight 2.2s timeout
    const strategyEmbed = async (): Promise<ResolveResult | null> => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 2200);
        const res = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.18.108',
            Accept: 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: ctrl.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const html = await res.text();
          const cdnPattern =
            /https?:\/\/[\w.-]*(?:cdninstagram\.com|fbcdn\.net)\/[^"'\s<>]+\.mp4[^"'\s<>]*/gi;
          const cdnMatches = html.match(cdnPattern);
          if (cdnMatches && cdnMatches.length > 0) {
            const best =
              cdnMatches.find((u) => !u.includes('/t51.') && !u.includes('/s320x320/')) ||
              cdnMatches[0];
            return buildResult(decodeIg(best), 'fast embed scan');
          }
        }
      } catch {}
      return null;
    };

    const strategyBot = async (): Promise<ResolveResult | null> => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`https://www.instagram.com/reel/${shortcode}/`, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: ctrl.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const html = await res.text();
          const ogVideoMatch =
            html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);
          const ogTitleMatch =
            html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
          const ogImageMatch =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

          if (ogTitleMatch?.[1]) title = decodeIg(ogTitleMatch[1]);
          if (ogImageMatch?.[1]) thumbnail = decodeIg(ogImageMatch[1]);

          if (ogVideoMatch?.[1]) {
            const stream = decodeIg(ogVideoMatch[1]);
            if (stream.includes('.mp4') || stream.includes('fbcdn.net') || stream.includes('cdninstagram.com')) {
              return buildResult(stream, 'og:video bot crawler');
            }
          }
        }
      } catch {}
      return null;
    };

    // Run both simultaneously: if either succeeds, return immediately
    const results = await Promise.allSettled([strategyEmbed(), strategyBot()]);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        return r.value;
      }
    }
  } catch (err) {
    console.log('[Instagram] resolve error:', err);
  }
  return null;
}


export function parseCobaltErrorCode(code?: string): string {
  switch (code) {
    case 'error.api.unsupported_service':
      return 'This platform is not supported by Cobalt.';
    case 'error.api.service_unavailable':
      return 'The server is currently unavailable or rate-limited.';
    case 'error.api.content.private':
      return 'This content is private or age-restricted and cannot be downloaded.';
    case 'error.api.content.post_not_found':
      return 'Post or video was deleted or cannot be found.';
    case 'error.api.link.invalid':
      return 'The pasted link is invalid or incomplete.';
    case 'error.api.rate_limit':
      return 'Download rate limit exceeded. Please wait a moment.';
    default:
      return code ? `Resolution failed: ${code}` : 'Failed to resolve media from URL.';
  }
}

function formatFilenameToTitle(filename?: string): string | undefined {
  if (!filename) return undefined;
  return filename.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' ');
}

function getThumbnailFromCobalt(data: CobaltApiResponse, platform: string): string | undefined {
  if (data.picker && data.picker.length > 0 && data.picker[0].thumb) {
    return data.picker[0].thumb;
  }
  return undefined;
}

// Built-in offline mock resolver for development and simulator
export function mockResolveMedia(url: string): ResolveResult {
  const platformInfo = detectPlatform(url);
  const sampleVideos = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  ];
  const sampleThumbs = [
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
  ];

  const randomIndex = Math.floor(Math.random() * sampleVideos.length);

  return {
    status: 'redirect',
    url: sampleVideos[randomIndex],
    filename: `${platformInfo.displayName.toLowerCase()}_sample_${Date.now()}.mp4`,
    title: `Cosmic Singularity - ${platformInfo.displayName} Showcase`,
    thumbnail: sampleThumbs[randomIndex],
    duration: 15,
    platform: platformInfo.platform,
    originalUrl: url,
    availableQualities: ['1080p (Full HD)', '720p (HD)', '480p (SD)'],
    audioOnlyAvailable: false,
  };
}
