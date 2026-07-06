const fs = require('fs');
const path = require('path');
const {
  ensureReelioHome,
  getBundledHooksDir,
  getInstalledHooksDir,
  getClaudeGlobalSettingsPath,
} = require('./paths');

const REELIO_HOOK_MARKER = 'reelio-global-hooks';
const HOOK_EVENTS = [
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'SubagentStart',
  'Stop',
  'SessionEnd',
];

const HOOK_SCRIPTS = {
  UserPromptSubmit: 'play.sh',
  PreToolUse: 'keep-playing.sh',
  PostToolUse: 'keep-playing.sh',
  SubagentStart: 'keep-playing.sh',
  Stop: 'pause.sh',
  SessionEnd: 'pause.sh',
};

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return { ...fallback };
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { ...fallback };
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function copyHookScripts() {
  ensureReelioHome();
  const srcDir = getBundledHooksDir();
  const destDir = getInstalledHooksDir();
  fs.mkdirSync(destDir, { recursive: true });

  for (const script of new Set(Object.values(HOOK_SCRIPTS))) {
    const src = path.join(srcDir, script);
    const dest = path.join(destDir, script);
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);
  }

  return destDir;
}

function buildHookEntries(hooksDir) {
  const entries = {};

  for (const event of HOOK_EVENTS) {
    const script = HOOK_SCRIPTS[event];
    const scriptPath = path.join(hooksDir, script);
    entries[event] = [
      {
        hooks: [
          {
            type: 'command',
            command: `bash "${scriptPath.replace(/"/g, '\\"')}"`,
            _reelio: REELIO_HOOK_MARKER,
          },
        ],
      },
    ];
  }

  return entries;
}

function stripReelioHooks(existingHooks = {}) {
  const next = {};

  for (const [event, groups] of Object.entries(existingHooks)) {
    if (!Array.isArray(groups)) {
      next[event] = groups;
      continue;
    }

    const filtered = groups
      .map((group) => {
        if (!group?.hooks || !Array.isArray(group.hooks)) {
          return group;
        }
        const hooks = group.hooks.filter((hook) => hook?._reelio !== REELIO_HOOK_MARKER);
        if (hooks.length === 0) {
          return null;
        }
        return { ...group, hooks };
      })
      .filter(Boolean);

    if (filtered.length > 0) {
      next[event] = filtered;
    }
  }

  return next;
}

function mergeHookEntries(existingHooks, reelioHooks) {
  const cleaned = stripReelioHooks(existingHooks);
  const merged = { ...cleaned };

  for (const [event, groups] of Object.entries(reelioHooks)) {
    merged[event] = groups;
  }

  return merged;
}

function installGlobalHooks() {
  const hooksDir = copyHookScripts();
  const settingsPath = getClaudeGlobalSettingsPath();
  const settings = readJson(settingsPath, {});
  const reelioHooks = buildHookEntries(hooksDir);

  settings.hooks = mergeHookEntries(settings.hooks || {}, reelioHooks);
  writeJson(settingsPath, settings);

  return {
    settingsPath,
    hooksDir,
    events: HOOK_EVENTS,
  };
}

function uninstallGlobalHooks() {
  const settingsPath = getClaudeGlobalSettingsPath();
  const settings = readJson(settingsPath, {});

  if (settings.hooks) {
    settings.hooks = stripReelioHooks(settings.hooks);
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }

  writeJson(settingsPath, settings);

  return { settingsPath };
}

function getHookStatus() {
  const settingsPath = getClaudeGlobalSettingsPath();
  const settings = readJson(settingsPath, {});
  const hooks = settings.hooks || {};
  const installedEvents = HOOK_EVENTS.filter((event) =>
    (hooks[event] || []).some((group) =>
      (group.hooks || []).some((hook) => hook?._reelio === REELIO_HOOK_MARKER)
    )
  );

  return {
    settingsPath,
    hooksDir: getInstalledHooksDir(),
    installed: installedEvents.length === HOOK_EVENTS.length,
    installedEvents,
    missingEvents: HOOK_EVENTS.filter((e) => !installedEvents.includes(e)),
  };
}

module.exports = {
  REELIO_HOOK_MARKER,
  installGlobalHooks,
  uninstallGlobalHooks,
  getHookStatus,
  copyHookScripts,
};
