import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

def send_reset_code_email(to_email: str, code: str):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"SIMULACIÓN (Sin credenciales SMTP): Código para {to_email} es {code}")
        return True
        
    subject = "Código de Recuperación - FashionStore"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #eab308; text-align: center;">FashionStore</h2>
            <h3 style="color: #333;">Recuperación de Contraseña</h3>
            <p style="color: #555; font-size: 16px;">
                Hemos recibido una solicitud para restablecer tu contraseña. Ingresa el siguiente código de 6 dígitos en la aplicación:
            </p>
            <div style="background-color: #18181b; color: #eab308; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; border-radius: 8px; letter-spacing: 5px; margin: 20px 0;">
                {code}
            </div>
            <p style="color: #555; font-size: 14px;">
                Este código expira en 15 minutos. Si no fuiste tú, ignora este mensaje.
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"FashionStore <{SMTP_USERNAME}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print("Error enviando correo:", e)
        return False
