#!/usr/bin/env node

const { installGlobalHooks, uninstallGlobalHooks, getHookStatus } = require('../lib/claude-hooks');
const { runSetup } = require('../lib/setup');
const { getInstagramCredentialsStatus } = require('../lib/config');
const { runLogin } = require('../lib/login');
const { startReelio } = require('../lib/start');
const { stopReelio } = require('../lib/stop');
const { runDoctor } = require('../lib/doctor');
const { runScrape } = require('../lib/scrape');

const command = process.argv[2];
const subcommand = process.argv[3];
const extraArgs = process.argv.slice(4);

function hasFlag(name) {
  return process.argv.includes(name);
}

function getFlagValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

function parseScrapeOptions() {
  const countRaw = getFlagValue('--count');
  const count = countRaw != null ? parseInt(countRaw, 10) : 50;

  if (!Number.isFinite(count) || count < 1) {
    console.error('Invalid --count. Use a positive integer.');
    process.exit(1);
  }

  return {
    count,
    out: getFlagValue('--out'),
    fresh: hasFlag('--fresh'),
    headless: hasFlag('--headless') ? true : undefined,
  };
}

function printHelp() {
  console.log(`Reelio — Instagram Reels companion for Claude Code

Usage:
  reelio setup [--hooks]       Create ~/.reelio/.env (optional: install hooks)
  reelio login                 One-time Instagram login (visible browser)
  reelio start [--foreground]  Start server + Electron player
  reelio stop                  Stop server and player
  reelio doctor                Check install health
  reelio scrape [options]      Scrape explore Reels feed to JSON (CLI only)
  reelio hooks install         Install global Claude Code hooks
  reelio hooks uninstall       Remove Reelio hooks from global Claude settings
  reelio hooks status          Show whether global hooks are installed

Global hooks let Reelio work in any directory where Claude Code is opened.
Run \`reelio start\` before coding with Claude.

Scrape options:
  --count <n>    Target number of reels (default: 50)
  --out <path>   Output file or directory (default: ./scrapes/reels-<timestamp>.json)
  --fresh        Navigate to /reels/ before scrolling
  --headless     Force headless browser (otherwise uses HEADLESS from ~/.reelio/.env)
`);
}

function hooksCommand(action) {
  if (action === 'install') {
    const result = installGlobalHooks();
    console.log('Reelio global Claude hooks installed.');
    console.log(`  Settings: ${result.settingsPath}`);
    console.log(`  Scripts:  ${result.hooksDir}`);
    console.log(`  Events:   ${result.events.join(', ')}`);
    console.log('\nOpen Claude Code in any project — hooks call REELIO_API (default http://localhost:3001)');
    console.log('Start Reelio first: reelio start');
    return;
  }

  if (action === 'uninstall') {
    const result = uninstallGlobalHooks();
    console.log('Reelio global Claude hooks removed.');
    console.log(`  Settings: ${result.settingsPath}`);
    return;
  }

  if (action === 'status') {
    const status = getHookStatus();
    console.log(`Global hooks: ${status.installed ? 'installed' : 'not fully installed'}`);
    console.log(`  Settings: ${status.settingsPath}`);
    console.log(`  Scripts:  ${status.hooksDir}`);
    if (status.installedEvents.length > 0) {
      console.log(`  Active:   ${status.installedEvents.join(', ')}`);
    }
    if (status.missingEvents.length > 0) {
      console.log(`  Missing:  ${status.missingEvents.join(', ')}`);
    }
    return;
  }

  console.error('Usage: reelio hooks <install|uninstall|status>');
  process.exit(1);
}

async function setupCommand() {
  const result = runSetup({ hooks: hasFlag('--hooks') });

  console.log('Reelio setup complete.');
  console.log(`  Home:    ${result.home}`);
  console.log(`  Config:  ${result.envPath}${result.envCreated ? ' (created)' : ' (exists)'}`);
  console.log(`  Session: ${result.sessionDir}`);

  if (result.hooksResult) {
    console.log(`  Hooks:   ${result.hooksResult.settingsPath}`);
  }

  console.log('\nNext steps:');
  console.log(`  1. Edit ${result.envPath} — set IG_USERNAME and IG_PASSWORD (replace placeholders)`);
  console.log('  2. reelio hooks install');
  console.log('  3. reelio login');
  console.log('  4. reelio start');

  const creds = getInstagramCredentialsStatus();
  if (!creds.configured) {
    console.log(`\n⚠ ${creds.message.replace(/\n/g, '\n  ')}`);
  }
}

async function main() {
  if (command === 'hooks') {
    hooksCommand(subcommand);
    return;
  }

  if (command === 'setup') {
    await setupCommand();
    return;
  }

  if (command === 'login') {
    await runLogin();
    console.log('Login complete.');
    return;
  }

  if (command === 'start') {
    const foreground = hasFlag('--foreground') || hasFlag('-f');
    await startReelio({ foreground });
    return;
  }

  if (command === 'stop') {
    await stopReelio();
    return;
  }

  if (command === 'doctor') {
    const code = await runDoctor();
    process.exit(code);
  }

  if (command === 'scrape') {
    await runScrape(parseScrapeOptions());
    return;
  }

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
