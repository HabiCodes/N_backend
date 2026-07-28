const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, code) {
    try {
        await resend.emails.send({
            from: "NChat <noreply@yjfarms.info>",
            to: email,
            subject: "Your NChat verification code",
            html: `
                <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
                    <h2>Welcome to NChat 👋</h2>

                    <p>Your email verification code is:</p>

                    <div style="
                        font-size:32px;
                        font-weight:bold;
                        letter-spacing:8px;
                        background:#f5f5f5;
                        padding:16px;
                        border-radius:8px;
                        text-align:center;
                    ">
                        ${code}
                    </div>

                    <p style="margin-top:20px;">
                        This code expires in <strong>10 minutes</strong>.
                    </p>

                    <p>
                        If you didn't create an NChat account,
                        you can safely ignore this email.
                    </p>
                </div>
            `,
        });

        console.log("Verification email sent.");
    } catch (err) {
        console.error(err);
        throw new Error("Failed to send verification email");
    }
}

module.exports = {
    sendVerificationEmail,
};