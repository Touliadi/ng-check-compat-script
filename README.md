# Angular Dependency Compatibility Checker 🔍

## What's This Thing Do?

Ever wondered if your npm packages will play nice with Angular 19? Or maybe you're stuck on Angular 16 and want to see what's blocking your upgrade? This little script is here to help! 

It crawls through your `package.json`, checks every dependency against your target Angular version, and gives you a nice CSV report with all the juicy details. Think of it as your personal dependency detective 🕵️‍♀️

## Why You'll Love It

### The Good Stuff
- **No More Guesswork**: Stop wondering if that package update will break everything
- **Save Your Sanity**: No more manually checking 50+ dependencies one by one
- **Smart Analysis**: Understands Angular and Ionic ecosystems
- **Pretty Progress Bars**: Because watching progress bars is oddly satisfying

### Cool Features
- **Multi-Framework Support**: Knows about Angular, Ionic, and Capacitor peer dependencies
- **Fast Mode**: For when you're in a hurry (we've all been there)
- **Exhaustive Mode**: For when you want ALL the details
- **Parallel Processing**: Uses multiple workers because why be slow?
- **CSV Export**: Perfect for sharing with your team or boss

## What It Actually Does

Here's the magic behind the curtain:

1. **Package Discovery**: Finds all your non-Angular dependencies (skips @angular/* and @ptp/* packages)
2. **Version Analysis**: Checks which versions work with your target Angular version
3. **Compatibility Check**: Uses semver to figure out what's compatible and what's not
4. **Smart Recommendations**: Tells you exactly what to do (upgrade, keep, or panic)
5. **Migration Links**: Even gives you links to upgrade guides when available

### Framework Support
- **Angular**: The main event - checks peer dependencies thoroughly
- **Ionic**: Mobile development made easy
- **Capacitor**: Native platform integration
- **Everything Else**: Smart detection for framework-agnostic packages

## How to Use It

### The Basics
Just run it and watch the magic happen.  Make sure that you specify the target Angular version in the command line or update the default in the script or in the package.json run commands.
```bash
npm run compat-check
```

### Getting Fancy
Want more control? Here are some fun options:

```bash
# Check compatibility with Angular 18 (default is 19)
npm run compat-check -- --angular=18

# Speed demon mode (only checks last 10 versions)
npm run compat-check -- --fast=10

# I want it ALL mode (checks every version ever made)
npm run compat-check -- --exhaustive

# Quiet mode (no fancy progress bars)
npm run compat-check -- --no-progress

# Chatty mode (tells you everything it's thinking)
npm run compat-check -- --verbose

# More workers = faster results (if your CPU can handle it)
npm run compat-check -- --jobs=8

# Include beta/alpha versions (living dangerously)
npm run compat-check -- --include-prerelease
```

### Command Options Explained

| Option | What It Does | Default |
|--------|-------------|---------|
| `--angular=X` | Which Angular version to target | 19 |
| `--exhaustive` | Check every single version (slow but thorough) | false |
| `--fast=N` | Only check the N newest versions | disabled |
| `--jobs=N` | How many workers to run in parallel | 4 |
| `--include-prerelease` | Include alpha/beta/rc versions | false |
| `--no-progress` | Hide the progress bars | false |
| `--verbose` | Show detailed status messages | false |

## Reading the Results

The script spits out a CSV file with all the good stuff:

### The Columns Explained
- **name**: The package name (duh)
- **isDevDependency**: Is it a dev dependency? (true/false)
- **current**: What version you have now
- **latest**: The newest version available
- **earliestCompat**: The oldest version that works with your Angular target
- **latestCompat**: The newest version that works with your Angular target
- **peerAngular**: What Angular versions this package expects
- **versionsBehindLatestCompat**: How far behind you are
- **recommendedVersion**: What you should do (with priority numbers!)
- **note**: Helpful explanations
- **migrationLink**: Links to upgrade guides

### The Recommendation System 🚦
The script uses a simple priority system:

- **#1 Must upgrade**: Your current version won't work - upgrade ASAP!
- **#2 Optionally upgrade**: You're good, but there's a newer compatible version
- **#3 Keep current**: You're already on the best version, nice job!
- **n/a**: Something weird happened, check manually

### Status Messages You'll See
- **"Up to date with latest compatible"**: You're golden! ✨
- **"Current version is compatible"**: It works, but maybe not the latest
- **"No compatible version found"**: Uh oh, this package doesn't like your Angular version
- **"Likely compatible with Angular X"**: For packages without explicit Angular dependencies

## Pro Tips & Tricks

### Performance Tuning
- Use `--fast=15` for daily checks (much faster, still reliable)
- Use `--exhaustive` when planning major upgrades
- Bump up `--jobs=8` if you have a beefy CPU
- Use `--no-progress` in CI/CD pipelines

### Reading Between the Lines
- Packages with "n/a" in compat columns don't depend on Angular directly
- "Does not depend on Angular" usually means it's safe to update
- Check the migration links - they're super helpful!
- Priority #1 items are your biggest blockers

### CI/CD Integration
Perfect for automated checks:
```yaml
- name: Check Dependencies
  run: |
    npm install
    npm run compat-check -- --fast=15 --no-progress > dependency-report.csv
```

## Common Scenarios

### "I want to upgrade to Angular 19"
```bash
npm run compat-check -- --angular=19
```
Look for any #1 priority items - those are your blockers.

### "Quick health check of my dependencies"
```bash
npm run compat-check -- --fast=10
```
Fast and gives you the important stuff.

### "I need a complete audit for the boss"
```bash
npm run compat-check -- --exhaustive --verbose
```
This will take a while but gives you everything.

### "My CI is timing out"
```bash
npm run compat-check -- --fast=5 --no-progress --jobs=2
```
Minimal but still useful for automation.

## Troubleshooting

### "It's taking forever!"
- Try `--fast=10` to speed things up
- Reduce `--jobs=2` if your network is slow
- Some packages have hundreds of versions (looking at you, lodash)

### "I'm getting weird results"
- Try `--verbose` to see what's happening
- Check your network connection
- Make sure your package.json is valid

### "The progress bars are messed up"
- Try `--no-progress` if your terminal is weird
- Some terminals don't handle ANSI escape sequences well

### "It says no compatible version but I know there is one"
- Try `--exhaustive` to check all versions
- The package might have updated its peer dependencies recently
- Check the migration link for manual guidance

## Fun Facts

- The script knows about 50+ common Angular ecosystem packages and their migration guides
- It can analyze hundreds of dependencies in parallel (your CPU permitting)
- The progress bars update every 100ms to not overwhelm your terminal
- It's smart enough to extend searches for Angular packages to find your current version
- The CSV output is Excel-friendly (your PM will love this)

---

*Built with ❤️ for Angular developers who are tired of dependency hell. May your upgrades be smooth and your breaking changes be few!* 🚀
