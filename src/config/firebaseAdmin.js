const admin = require("firebase-admin");
const path = require("path");

const keyPath =
  process.env.NODE_ENV === "production"
    ? "/etc/secrets/firebase-admin-key.json"
    : path.join(
        __dirname,
        "secrets",
        "nchat-c34fe-firebase-adminsdk-fbsvc-fd3b0273e0.json"
      );

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;