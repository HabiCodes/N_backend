const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
     host: "smtp.gmail.com",
     port: 587,
     secure: false,
     requireTLS: true,
    auth: {
        user: process.env.GMAIL_USER,          // verifynchatapp@gmail.com
        pass: process.env.GMAIL_APP_PASSWORD,  // 16-char Gmail App Password
    },
});

async function sendVerificationEmail(email, code) {
    try {
        await transporter.sendMail({
            from: `"NChat" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "Your NChat verification code",
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Welcome to NChat 👋</h2>

                    <p>Your email verification code is:</p>

                    <h1 style="letter-spacing: 8px;">
                        ${code}
                    </h1>

                    <p>This code expires in 10 minutes.</p>

                    <p>If you did not create an NChat account, you can ignore this email.</p>
                </div>
            `,
        });
    } catch (err) {
        console.error("Email send failed:", err.message);
        throw new Error("Failed to send verification email");
    }
}

module.exports = {
    sendVerificationEmail,
};