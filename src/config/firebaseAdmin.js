const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

const keyPath =
  process.env.NODE_ENV === "production"
    ? "/etc/secrets/firebase-admin-key.json"
    : path.join(
        __dirname,
        "secrets",
        "nchat-c34fe-firebase-adminsdk-fbsvc-fd3b0273e0.json"
      );

const serviceAccount = require(keyPath);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

// Export a ready-to-use messaging instance instead of the whole admin
// namespace — pushNotifications.js only ever needed messaging anyway.
module.exports = { messaging: getMessaging() };