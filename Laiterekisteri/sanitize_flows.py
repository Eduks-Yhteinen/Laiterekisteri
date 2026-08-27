import os
import json
import re

# Keys/fields commonly containing secrets in Power Automate / Logic Apps definitions
SECRET_KEYS = {
    "clientSecret", "secret", "refreshToken", "accessToken", 
    "clientId", "password", "authorization", "token", "sharedKey"
}

def sanitize_json(obj):
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            # If the key matches a secret name, sanitize the string value
            if any(secret_key.lower() in k.lower() for secret_key in SECRET_KEYS) and isinstance(v, str):
                new_dict[k] = "REDACTED"
            else:
                new_dict[k] = sanitize_json(v)
        return new_dict
    elif isinstance(obj, list):
        return [sanitize_json(item) for item in obj]
    elif isinstance(obj, str):
        # Regex to catch raw Azure AD / Google OAuth secrets if they appear in URL connection strings
        # E.g. client_secret=..., refresh_token=...
        cleaned = re.sub(r'(client_secret|refresh_token|code)=[^&"\']+', r'\1=REDACTED', obj)
        return cleaned
    return obj

count = 0
for root, _, files in os.walk("."):
    for file in files:
        if file.endswith(".json"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                sanitized_data = sanitize_json(data)
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(sanitized_data, f, indent=2)
                
                count += 1
            except Exception as e:
                pass

print(f"Successfully sanitized JSON files in {count} locations!")