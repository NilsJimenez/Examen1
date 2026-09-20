def update_auth_endpoints():
    with open('backend/app/api/v1/endpoints/auth.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    start_str = '@router.post("/forgot-password")'
    end_str = '@router.get("/me", response_model=UserProfileResponse)'
    
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    
    if start_idx == -1 or end_idx == -1:
        print("Couldn't find markers")
        return
        
    new_endpoints = """@router.post("/forgot-password")
def forgot_password(email_data: dict, db: Session = Depends(get_db)):
    \"\"\"
    CU-03: Genera y envia un código OTP de 6 dígitos al correo del usuario.
    \"\"\"
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="El correo es requerido.")

    user = db.query(Usuario).filter(Usuario.email == email).first() or \\
           db.query(Cliente).filter(Cliente.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No se encontró una cuenta con ese correo.")

    import random
    from datetime import datetime, timedelta
    from app.services.email_service import send_reset_code_email

    # Generar código de 6 dígitos
    code = f"{random.randint(100000, 999999)}"
    
    user.reset_code = code
    user.reset_code_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()
    
    # Enviar correo
    send_reset_code_email(email, code)

    return {
        "message": f"Se ha enviado un código de 6 dígitos a: {email}",
        "status": "success"
    }

@router.post("/verify-code")
def verify_code(data: dict, db: Session = Depends(get_db)):
    \"\"\"
    Verifica que el código ingresado sea válido y no haya expirado.
    \"\"\"
    email = data.get("email")
    code = data.get("code")
    
    if not email or not code:
        raise HTTPException(status_code=400, detail="Faltan datos.")
        
    user = db.query(Usuario).filter(Usuario.email == email).first() or \\
           db.query(Cliente).filter(Cliente.email == email).first()
           
    if not user or user.reset_code != code:
        raise HTTPException(status_code=400, detail="Código inválido o incorrecto.")
        
    from datetime import datetime
    if not user.reset_code_expires or user.reset_code_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El código ha expirado. Solicita uno nuevo.")
        
    return {"message": "Código verificado correctamente.", "status": "success"}

@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    \"\"\"
    CU-03: Restablecimiento de la contraseña usando el código verificado.
    \"\"\"
    email = data.get("email")
    code = data.get("code")
    new_password = data.get("new_password")
    
    if not email or not new_password or not code:
        raise HTTPException(status_code=400, detail="Faltan datos (email, code o new_password).")

    user = db.query(Usuario).filter(Usuario.email == email).first() or \\
           db.query(Cliente).filter(Cliente.email == email).first()
           
    if not user or user.reset_code != code:
        raise HTTPException(status_code=400, detail="Código inválido.")
        
    from datetime import datetime
    if not user.reset_code_expires or user.reset_code_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El código ha expirado.")

    user.password_hash = get_password_hash(new_password)
    # Limpiar código usado
    user.reset_code = None
    user.reset_code_expires = None
    db.commit()
    
    return {"message": "Contraseña actualizada con éxito."}

"""
    
    final_content = content[:start_idx] + new_endpoints + content[end_idx:]
    
    with open('backend/app/api/v1/endpoints/auth.py', 'w', encoding='utf-8') as f:
        f.write(final_content)
        
update_auth_endpoints()
