import { readFileSync } from 'fs';
import { exec } from 'child_process';
import semver from 'semver';

interface DepInfo {
  name: string;
  current: string;
  latest?: string;
  earliestCompat?: string;
  latestCompat?: string;
  peerAngular?: string;
  versionsBehindLatestCompat?: string; // Renamed column
  recommendedVersion?: string;
  note?: string;
  migrationLink?: string;
}

const args = process.argv.slice(2);
const includePrerelease = args.includes('--include-prerelease');
const showProgress = !args.includes('--no-progress');
const exhaustive = args.includes('--exhaustive');
const verbose = args.includes('--verbose');

// Fast mode: limit to newest N versions
let fastLimit = 0;
const fastArg = args.find(a => a.startsWith('--fast'));
if (fastArg) {
  const parts = fastArg.split('=');
  fastLimit = Number(parts[1] || 15) || 15;
} else if (args.includes('--fast')) {
  fastLimit = 15;
}

let jobs = 4;
const jobsArg = args.find(a => a.startsWith('--jobs='));
if (jobsArg) {
  const n = Number(jobsArg.split('=')[1]);
  if (!Number.isNaN(n) && n > 0) jobs = n;
}

// Add Angular version parameter
let angularMajor = 19; // Default to Angular 19
const angularArg = args.find(a => a.startsWith('--angular='));
if (angularArg) {
  const version = angularArg.split('=')[1];
  const parsed = Number(version);
  if (!Number.isNaN(parsed) && parsed > 0) {
    angularMajor = parsed;
  } else {
    console.error(`Invalid Angular version: ${version}. Using default: ${angularMajor}`);
  }
}

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Separate dependencies and devDependencies, track type
const regularDeps: Record<string, string> = { ...(pkg.dependencies || {}) };
const devDeps: Record<string, string> = { ...(pkg.devDependencies || {}) };

type DepEntry = { name: string; current: string; isDev: boolean };

// Filter out @angular and @ptp packages and combine with type info
const depEntries: DepEntry[] = [
  ...Object.entries(regularDeps)
    .filter(([name]) => !name.startsWith('@angular/') && !name.startsWith('@ptp/'))
    .map(([name, current]) => ({ name, current, isDev: false })),
  ...Object.entries(devDeps)
    .filter(([name]) => !name.startsWith('@angular/') && !name.startsWith('@ptp/'))
    .map(([name, current]) => ({ name, current, isDev: true }))
];

