const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function isLoginPageVisible(page) {
  const loginSelectors = [
    'input[name="username"]',
    'input[name="email"]',
    'input[aria-label="Phone number, username, or email"]',
    'input[placeholder*="username"]',
    'input[placeholder*="email"]',
  ];

  for (const selector of loginSelectors) {
    if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }

  const passwordVisible = await page
    .locator('input[name="password"], input[name="pass"], input[type="password"]')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  const loginHeading = await page
    .getByText('Log in to Instagram', { exact: false })
    .isVisible({ timeout: 500 })
    .catch(() => false);

  return passwordVisible && loginHeading;
}

async function isOneTapPage(page) {
  const url = page.url();
  if (url.includes('/accounts/onetap')) {
    return true;
  }

  return page
    .getByText('Save your login info?', { exact: false })
    .isVisible({ timeout: 1000 })
    .catch(() => false);
}

async function handleOneTapPage(page) {
  if (!(await isOneTapPage(page))) {
    return false;
  }

  console.log('Handling "Save your login info" prompt...');

  const notNowButton = page.getByRole('button', { name: 'Not now' });
  if (await notNowButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await notNowButton.click();
    await page.waitForTimeout(2000);
    return true;
  }

  const notNowText = page.getByText('Not now', { exact: true });
  if (await notNowText.isVisible({ timeout: 2000 }).catch(() => false)) {
    await notNowText.click();
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

async function checkSessionOnPage(page) {
  try {
    const url = page.url();

    if (url.includes('/accounts/login') || url.includes('two_step_verification')) {
      return false;
    }

    if (url.includes('/accounts/onetap') || (await isOneTapPage(page))) {
      return true;
    }

    if (await isLoginPageVisible(page)) {
      return false;
    }

    if (await isTwoFactorPage(page)) {
      return false;
    }

    const homeIndicators = [
      page.locator('svg[aria-label="Home"]'),
      page.locator('[role="navigation"]'),
      page.locator('main'),
      page.locator('a[href="/direct/inbox/"]'),
    ];

    for (const indicator of homeIndicators) {
      if (await indicator.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function isLoggedIn(page) {
  try {
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);
    return checkSessionOnPage(page);
  } catch {
    return false;
  }
}

async function isTwoFactorPage(page) {
  const url = page.url();
  if (url.includes('two_step_verification') || url.includes('two_factor')) {
    return true;
  }

  const twoFactorText = await page
    .getByText('authentication app', { exact: false })
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  if (twoFactorText) {
    return true;
  }

  const twoFaSelectors = [
    'input[name="verificationCode"]',
    'input[aria-label="Security code"]',
    'input[aria-label="Code"]',
    'input[autocomplete="one-time-code"]',
  ];

  for (const selector of twoFaSelectors) {
    if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }

  return false;
}

async function handleTwoFactor(page) {
  const onTwoFactorPage = await isTwoFactorPage(page);
  if (!onTwoFactorPage) {
    return false;
  }

  console.log('2FA required — check your authentication app');

  const twoFaSelectors = [
    'input[name="verificationCode"]',
    'input[aria-label="Security code"]',
    'input[aria-label="Code"]',
    'input[autocomplete="one-time-code"]',
    'input[placeholder*="Security code"]',
  ];

  let codeInput = null;
  for (const selector of twoFaSelectors) {
    const input = page.locator(selector);
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      codeInput = input;
      break;
    }
  }

  if (!codeInput) {
    throw new Error('2FA page detected but code input was not found');
  }

  const code = await prompt('Enter your 2FA code: ');
  await codeInput.fill(code);

  const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueButton.click();
  } else {
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
  }

  console.log('2FA code submitted, waiting for login to complete...');

  await page.waitForTimeout(3000);
  await dismissDialogs(page);
  return true;
}

async function waitForPostLogin(page) {
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    if (await isTwoFactorPage(page)) {
      await handleTwoFactor(page);
      continue;
    }

    if (await handleOneTapPage(page)) {
      continue;
    }

    await dismissDialogs(page);

    if (await checkSessionOnPage(page)) {
      return true;
    }

    if (!(await isLoginPageVisible(page)) && !page.url().includes('/accounts/login')) {
      await page.waitForTimeout(2000);
      if (await checkSessionOnPage(page)) {
        return true;
      }
    }

    await page.waitForTimeout(1500);
  }

  await handleOneTapPage(page);
  await dismissDialogs(page);

  return checkSessionOnPage(page);
}

async function dismissDialogs(page) {
  await handleOneTapPage(page);

  const dismissSelectors = [
    'button:has-text("Not Now")',
    'button:has-text("Not now")',
    'button:has-text("Allow all cookies")',
    'button:has-text("Decline optional cookies")',
    'button:has-text("Only allow essential cookies")',
  ];

  for (const selector of dismissSelectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
}

async function fillLoginForm(page, username, password) {
  const usernameSelectors = [
    'input[name="username"]',
    'input[name="email"]',
    'input[aria-label="Phone number, username, or email"]',
  ];

  let usernameFilled = false;
  for (const selector of usernameSelectors) {
    const input = page.locator(selector);
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(username);
      usernameFilled = true;
      break;
    }
  }

  if (!usernameFilled) {
    throw new Error('Could not find Instagram username input');
  }

  const passwordInput = page
    .locator('input[name="password"], input[name="pass"], input[type="password"]')
    .first();
  await passwordInput.fill(password);

  const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.click();
    return;
  }

  const submitInput = page.locator('input[type="submit"]').first();
  if (await submitInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitInput.click();
    return;
  }

  throw new Error('Could not find Instagram login submit button');
}

async function performLogin(page) {
  const username = process.env.IG_USERNAME;
  const password = process.env.IG_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'IG_USERNAME and IG_PASSWORD must be set in .env for first-time login'
    );
  }

  await page.goto('https://www.instagram.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForTimeout(2000);
  await dismissDialogs(page);

  if (!(await isLoginPageVisible(page))) {
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
  }

  await fillLoginForm(page, username, password);

  const loggedIn = await waitForPostLogin(page);
  if (!loggedIn) {
    throw new Error('Login failed — still on login page after submitting credentials');
  }

  await handleOneTapPage(page);
  await dismissDialogs(page);
}

async function waitForHomeFeed(page) {
  await dismissDialogs(page);
  await page.waitForTimeout(2000);

  const feedLoaded = await page
    .locator('main, article, [role="main"], svg[aria-label="Home"], [role="navigation"]')
    .first()
    .isVisible({ timeout: 30000 })
    .catch(() => false);

  if (!feedLoaded) {
    const stillOnLogin = await isLoginPageVisible(page);
    if (stillOnLogin) {
      throw new Error('Login required — session expired or invalid');
    }

    console.warn('Feed UI not detected, continuing with current session');
  }
}

async function ensureLoggedIn(page) {
  const loggedIn = await isLoggedIn(page);

  if (loggedIn) {
    console.log('Session restored — already logged in');
    await handleOneTapPage(page);
    await waitForHomeFeed(page);
    return { loggedIn: true, usedLogin: false };
  }

  console.log('Not logged in — performing login...');
  await performLogin(page);
  await waitForHomeFeed(page);
  console.log('Login complete');

  return { loggedIn: true, usedLogin: true };
}

module.exports = {
  ensureLoggedIn,
  isLoggedIn,
  checkSessionOnPage,
};
