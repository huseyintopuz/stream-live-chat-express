"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResetEmail = void 0;
const mail_transport_1 = require("../mail/mail.transport");
const sendResetEmail = async (email, resetLink) => {
    await mail_transport_1.mailTransport.sendMail({
        from: `"Stream Live Chat App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reset Password Request",
        html: `
            <div>
                <h2>Reset Password</h2>
                <p>Click the link below to reset your password:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>This link expires in 15 minutes.</p>
            </div>
        `
    });
};
exports.sendResetEmail = sendResetEmail;
//# sourceMappingURL=sendResetEmail.js.map