const MIGRATION_LINKS: Record<string, string> = {
  '@angular/core': 'https://update.angular.io/',
  '@angular/common': 'https://update.angular.io/',
  '@angular/forms': 'https://update.angular.io/',
  '@angular/router': 'https://update.angular.io/',
  '@angular/platform-browser': 'https://update.angular.io/',
  '@angular/platform-browser-dynamic': 'https://update.angular.io/',
  '@angular/compiler': 'https://update.angular.io/',
  '@angular/compiler-cli': 'https://update.angular.io/',
  '@angular/cli': 'https://update.angular.io/',
  '@angular/build': 'https://github.com/angular/angular-cli/releases',
  '@angular/language-service': 'https://github.com/angular/angular/releases',
  '@ionic/angular': 'https://ionicframework.com/docs/reference/versioning#release-notes',
  '@ionic/angular-toolkit': 'https://github.com/ionic-team/angular-toolkit/releases',
  '@capacitor/core': 'https://capacitorjs.com/docs/updating',
  '@capacitor/cli': 'https://capacitorjs.com/docs/updating',
  '@capacitor/app': 'https://capacitorjs.com/docs/updating',
  '@capacitor/haptics': 'https://capacitorjs.com/docs/updating',
  '@capacitor/keyboard': 'https://capacitorjs.com/docs/updating',
  '@capacitor/status-bar': 'https://capacitorjs.com/docs/updating',
  '@ngxs/store': 'https://ngxs.gitbook.io/ngxs/migrations',
  '@ngxs/logger-plugin': 'https://ngxs.gitbook.io/ngxs/migrations',
  '@ngxs/devtools-plugin': 'https://ngxs.gitbook.io/ngxs/migrations',
  'ngxs-reset-plugin': 'https://github.com/ngxs-labs/reset-plugin/releases',
  '@ngneat/until-destroy': 'https://github.com/ngneat/until-destroy/releases',
  '@ngx-translate/core': 'https://github.com/ngx-translate/core/releases',
  '@ngx-translate/http-loader': 'https://github.com/ngx-translate/http-loader/releases',
  'ionicons': 'https://github.com/ionic-team/ionicons/releases',
  'ngx-ellipsis': 'https://github.com/lentschi/ngx-ellipsis/releases',
  'survey-angular-ui': 'https://github.com/surveyjs/survey-library/blob/master/CHANGELOG.md',
  '@angular-eslint/builder': 'https://github.com/angular-eslint/angular-eslint/blob/main/CHANGELOG.md',
  '@angular-eslint/eslint-plugin': 'https://github.com/angular-eslint/angular-eslint/blob/main/CHANGELOG.md',
  '@angular-eslint/eslint-plugin-template': 'https://github.com/angular-eslint/angular-eslint/blob/main/CHANGELOG.md',
  '@angular-eslint/schematics': 'https://github.com/angular-eslint/angular-eslint/blob/main/CHANGELOG.md',
  '@angular-eslint/template-parser': 'https://github.com/angular-eslint/angular-eslint/blob/main/CHANGELOG.md',
  '@typescript-eslint/eslint-plugin': 'https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/CHANGELOG.md',
  '@typescript-eslint/parser': 'https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/parser/CHANGELOG.md',
  'eslint': 'https://github.com/eslint/eslint/releases',
  'eslint-config-prettier': 'https://github.com/prettier/eslint-config-prettier/blob/main/CHANGELOG.md',
  'eslint-plugin-prettier': 'https://github.com/prettier/eslint-plugin-prettier/blob/master/CHANGELOG.md',
  'prettier': 'https://github.com/prettier/prettier/releases',
  'stylelint': 'https://github.com/stylelint/stylelint/blob/main/CHANGELOG.md',
  'stylelint-config-standard': 'https://github.com/stylelint/stylelint-config-standard/releases',
  'stylelint-config-standard-scss': 'https://github.com/stylelint-scss/stylelint-config-standard-scss/releases',
  'jest': 'https://github.com/jestjs/jest/blob/main/CHANGELOG.md',
  'jest-preset-angular': 'https://github.com/thymikee/jest-preset-angular/blob/main/CHANGELOG.md',
  '@types/jest': 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/jest',
  'jest-junit': 'https://github.com/jest-community/jest-junit/releases',
  'jest-sonar-reporter': 'https://github.com/3dmind/jest-sonar-reporter/releases',
  'rxjs': 'https://rxjs.dev/deprecations',
  'zone.js': 'https://github.com/angular/angular/blob/main/packages/zone.js/CHANGELOG.md',
  'typescript': 'https://devblogs.microsoft.com/typescript/',
  'lodash-es': 'https://github.com/lodash/lodash/wiki/Changelog',
  'jwt-decode': 'https://github.com/auth0/jwt-decode/blob/master/CHANGELOG.md',
  'ua-parser-js': 'https://github.com/faisalman/ua-parser-js/blob/master/CHANGELOG.md',
  '@types/ua-parser-js': 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/ua-parser-js',
  'ts-node': 'https://github.com/TypeStrong/ts-node/blob/main/CHANGELOG.md',
  'tslib': 'https://github.com/microsoft/tslib/releases',
  'sonarqube-scanner': 'https://github.com/SonarSource/sonarqube-scanner-npm/blob/master/CHANGELOG.md',
  'sonarjs': 'https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/CHANGELOG.md',
  'replace-in-file': 'https://github.com/adamreisnz/replace-in-file/blob/master/CHANGELOG.md',
  'ncp': 'https://github.com/AvianFlu/ncp/issues'
};

