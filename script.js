async function checkAlt() {
  const username = document.getElementById("username").value;
  const output = document.getElementById("output");
  output.textContent = "Checking...";

  try {
    // Username → UserId
    const userRes = await fetch(
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
    const userData = await userRes.json();
    if (!userData.data.length) {
      output.textContent = "User not found.";
      return;
    }

    const userId = userData.data[0].id;

    // User info
    const info = await fetch(
      `https://users.roblox.com/v1/users/${userId}`
    ).then(r => r.json());

    const created = new Date(info.created);
    const ageDays = Math.floor(
      (Date.now() - created) / 86400000
    );

    // Friends
    const friends = await fetch(
      `https://friends.roblox.com/v1/users/${userId}/friends/count`
    ).then(r => r.json());

    // Groups
    const groups = await fetch(
      `https://groups.roblox.com/v1/users/${userId}/groups/roles`
    ).then(r => r.json());

    // Badges (first 100 only – enough for scoring)
    const badges = await fetch(
      `https://badges.roblox.com/v1/users/${userId}/badges?limit=100`
    ).then(r => r.json());

    // Alt score
    let score = 0;
    if (ageDays < 30) score += 3;
    if (badges.data.length < 10) score += 2;
    if (friends.count < 20) score += 2;
    if (groups.data.length < 3) score += 1;

    let verdict = "🟢 Low alt risk";
    if (score >= 5) verdict = "🔴 High alt risk";
    else if (score >= 3) verdict = "🟡 Medium alt risk";

    output.textContent =
`Alt Check: ${username}

📅 Account age: ${ageDays} days
🏆 Badges: ${badges.data.length}
👥 Friends: ${friends.count}
👪 Groups: ${groups.data.length}

📊 Score: ${score}
Result: ${verdict}`;

  } catch (e) {
    output.textContent = "Error checking account.";
  }
}
