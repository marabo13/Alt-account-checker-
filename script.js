// 1) PUT YOUR CLOUDFLARE WORKER URL HERE
// It MUST look like: https://your-worker-name.your-subdomain.workers.dev/?url=
const WORKER_URL = "https://YOURWORKER.YOURNAME.workers.dev/?url=";

async function proxyFetch(targetUrl, options = {}) {
  // Sends requests through the Cloudflare Worker so GitHub Pages doesn’t get CORS blocked
  const res = await fetch(WORKER_URL + encodeURIComponent(targetUrl), options);

  const text = await res.text();

  // Helpful error output instead of just "Error checking account"
  if (!res.ok) {
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }

  // Some endpoints might return empty text on edge cases; guard JSON parsing
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function checkAlt() {
  const username = document.getElementById("username").value.trim();
  const output = document.getElementById("output");

  if (!username) {
    output.textContent = "Enter a username.";
    return;
  }

  output.textContent = "Checking…";

  try {
    // Username -> UserId
    const userRes = await proxyFetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: true
        })
      }
    );

    if (!userRes?.data?.length) {
      output.textContent = "User not found.";
      return;
    }

    const userId = userRes.data[0].id;

    // Fetch signals in parallel
    const [info, friends, groups, badges] = await Promise.all([
      proxyFetch(`https://users.roblox.com/v1/users/${userId}`),
      proxyFetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      proxyFetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
      proxyFetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100`)
    ]);

    // Account age in days
    const created = new Date(info.created);
    const ageDays = Math.floor((Date.now() - created.getTime()) / 86400000);

    const badgeCount = badges?.data?.length ?? 0;
    const friendCount = friends?.count ?? 0;
    const groupCount = groups?.data?.length ?? 0;

    // Simple alt-likelihood score
    let score = 0;
    if (ageDays < 30) score += 3;
    if (badgeCount < 10) score += 2;
    if (friendCount < 20) score += 2;
    if (groupCount < 3) score += 1;

    let verdict = "🟢 Low alt risk";
    if (score >= 5) verdict = "🔴 High alt risk";
    else if (score >= 3) verdict = "🟡 Medium alt risk";

    output.textContent =
`Alt Check: ${username}
UserId: ${userId}

📅 Account age: ${ageDays} days
🏆 Badges (first 100): ${badgeCount}
👥 Friends: ${friendCount}
👪 Groups: ${groupCount}

📊 Score: ${score}
Result: ${verdict}

Note: This is only an estimate based on public signals, not proof of an alt.`;

  } catch (err) {
    output.textContent =
`Error checking account.

${err.message}

Fix tips:
- Make sure WORKER_URL is correct and ends with "?url="
- Test the worker like:
  https://YOURWORKER...workers.dev/?url=https://users.roblox.com/v1/users/1
- Then hard refresh your GitHub Pages site (Ctrl+F5)`;
  }
}
