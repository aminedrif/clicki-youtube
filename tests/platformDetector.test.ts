import { detectPlatform, extractUrl } from '../src/services/platformDetector';

function runTests() {
  console.log('--- Testing Platform Detection & URL Extraction ---');

  const testCases: { input: string; expectedPlatform: string; shouldPass: boolean }[] = [
    {
      input: 'Check this out https://www.tiktok.com/@creator/video/7123456789012345678 cool right?',
      expectedPlatform: 'tiktok',
      shouldPass: true,
    },
    {
      input: 'https://vm.tiktok.com/ZM8xABCde/',
      expectedPlatform: 'tiktok',
      shouldPass: true,
    },
    {
      input: 'https://www.instagram.com/reel/C8xYz123456/',
      expectedPlatform: 'instagram',
      shouldPass: true,
    },
    {
      input: 'https://www.instagram.com/p/C9abcde1234/',
      expectedPlatform: 'instagram',
      shouldPass: true,
    },
    {
      input: 'https://youtu.be/dQw4w9WgXcQ',
      expectedPlatform: 'youtube',
      shouldPass: true,
    },
    {
      input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expectedPlatform: 'youtube',
      shouldPass: true,
    },
    {
      input: 'https://www.youtube.com/shorts/3f5g7h8j9k0',
      expectedPlatform: 'youtube',
      shouldPass: true,
    },
    {
      input: 'https://x.com/user/status/1832000000000000000',
      expectedPlatform: 'twitter',
      shouldPass: true,
    },
    {
      input: 'https://twitter.com/user/status/1234567890',
      expectedPlatform: 'twitter',
      shouldPass: true,
    },
    {
      input: 'https://fb.watch/abcd1234ef/',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://www.facebook.com/watch/?v=10158234567890123',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://www.facebook.com/watch?v=10158234567890123',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://www.facebook.com/reel/10158234567890123',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://www.facebook.com/share/r/abc123xyz/?mibextid=wwXIfr',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://www.facebook.com/share/v/abc123xyz/?mibextid=wwXIfr',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://www.facebook.com/video.php?v=10158234567890123',
      expectedPlatform: 'facebook',
      shouldPass: true,
    },
    {
      input: 'https://pin.it/7xYz123',
      expectedPlatform: 'pinterest',
      shouldPass: true,
    },
    {
      input: 'https://www.pinterest.com/pin/1085085854083319018/',
      expectedPlatform: 'pinterest',
      shouldPass: true,
    },
    {
      input: 'https://www.reddit.com/r/videos/comments/1f4xyz/amazing_space_phenomenon/',
      expectedPlatform: 'reddit',
      shouldPass: true,
    },
    {
      input: 'https://www.reddit.com/r/funny/s/AbCdEfGh12',
      expectedPlatform: 'reddit',
      shouldPass: true,
    },
    {
      input: 'https://redd.it/1f4xyz',
      expectedPlatform: 'reddit',
      shouldPass: true,
    },
    {
      input: 'https://www.snapchat.com/spotlight/W7_EDD12345',
      expectedPlatform: 'snapchat',
      shouldPass: true,
    },
    {
      input: 'https://google.com/search?q=black+hole',
      expectedPlatform: 'unknown',
      shouldPass: false,
    },
    {
      input: 'Just some random text copied without any link',
      expectedPlatform: 'unknown',
      shouldPass: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const extracted = extractUrl(tc.input);
    if (!extracted) {
      if (!tc.shouldPass) {
        console.log(`[PASS] Correctly detected no link in: "${tc.input}"`);
        passed++;
      } else {
        console.error(`[FAIL] Failed to extract URL from: "${tc.input}"`);
        failed++;
      }
      continue;
    }

    const platform = detectPlatform(extracted);
    if (platform.platform === tc.expectedPlatform) {
      console.log(`[PASS] Correctly identified ${platform.platform.toUpperCase()} (${platform.displayName})`);
      passed++;
    } else {
      console.error(
        `[FAIL] Expected ${tc.expectedPlatform}, got ${platform.platform} for URL: ${extracted}`
      );
      failed++;
    }
  }

  console.log(`\nResults: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
