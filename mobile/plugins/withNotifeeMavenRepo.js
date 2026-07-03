const { withAppBuildGradle } = require("@expo/config-plugins");

// ponytail: @notifee/react-native ships its native `app.notifee:core` AAR as
// a local flat maven repo in node_modules (no internet needed). Its own
// build.gradle injects that repo into every project via
// `rootProject.allprojects`, but that cross-project mutation races under
// Gradle's --configure-on-demand (which `expo run:android` always passes) —
// :app has no repositories block of its own, so it depends entirely on this
// injection landing before its dependencies resolve, and sometimes it
// doesn't. Declaring the repo directly on :app sidesteps the race.
const withNotifeeMavenRepo = (config) =>
  withAppBuildGradle(config, (config) => {
    const marker = "@notifee/react-native/android/libs";
    if (!config.modResults.contents.includes(marker)) {
      const anchor = 'apply plugin: "com.facebook.react"';
      config.modResults.contents = config.modResults.contents.replace(
        anchor,
        `${anchor}\n\nrepositories {\n    maven { url "$rootDir/../node_modules/${marker}" }\n}`,
      );
    }
    return config;
  });

module.exports = withNotifeeMavenRepo;
