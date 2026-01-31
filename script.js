// ✅ Put your worker here (must end with "/?url=")
const WORKER_URL = "https://alt-account-checker-1.hugobang23.workers.dev/?url=";

const $ = (id) => document.getElementById(id);

$("btn").addEventListener("click", checkAlt);
$("username").addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkAlt();
});

function setBusy(busy, msg = "") {
  $("btn").disabled = busy;
  $("status").textContent = msg;
}

async function proxyFetch(targetUrl, options = {}) {
  const res = await fetch(WORKER_URL + encodeURIComponent(targetUrl), options);
  const text = await res.text();

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

  try { return JSON.parse(text); }
  catch { return text; }
}

async function getUserId(username) {
  const data = await proxyFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });
  return data?.data?.[0]?.id ?? null;
}

async function getUserInfo(userId) {
  return proxyFetch(`https://users.roblox.com/v1/users/${userId}`);
}

async function getFriendsCount(userId) {
  const data = await proxyFetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
  return data?.count ?? 0;
}

async function getGroupsCount(userId) {
  const data = await proxyFetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  return data?.data?.length ?? 0;
}

// fast signal: only first 100 badges
async function getBadgeCountFirst100(userId) {
  const data = await proxyFetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100`);
  return data?.data?.length ?? 0;
}

// Activity / presence (last online, in game, etc.)
async function getPresence(userId) {
  // Some regions/accounts may return limited info; we handle that gracefully.
  const data = await proxyFetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: [userId] })
  });
  return data?.userPresences?.[0] ?? null;
}

function daysSince(dateStr) {
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return Number.isFinite(days) ? days : 0;
}

function scoreSignals({ ageDays, badges, friends, groups }) {
  let score = 0;
  if (ageDays < 30) score += 3;
  if (badges < 10) score += 2;
  if (friends < 20) score += 2;
  if (groups < 3) score += 1;
  return score;
}

function verdict(score) {
  if (score >= 5) return "🔴 High alt risk";
  if (score >= 3) return "🟡 Medium alt risk";
  return "🟢 Low alt risk";
}

function presenceLabel(p) {
  // Roblox presence types: 0 offline, 1 online, 2 in game, 3 in studio
  if (!p) return "Unknown (presence not available)";
  const t = p.userPresenceType;
  if (t === 0) return "Offline";
  if (t === 1) return "Online";
  if (t === 2) return "In Game";
  if (t === 3) return "In Studio";
  return "Unknown";
}

async function checkAlt() {
  const username = $("username").value.trim();
  const out = $("output");

  if (!username) {
    out.textContent = "Enter a username.";
    return;
  }

  setBusy(true, "Looking up user…");
  out.textContent = "";

  try {
    const userId = await getUserId(username);
    if (!userId) {
      out.textContent = "User not found (or excluded).";
      return;
    }

    setBusy(true, "Fetching signals (age, badges, friends, groups, activity)…");

    const [info, friends, groups, badges, presence] = await Promise.all([
      getUserInfo(userId),
      getFriendsCount(userId),
      getGroupsCount(userId),
      getBadgeCountFirst100(userId),
      getPresence(userId).catch(() => null) // don’t fail the whole check if presence is blocked
    ]);

    const ageDays = daysSince(info.created);
    const score = scoreSignals({ ageDays, badges, friends, groups });

    const lastOnline = presence?.lastOnline ? new Date(presence.lastOnline).toLocaleString() : "Unknown";
    const lastLocation = presence?.lastLocation ?? "Unknown";

    out.textContent =
`Alt Check: ${username}
UserId: ${userId}

📅 Account age: ${ageDays} days
🏆 Badges (first 100): ${badges}
👥 Friends: ${friends}
👪 Groups: ${groups}

🕒 Activity: ${presenceLabel(presence)}
📍 Last location: ${lastLocation}
⏱ Last online: ${lastOnline}

📊 Score: ${score}
Result: ${verdict(score)}

Note: This is an estimate based on public signals — not proof.`;

  } catch (err) {
    out.textContent =
`Error:
${err.message}

Quick checks:
- WORKER_URL must be exactly your worker + "/?url="
- Test worker in browser:
  ${WORKER_URL}https%3A%2F%2Fusers.roblox.com%2Fv1%2Fusers%2F1`;
  } finally {
    setBusy(false, "");
  }
}
