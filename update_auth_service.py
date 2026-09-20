import os

def modify_auth_service():
    with open('frontend-web/src/app/services/auth.service.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    new_methods = """
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyCode(email: string, code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-code`, { email, code });
  }

  resetPassword(email: string, code: string, new_password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { email, code, new_password });
  }

  logout(): void {
"""
    content = content.replace("  logout(): void {", new_methods)
    with open('frontend-web/src/app/services/auth.service.ts', 'w', encoding='utf-8') as f:
        f.write(content)

modify_auth_service()
