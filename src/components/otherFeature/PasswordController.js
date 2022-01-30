import { config } from 'dotenv';
config();

export class PasswordController {

  verifyPassword(req, res) {
    const request_password = decodePassword(req.body.password)

    if (request_password == process.env.SITE_PASSWORD) {
      /**
       * Send generate random token
       * Check email exist
       * JWT implementation?
       */
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
    
  }

}

function decodePassword(password) {
  let bufferObj = Buffer.from(password, "base64");
  return bufferObj.toString("utf-8");
}