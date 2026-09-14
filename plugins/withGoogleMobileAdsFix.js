const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to pass -Xskip-metadata-version-check and -Xskip-prerelease-check
 * to Kotlin compile tasks across all projects.
 *
 * This resolves the Android build failure caused by play-services-ads:25.4.0
 * having Kotlin 2.3.0 metadata while Expo SDK 57 uses Kotlin 2.1.20,
 * and preserves AgeRestrictedTreatment needed by react-native-google-mobile-ads.
 */
const withGoogleMobileAdsFix = (config) => {
  return withProjectBuildGradle(config, (modConfig) => {
    const buildGradle = modConfig.modResults.contents;

    const kotlinFixSnippet = `
allprojects {
    tasks.configureEach { task ->
        if (task.getClass().getName().contains("KotlinCompile")) {
            try {
                task.kotlinOptions {
                    freeCompilerArgs += [
                        "-Xskip-metadata-version-check",
                        "-Xskip-prerelease-check"
                    ]
                }
            } catch (Exception ignored) {}
            try {
                task.compilerOptions {
                    freeCompilerArgs.addAll(
                        "-Xskip-metadata-version-check",
                        "-Xskip-prerelease-check"
                    )
                }
            } catch (Exception ignored) {}
        }
    }
}
`;

    if (!buildGradle.includes('-Xskip-metadata-version-check')) {
      modConfig.modResults.contents = buildGradle + '\n' + kotlinFixSnippet;
    }

    return modConfig;
  });
};

module.exports = withGoogleMobileAdsFix;

