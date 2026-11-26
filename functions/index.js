"use strict";

const { createHash } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp({
  databaseURL: "https://idle-eden-default-rtdb.firebaseio.com"
});

const discordWebhookUrl = defineSecret("DISCORD_WEBHOOK_URL");
const maxAchievementsPerMinute = 10;
const allowedAchievements = new Map([
  ["first-blood", "First Blood"],
  ["veteran", "Veteran"],
  ["champion-hunter", "Champion Hunter"],
  ["relic-master", "Relic Master"],
  ["realm-hero", "Realm Hero"],
  ["rr10", "RR10 Hero"],
  ["rr100", "RR100 Hero"],
  ["master-of-frontiers", "Master of the Frontiers"],
  ["elite-raids", "Realm's Greatest"]
]);

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireText(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} must be text.`);
  }

  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return text;
}

function sanitizeDiscordText(value) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/@/g, "@\u200b")
    .replace(/\s+/g, " ");
}

function validateAchievement(achievementId, achievementName) {
  const knownName = allowedAchievements.get(achievementId);
  if (knownName) {
    if (knownName !== achievementName) {
      throw new HttpsError("invalid-argument", "Achievement details do not match.");
    }
    return;
  }

  const isZoneAchievement = /^zone-[1-9]\d{0,2}$/.test(achievementId);
  if (!isZoneAchievement || !achievementName.endsWith(" Pathfinder")) {
    throw new HttpsError("invalid-argument", "Unsupported achievement.");
  }
}

function getDiscordWebhookUrl() {
  let webhook;
  try {
    webhook = new URL(discordWebhookUrl.value());
  } catch (error) {
    throw new HttpsError("failed-precondition", "The Discord webhook secret is not configured correctly.");
  }

  const allowedHosts = ["discord.com", "canary.discord.com", "ptb.discord.com"];
  if (
    webhook.protocol !== "https:" ||
    !allowedHosts.includes(webhook.hostname) ||
    !webhook.pathname.startsWith("/api/webhooks/")
  ) {
    throw new HttpsError("failed-precondition", "The Discord webhook secret is not a valid Discord webhook URL.");
  }
  return webhook.toString();
}

exports.postDiscordAchievement = onCall(
  {
    region: "us-central1",
    secrets: [discordWebhookUrl],
    timeoutSeconds: 15,
    maxInstances: 3
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before announcing achievements.");
    }

    const data = request.data && typeof request.data === "object" ? request.data : {};
    const playerName = requireText(data.playerName, "Player name", 60);
    const characterId = requireText(data.characterId, "Character ID", 80);
    const achievementId = requireText(data.achievementId, "Achievement ID", 40);
    const achievementName = requireText(data.achievement, "Achievement", 100);

    if (!/^[A-Za-z0-9_-]+$/.test(characterId)) {
      throw new HttpsError("invalid-argument", "Character ID is invalid.");
    }
    validateAchievement(achievementId, achievementName);

    const database = getDatabase();
    const userHash = hash(request.auth.uid);
    const characterHash = hash(characterId);
    const eventReference = database.ref(
      `discordAchievementEvents/${userHash}/${characterHash}/${achievementId}`
    );
    const claim = await eventReference.transaction((current) => (
      current ? undefined : { claimedAt: Date.now() }
    ));

    if (!claim.committed) {
      return { sent: false, duplicate: true };
    }

    const now = Date.now();
    const minuteBucket = Math.floor(now / 60000);
    const rateLimitReference = database.ref(`discordAchievementRateLimits/${userHash}`);
    let rateLimit;
    try {
      rateLimit = await rateLimitReference.transaction((current) => {
        const count = current && current.minute === minuteBucket ? current.count : 0;
        if (!Number.isSafeInteger(count) || count >= maxAchievementsPerMinute) {
          return;
        }
        return { minute: minuteBucket, count: count + 1 };
      });
    } catch (error) {
      await releaseEventClaim(eventReference);
      throw error;
    }

    if (!rateLimit.committed) {
      await releaseEventClaim(eventReference);
      throw new HttpsError("resource-exhausted", "Too many achievement notifications. Try again shortly.");
    }

    const content = `🏆 ${sanitizeDiscordText(playerName)} unlocked achievement: ${sanitizeDiscordText(achievementName)}`;
    try {
      const response = await fetch(getDiscordWebhookUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          allowed_mentions: { parse: [] }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Discord returned HTTP ${response.status}.`);
      }
      return { sent: true, duplicate: false };
    } catch (error) {
      await releaseEventClaim(eventReference);
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("Discord achievement delivery failed.", error);
      throw new HttpsError("unavailable", "Discord could not receive the achievement notification.");
    }
  }
);

async function releaseEventClaim(eventReference) {
  try {
    await eventReference.remove();
  } catch (error) {
    console.error("Could not release the Discord achievement idempotency claim.", error);
  }
}