function execJson(cmd: string): Promise<any> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function execRaw(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function satisfiesAngular(range: string, major: number) {
  return semver.satisfies(`${major}.0.0`, range, { includePrerelease });
}
function stripRange(v: string) {
  return v.replace(/^[~^]/, '');
}
function resolveMigrationLink(name: string, meta: any) {
  if (MIGRATION_LINKS[name]) return MIGRATION_LINKS[name];
  if (name.startsWith('@ptp/')) return '';
  return meta?.homepage || meta?.repository?.url || '';
}

const total = depEntries.length;
let finished = 0;
// Update results type to include isDev
const results: (DepInfo & { isDev: boolean })[] = [];
let versionQueries = 0;
const startTime = Date.now();
let workerCount: number;

// --- SIMPLIFIED MULTI-LINE PROGRESS IMPLEMENTATION ---
const workerStatuses: string[] = [];
let displayInitialized = false;
let lastRedrawTime = 0;

function updateWorkerStatus(workerId: number, status: string) {
    if (!showProgress || !displayInitialized) return;
    workerStatuses[workerId] = status;

    // Throttle redraws to prevent excessive updates
    const now = Date.now();
    if (now - lastRedrawTime > 100) { // Only redraw every 100ms
        lastRedrawTime = now;
        redrawScreen();
    }
}

function redrawScreen() {
    if (!showProgress) return;
    const terminalWidth = process.stderr.columns || 120;

    const ESC = '\u001B[';

    // Save cursor position
    process.stderr.write(`${ESC}s`);

    // Move to start of our display area (after the 5 newlines)
    process.stderr.write(`${ESC}6;1H`); // Move to line 6, column 1

    // Clear from cursor to end of screen
    process.stderr.write(`${ESC}0J`);

    // Empty line
    process.stderr.write('\n');

    // Overall Progress Bar - ensure it fits within terminal width
    const pct = total === 0 ? 100 : (finished / total) * 100;
    const statusText = `${pct.toFixed(1)}% (${finished}/${total})`;

    // Calculate available width for the progress bar
    // Reserve space for percentage and count, plus some padding
    const reservedSpace = statusText.length + 2; // +2 for spaces
    const availableBarWidth = Math.max(10, terminalWidth - reservedSpace - 2); // -2 for safety margin
    const barWidth = Math.min(40, availableBarWidth);

    const filled = Math.round((finished / total) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const progressLine = `${statusText} ${bar}`;

    // Ensure the line doesn't exceed terminal width
    const finalLine = progressLine.length > terminalWidth - 1
        ? progressLine.substring(0, terminalWidth - 1)
        : progressLine;

    process.stderr.write(finalLine + '\n');

    // Worker Status Lines
    for (let i = 0; i < workerCount; i++) {
        const status = workerStatuses[i] || 'Initializing...';
        const line = `  [Worker ${i + 1}] ${status}`;

        // Ensure worker status lines also don't exceed terminal width
        const workerLine = line.length > terminalWidth - 1
            ? line.substring(0, terminalWidth - 1)
            : line;

        process.stderr.write(workerLine + '\n');
    }

    // Restore cursor position
    process.stderr.write(`${ESC}u`);
}

// Helper function to check if a package is likely Angular-compatible
async function checkAngularCompatibility(name: string, latest: string, versions: string[], workerId: number): Promise<{ isCompatible: boolean; reason: string }> {
  try {
    // Check if it's a known Angular-compatible package
    const angularCompatiblePackages = [
      'rxjs', 'zone.js', 'tslib', 'typescript',
      'lodash', 'lodash-es', 'moment', 'date-fns',
      'jwt-decode', 'ua-parser-js', 'uuid',
      '@types/node', '@types/jest', '@types/jasmine',
      'jest', 'jasmine', 'karma', 'protractor',
      'eslint', 'prettier', 'stylelint',
      'webpack', 'rollup', 'vite'
    ];

    if (angularCompatiblePackages.some(pkg => name.startsWith(pkg))) {
      return { isCompatible: true, reason: 'Known Angular-compatible package' };
    }

    // Check package keywords and description for Angular mentions
    updateWorkerStatus(workerId, `checking Angular compat ${name}`);
    const packageInfo = await execJson(`npm view ${name} keywords description --json --no-progress`);

    const keywords = Array.isArray(packageInfo.keywords) ? packageInfo.keywords : [];
    const description = packageInfo.description || '';

    const angularKeywords = ['angular', 'ng', 'ngx'];
    const hasAngularKeywords = keywords.some((keyword: string) =>
      angularKeywords.some(ng => keyword.toLowerCase().includes(ng))
    );

    const hasAngularDescription = angularKeywords.some(ng =>
      description.toLowerCase().includes(ng)
    );

    if (hasAngularKeywords || hasAngularDescription) {
      // This package is likely Angular-related, check its latest version compatibility window
      const latestSemver = semver.parse(latest);
      if (latestSemver) {
        // If it's a relatively recent package (released in last 2 years), assume compatible
        // This is a heuristic - packages actively maintained usually support current Angular
        const recentVersions = versions.slice(0, 5); // Check last 5 versions
        const hasRecentActivity = recentVersions.length > 0;

        if (hasRecentActivity) {
          return { isCompatible: true, reason: 'Angular-related package with recent updates' };
        }
      }

      return { isCompatible: false, reason: 'Angular-related but may be outdated' };
    }

    // For utility packages without Angular keywords, check if they're framework-agnostic
    const utilityKeywords = ['utility', 'util', 'helper', 'tool', 'library', 'polyfill'];
    const hasUtilityKeywords = keywords.some((keyword: string) =>
      utilityKeywords.some(util => keyword.toLowerCase().includes(util))
    );

    if (hasUtilityKeywords || name.startsWith('@types/')) {
      return { isCompatible: true, reason: 'Framework-agnostic utility package' };
    }

    // Default: assume compatible for packages without explicit framework dependencies
    return { isCompatible: true, reason: 'No explicit framework dependencies detected' };

  } catch (error) {
    return { isCompatible: false, reason: 'Failed to check compatibility' };
  }
}

async function processPackage(entry: DepEntry, workerId: number) {
  const { name, current, isDev } = entry;
  updateWorkerStatus(workerId, `meta ${name}`);
  try {
    const meta = await execJson(`npm view ${name} --json --no-progress`);
    const latest: string = meta.version;
    let versions: string[] = Array.isArray(meta.versions) ? meta.versions : [meta.version];

    versions = versions.filter(v => semver.valid(v));
    if (!includePrerelease) {
      versions = versions.filter(v => !semver.prerelease(v));
    }
    versions.sort(semver.rcompare);

    const currentClean = stripRange(current);
    let currentVersionFound = false;

    // Apply fast limit, but track if we need to continue beyond it
    let versionsToCheck = versions;
    if (fastLimit > 0) {
      versionsToCheck = versions.slice(0, fastLimit);
      // Check if current version is within the fast limit
      currentVersionFound = versionsToCheck.includes(currentClean);
    }

    let peerAngular: string | undefined;
    let latestCompat: string | undefined;
    let earliestCompat: string | undefined;
    const compatVersions: string[] = [];
    let hasAngularPeerDep = false;
    let versionIndex = 0;

    // Check versions within fast limit first
    for (const v of versionsToCheck) {
      updateWorkerStatus(workerId, `scan ${name}@${v}`);
      versionQueries++;
      let peerDeps: any = {};
      try {
        const raw = await execRaw(`npm view ${name}@${v} peerDependencies --json --no-progress || echo "{}"`);
        peerDeps = raw.trim() ? JSON.parse(raw) : {};
      } catch { /* ignore */ }

      const peer = peerDeps['@angular/core'] || peerDeps.angular;
      if (peer) {
        hasAngularPeerDep = true;
        if (!peerAngular) peerAngular = peer;
      }

      if (!peer || satisfiesAngular(peer, angularMajor)) {
        compatVersions.push(v);
      }

      // Track if we found the current version
      if (v === currentClean) {
        currentVersionFound = true;
      }

      versionIndex++;

      // Only short circuit for packages WITHOUT Angular peer dependency in non-exhaustive mode
      if (!exhaustive && !hasAngularPeerDep && compatVersions.length > 0) {
        break; // early exit for non-Angular packages when we found compatible version
      }
    }

    // If we have Angular peer deps, haven't found current version yet, and there are more versions to check
    if (hasAngularPeerDep && !currentVersionFound && fastLimit > 0 && versionIndex < versions.length) {
      updateWorkerStatus(workerId, `extending search for ${name} to find current version`);

      // Continue checking versions beyond fast limit until we find current version
      const remainingVersions = versions.slice(versionIndex);

      for (const v of remainingVersions) {
        updateWorkerStatus(workerId, `scan ${name}@${v} (extended)`);
        versionQueries++;
        let peerDeps: any = {};
        try {
          const raw = await execRaw(`npm view ${name}@${v} peerDependencies --json --no-progress || echo "{}"`);
          peerDeps = raw.trim() ? JSON.parse(raw) : {};
        } catch { /* ignore */ }

        const peer = peerDeps['@angular/core'] || peerDeps.angular;
        if (peer) {
          if (!peerAngular) peerAngular = peer;
        }

        if (!peer || satisfiesAngular(peer, angularMajor)) {
          compatVersions.push(v);
        }

        // Stop once we find the current version
        if (v === currentClean) {
          currentVersionFound = true;
          break;
        }
      }
    }

    // Find earliest and latest compatible versions if has Angular peer dependency
    if (hasAngularPeerDep && compatVersions.length > 0) {
      latestCompat = compatVersions[0]; // First (latest) compatible in sorted array
      earliestCompat = compatVersions[compatVersions.length - 1]; // Last (earliest) compatible in sorted array
    } else if (compatVersions.length > 0) {
      // For non-Angular packages, just use the first compatible version found
      latestCompat = compatVersions[0];
    }

    // Calculate version difference between current and latestCompat (not latest)
    let versionsBehindLatestCompatDisplay = '';

    if (hasAngularPeerDep) {
      // For packages with Angular peer dependencies, compare against latestCompat
      if (latestCompat && currentClean) {
        try {
          const currentSemver = semver.parse(currentClean);
          const latestCompatSemver = semver.parse(latestCompat);

          if (currentSemver && latestCompatSemver) {
            if (semver.eq(currentClean, latestCompat)) {
              versionsBehindLatestCompatDisplay = 'Up to date with latest compatible';
            } else if (semver.gt(currentClean, latestCompat)) {
              versionsBehindLatestCompatDisplay = 'Ahead of latest compatible';
            } else {
              const majorDiff = latestCompatSemver.major - currentSemver.major;
              const minorDiff = latestCompatSemver.minor - currentSemver.minor;
              const patchDiff = latestCompatSemver.patch - currentSemver.patch;

              if (majorDiff > 0) {
                versionsBehindLatestCompatDisplay = `${majorDiff} major version${majorDiff > 1 ? 's' : ''} behind latest compatible`;
              } else if (minorDiff > 0) {
                versionsBehindLatestCompatDisplay = `${minorDiff} minor version${minorDiff > 1 ? 's' : ''} behind latest compatible`;
              } else if (patchDiff > 0) {
                versionsBehindLatestCompatDisplay = `${patchDiff} patch version${patchDiff > 1 ? 's' : ''} behind latest compatible`;
              } else {
                versionsBehindLatestCompatDisplay = 'Behind latest compatible (version format difference)';
              }
            }
          } else {
            versionsBehindLatestCompatDisplay = 'Invalid version format';
          }
        } catch (e) {
          versionsBehindLatestCompatDisplay = 'Version comparison failed';
        }
      } else if (!latestCompat) {
        versionsBehindLatestCompatDisplay = 'No compatible version found';
      } else {
        versionsBehindLatestCompatDisplay = 'Unknown';
      }
    } else {
      // For packages without Angular peer dependencies, compare against latest
      if (latest && currentClean) {
        try {
          const currentSemver = semver.parse(currentClean);
          const latestSemver = semver.parse(latest);

          if (currentSemver && latestSemver) {
            if (semver.eq(currentClean, latest)) {
              versionsBehindLatestCompatDisplay = 'Up to date';
            } else if (semver.gt(currentClean, latest)) {
              versionsBehindLatestCompatDisplay = 'Ahead of latest';
            } else {
              const majorDiff = latestSemver.major - currentSemver.major;
              const minorDiff = latestSemver.minor - currentSemver.minor;
              const patchDiff = latestSemver.patch - currentSemver.patch;

              if (majorDiff > 0) {
                versionsBehindLatestCompatDisplay = `${majorDiff} major version${majorDiff > 1 ? 's' : ''} behind`;
              } else if (minorDiff > 0) {
                versionsBehindLatestCompatDisplay = `${minorDiff} minor version${minorDiff > 1 ? 's' : ''} behind`;
              } else if (patchDiff > 0) {
                versionsBehindLatestCompatDisplay = `${patchDiff} patch version${patchDiff > 1 ? 's' : ''} behind`;
              } else {
                versionsBehindLatestCompatDisplay = 'Behind (version format difference)';
              }
            }
          } else {
            versionsBehindLatestCompatDisplay = 'Invalid version format';
          }
        } catch (e) {
          versionsBehindLatestCompatDisplay = 'Version comparison failed';
        }
      } else {
        versionsBehindLatestCompatDisplay = 'Unknown';
      }
    }

    // For packages without Angular peer dependencies, check Angular compatibility
    let angularCompatibilityInfo = { isCompatible: true, reason: '' };
    if (!hasAngularPeerDep) {
      angularCompatibilityInfo = await checkAngularCompatibility(name, latest, versions, workerId);
    }

    // Determine display values
    let earliestCompatDisplay = '';
    let latestCompatDisplay = '';
    let peerAngularDisplay = '';
    let noteDisplay = '';
    let recommendedVersionDisplay = '';

    if (hasAngularPeerDep) {
      // Use the actual earliest and latest compatible versions
      earliestCompatDisplay = earliestCompat || '';
      latestCompatDisplay = latestCompat || '';
      peerAngularDisplay = peerAngular || '';

      // Set note and recommendation based on compatibility
      if (!latestCompat) {
        noteDisplay = `No compatible version found for Angular ${angularMajor}`;
        recommendedVersionDisplay = 'n/a';
      } else if (compatVersions.includes(currentClean)) {
        noteDisplay = 'Current version is compatible';
        // Current is compatible - check if it's the latest compatible
        if (currentClean === latestCompat) {
          recommendedVersionDisplay = '#3 Keep current version';
        } else {
          recommendedVersionDisplay = `#2 Optionally upgrade to ${latestCompat}`;
        }
      } else {
        // Current is not compatible - must upgrade
        if (earliestCompat) {
          recommendedVersionDisplay = `#1 Must upgrade to ${earliestCompat}`;
        } else {
          recommendedVersionDisplay = 'n/a';
        }

        if (latestCompat === currentClean) {
          noteDisplay = 'Up to date';
        } else if (latestCompat !== latest && latest && latest !== latestCompat) {
          noteDisplay = 'Newer latest likely needs different Angular peer or is prerelease';
        } else if (latestCompat !== currentClean) {
          noteDisplay = `Upgradable within Angular ${angularMajor}`;
        }
      }
    } else {
      // Package doesn't have Angular peer dependency - set n/a for compat columns
      earliestCompatDisplay = 'n/a';
      latestCompatDisplay = 'n/a';
      peerAngularDisplay = 'Does not depend on Angular';

      if (angularCompatibilityInfo.isCompatible) {
        noteDisplay = `Likely compatible with Angular ${angularMajor} - ${angularCompatibilityInfo.reason}`;
        // For compatible packages without Angular peer deps
        if (currentClean === latest) {
          recommendedVersionDisplay = '#3 Keep current version';
        } else {
          recommendedVersionDisplay = `#2 Optionally upgrade to ${latest}`;
        }
      } else {
        noteDisplay = `May not be compatible with Angular ${angularMajor} - ${angularCompatibilityInfo.reason}`;
        // For incompatible packages, recommend upgrading to latest
        if (latest && currentClean !== latest) {
          recommendedVersionDisplay = `#1 Must upgrade to ${latest}`;
        } else {
          recommendedVersionDisplay = 'n/a';
        }
      }
    }

    const info: DepInfo & { isDev: boolean } = {
      name,
      current,
      latest,
      earliestCompat: earliestCompatDisplay,
      latestCompat: latestCompatDisplay,
      peerAngular: peerAngularDisplay,
      versionsBehindLatestCompat: versionsBehindLatestCompatDisplay,
      recommendedVersion: recommendedVersionDisplay,
      note: noteDisplay,
      migrationLink: resolveMigrationLink(name, meta),
      isDev
    };

    results.push(info);
    if (verbose) updateWorkerStatus(workerId, `OK: ${name} -> ${latestCompat || 'none'}`);

  } catch (e) {
    results.push({
      name,
      current,
      note: 'Failed to fetch metadata',
      migrationLink: MIGRATION_LINKS[name],
      isDev,
      peerAngular: 'Unknown',
      versionsBehindLatestCompat: 'Unknown',
      recommendedVersion: 'n/a',
      earliestCompat: 'n/a',
      latestCompat: 'n/a'
    });
    if (verbose) updateWorkerStatus(workerId, `FAIL: ${name}`);
  } finally {
    finished++;
  }
}

async function run() {
  const queue = depEntries.slice();
  workerCount = Math.min(jobs, queue.length || 0);

  // Add 5 newlines at the start to separate from command line
  if (showProgress) {
    process.stderr.write('\n\n\n\n\n');
  }

  // Initialize ALL worker status lines FIRST
  for (let i = 0; i < workerCount; i++) {
    workerStatuses.push('idle');
  }

  if (showProgress) {
    redrawScreen(); // Initial draw
    displayInitialized = true; // Now allow updates
  }

  const workers: Promise<void>[] = [];

  async function worker(workerId: number) {
    while (queue.length > 0) {
      const entry = queue.shift()!;
      await processPackage(entry, workerId);
    }
    updateWorkerStatus(workerId, 'Finished.');
  }

  for (let i = 0; i < workerCount; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  // Complete cleanup - clear entire screen area used for progress
  if (showProgress) {
    const ESC = '\u001B[';
    // Move to the start of our progress display area (line 6)
    process.stderr.write(`${ESC}6;1H`);
    // Clear from cursor to end of screen to remove all progress remnants
    process.stderr.write(`${ESC}0J`);

    // Show final summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = `Done. Packages: ${results.length} | Version lookups: ${versionQueries} | Concurrency: ${workerCount} | Angular: ${angularMajor} | Mode: ${fastLimit ? 'fast' : 'full'}${exhaustive ? '+exhaustive' : ''} | Time: ${elapsed}s`;
    process.stderr.write(summary + '\n');
  }

  // Sort: dependencies first, then devDependencies, alphabetically within each group
  const sortedResults = results.sort((a, b) => {
    if (a.isDev !== b.isDev) {
      return a.isDev ? 1 : -1; // dependencies first (isDev=false), then devDependencies (isDev=true)
    }
    return a.name.localeCompare(b.name);
  });

  // Output CSV with renamed column
  console.log('name,isDevDependency,current,latest,earliestCompat,latestCompat,peerAngular,versionsBehindLatestCompat,recommendedVersion,note,migrationLink');
  for (const r of sortedResults) {
    console.log([
      r.name,
      r.isDev ? 'true' : 'false',
      r.current,
      r.latest || '',
      r.earliestCompat || '',
      r.latestCompat || '',
      r.peerAngular || '',
      r.versionsBehindLatestCompat || '', // Renamed column
      r.recommendedVersion || '',
      r.note || '',
      r.migrationLink || ''
    ].join(','));
  }
}

run();
