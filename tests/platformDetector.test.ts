import { detectPlatform, extractUrl } from '../src/services/platformDetector';

function runTests() {
  console.log('--- Testing CLICKI Youtube Platform Detection (YouTube Only) ---');

  const testCases: { input: string; expectedPlatform: string; shouldBeValid: boolean }[] = [
    {
      input: 'Check out this song https://youtu.be/dQw4w9WgXcQ amazing track!',
      expectedPlatform: 'youtube',
      shouldBeValid: true,
    },
    {
      input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expectedPlatform: 'youtube',
      shouldBeValid: true,
    },
    {
      input: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      expectedPlatform: 'youtube',
      shouldBeValid: true,
    },
    {
      input: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
      expectedPlatform: 'youtube',
      shouldBeValid: true,
    },
    {
      input: 'https://www.youtube.com/shorts/3f5g7h8j9k0',
      expectedPlatform: 'youtube',
      shouldBeValid: true,
    },
    // Non-YouTube platforms must be rejected
    {
      input: 'https://www.tiktok.com/@creator/video/7123456789012345678',
      expectedPlatform: 'unknown',
      shouldBeValid: false,
    },
    {
      input: 'https://www.instagram.com/reel/C8xYz123456/',
      expectedPlatform: 'unknown',
      shouldBeValid: false,
    },
    {
      input: 'https://x.com/user/status/1832000000000000000',
      expectedPlatform: 'unknown',
      shouldBeValid: false,
    },
    {
      input: 'https://www.facebook.com/watch/?v=10158234567890123',
      expectedPlatform: 'unknown',
      shouldBeValid: false,
    },
    {
      input: 'https://pin.it/7xYz123',
      expectedPlatform: 'unknown',
      shouldBeValid: false,
    },
    {
      input: 'https://reddit.com/r/videos/comments/1f4xyz/test',
      expectedPlatform: 'unknown',
      shouldBeValid: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const extracted = extractUrl(tc.input);
    if (!extracted) {
      console.error(`[FAIL] Could not extract URL from: "${tc.input}"`);
      failed++;
      continue;
    }

    const platform = detectPlatform(extracted);
    if (platform.platform === tc.expectedPlatform && platform.isValid === tc.shouldBeValid) {
      console.log(`[PASS] ${extracted.substring(0, 45)} -> platform: ${platform.platform}, isValid: ${platform.isValid}`);
      passed++;
    } else {
      console.error(
        `[FAIL] Expected platform: ${tc.expectedPlatform} (valid: ${tc.shouldBeValid}), got: ${platform.platform} (valid: ${platform.isValid}) for ${extracted}`
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
