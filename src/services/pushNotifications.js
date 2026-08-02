const { messaging } = require('../config/firebaseAdmin');

/**
 * Sends a high-priority data-only FCM message for an incoming call.
 * Data-only (no "notification" key) is REQUIRED so the app's
 * onMessageReceived() fires even when the app is backgrounded/killed —
 * a "notification" payload gets delivered straight to the system tray
 * by the OS instead, and our call-handling code never runs.
 */
async function sendCallPushNotification(fcmToken, { fromUserId, fromUsername, callId, conversationId, callType }) {
  if (!fcmToken) return false;

  const message = {
    token: fcmToken,
    data: {
      type: 'incoming_call',
      fromUserId,
      fromUsername,
      callId: callId || '',
      conversationId,
      callType: callType || 'audio',
    },
    android: {
      priority: 'high', // wakes the device out of Doze for time-sensitive delivery
    },
  };

 try {
    await messaging.send(message);
    return true;
  } catch (err) {
    console.error('[sendCallPushNotification] failed:', err.message);
    // Common cause: token is stale/invalid (user reinstalled, cleared data, etc.)
    // A production app would detect err.code === 'messaging/registration-token-not-registered'
    // here and clear the stale token from the DB so it stops being retried.
    return false;
  }
}
/**
 * Sends a data-only FCM message for a new chat message, for recipients
 * who are currently offline (no live socket). Data-only for the same
 * reason as calls — keeps onMessageReceived() in control on Android.
 */
async function sendMessagePushNotification(fcmToken, { fromUserId, fromUsername, conversationId, preview }) {
  if (!fcmToken) return false;

  const message = {
    token: fcmToken,
    data: {
      type: 'new_message',
      fromUserId,
      fromUsername,
      conversationId,
      preview: preview.slice(0, 120), // keep payload small, notification doesn't need the full text
    },
    android: {
      priority: 'high',
    },
  };

  try {
    await messaging.send(message);
    return true;
  } catch (err) {
    console.error('[sendMessagePushNotification] failed:', err.message);
    return false;
  }
}

module.exports = { sendCallPushNotification, sendMessagePushNotification };