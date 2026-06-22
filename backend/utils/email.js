const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"Pauls Motor Parts" <${process.env.EMAIL_USER}>`,
    to, subject, html
  });
};

module.exports = { sendEmail };
