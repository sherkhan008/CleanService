"""
Email service for sending password reset codes via SMTP.
Uses environment variables for SMTP configuration.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional


def get_smtp_config() -> Optional[dict]:
    """
    Get SMTP configuration from environment variables.
    Returns None if SMTP is not configured.
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM")

    if not all([smtp_host, smtp_port, smtp_user, smtp_password, smtp_from]):
        return None

    try:
        return {
            "host": smtp_host,
            "port": int(smtp_port),
            "user": smtp_user,
            "password": smtp_password,
            "from_email": smtp_from,
        }
    except ValueError:
        return None


def send_password_reset_email(email: str, reset_code: str) -> bool:
    """
    Send a password reset code email to the user.
    Returns True if email was sent successfully, False otherwise.
    """
    config = get_smtp_config()
    if not config:
        # SMTP not configured, log instead
        print(f"[EMAIL] Password reset code for {email}: {reset_code}")
        return False

    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "TazaBolsyn - Password Reset Code"
        msg["From"] = config["from_email"]
        msg["To"] = email

        # Email body
        text_content = f"""
Hello,

You requested a password reset for your TazaBolsyn account.

Your reset code is: {reset_code}

This code will expire in 15 minutes.

If you did not request this reset, please ignore this email.

Best regards,
TazaBolsyn Team
"""

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .code {{ font-size: 24px; font-weight: bold; color: #0066cc; letter-spacing: 4px; 
                padding: 15px; background: #f0f0f0; text-align: center; margin: 20px 0; }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your TazaBolsyn account.</p>
        <div class="code">{reset_code}</div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this reset, please ignore this email.</p>
        <div class="footer">
            <p>Best regards,<br>TazaBolsyn Team</p>
        </div>
    </div>
</body>
</html>
"""

        # Attach parts
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)

        # Send email
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            server.login(config["user"], config["password"])
            server.send_message(msg)

        print(f"[EMAIL] Password reset code sent to {email}")
        return True

    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email to {email}: {e}")
        # Fallback: log the code
        print(f"[EMAIL] Password reset code for {email}: {reset_code}")
        return False

