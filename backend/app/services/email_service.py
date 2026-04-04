import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os


logger = logging.getLogger(__name__)


def send_workspace_invite_email(to_email: str, member_name: str, workspace_name: str, inviter_name: str, invite_token: str) -> bool:
    """
    Send workspace invite email with acceptance link.
    
    Args:
        to_email: Email address of the invited member
        member_name: Name of the member being invited
        workspace_name: Name of the workspace
        inviter_name: Name of the person inviting them
        invite_token: Unique token for accepting the invite
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        gmail_user = os.getenv("GMAIL_USER")
        gmail_app_password = os.getenv("GMAIL_APP_PASSWORD")
        app_url = os.getenv("APP_URL", "http://localhost:3000")
        
        if not gmail_user or not gmail_app_password:
            logger.warning("Gmail credentials not configured. Skipping email notification.")
            return False
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"You've been invited to {workspace_name}"
        msg["From"] = gmail_user
        msg["To"] = to_email
        
        # Generate CTA button link - use frontend route which proxies to backend
        accept_link = f"{app_url}/api/accept-invite?token={invite_token}"
        
        # HTML email body
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Invitation to {workspace_name}</h2>
                    <p>Hi {member_name},</p>
                    <p><strong>{inviter_name}</strong> has invited you to join the <strong>{workspace_name}</strong> workspace.</p>
                    <p>Click the button below to accept the invitation:</p>
                    <div style="margin: 30px 0;">
                        <a href="{accept_link}" style="background-color: #FF6B2B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Accept Invitation</a>
                    </div>
                    <p style="font-size: 0.9rem; color: #999;">If you did not expect this invitation, you can ignore this email.</p>
                    <p>Best regards,<br/>The Team</p>
                </div>
            </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
Invitation to {workspace_name}

Hi {member_name},

{inviter_name} has invited you to join the {workspace_name} workspace.

Click the link below to accept the invitation:
{accept_link}

If you did not expect this invitation, you can ignore this email.

Best regards,
The Team
        """
        
        # Attach both text and HTML
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        # Send email via Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_app_password)
            server.sendmail(gmail_user, to_email, msg.as_string())
        
        logger.info(f"Workspace invite email sent to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send workspace invite email to {to_email}: {str(e)}")
        return False


def send_team_added_email(to_email: str, member_name: str, team_name: str, workspace_name: str) -> bool:
    """
    Send confirmation email when member is added to a team.
    
    Args:
        to_email: Email address of the member
        member_name: Name of the member
        team_name: Name of the team
        workspace_name: Name of the workspace
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        gmail_user = os.getenv("GMAIL_USER")
        gmail_app_password = os.getenv("GMAIL_APP_PASSWORD")
        
        if not gmail_user or not gmail_app_password:
            logger.warning("Gmail credentials not configured. Skipping email notification.")
            return False
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"You've been added to {team_name}"
        msg["From"] = gmail_user
        msg["To"] = to_email
        
        # HTML email body
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Team Added</h2>
                    <p>Hi {member_name},</p>
                    <p>You have been added to team <strong>{team_name}</strong> in the <strong>{workspace_name}</strong> workspace.</p>
                    <p>You can now start collaborating with your team members.</p>
                    <p>Best regards,<br/>The Team</p>
                </div>
            </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
Team Added

Hi {member_name},

You have been added to team {team_name} in the {workspace_name} workspace.

You can now start collaborating with your team members.

Best regards,
The Team
        """
        
        # Attach both text and HTML
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        # Send email via Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_app_password)
            server.sendmail(gmail_user, to_email, msg.as_string())
        
        logger.info(f"Team added email sent to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send team added email to {to_email}: {str(e)}")
        return False
