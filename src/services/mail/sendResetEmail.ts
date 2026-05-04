import { mailTransport } from "../mail/mail.transport";

export const sendResetEmail = async (
    email: string,
    resetLink: string
) => {
    await mailTransport.sendMail({
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
