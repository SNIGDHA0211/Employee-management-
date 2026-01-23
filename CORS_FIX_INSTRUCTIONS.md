# CORS Fix Instructions for Backend Developer

## Problem
The frontend application is getting a **CORS (Cross-Origin Resource Sharing) error** when trying to login. The API works fine in Postman but fails in the browser.

**Error Message:** `Network error: Unable to connect to server. This might be a CORS issue.`

## Solution
The backend server needs to allow requests from the frontend origin.

### Frontend Details:
- **Frontend URL:** Check browser console for exact origin (usually `http://localhost:5173` or similar)
- **Backend URL:** `https://employee-management-system-tmrl.onrender.com`
- **Login Endpoint:** `POST https://employee-management-system-tmrl.onrender.com/accounts/login/`
- **Admin Endpoint:** `POST https://employee-management-system-tmrl.onrender.com/admin/`

### Required CORS Headers:
The backend must send these headers in the response:

```
Access-Control-Allow-Origin: http://localhost:5173 (or your frontend URL)
Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Accept, Authorization
Access-Control-Allow-Credentials: true (if using cookies/sessions)
```

## Implementation by Framework:

### For Django (Python):

1. **Install django-cors-headers:**
   ```bash
   pip install django-cors-headers
   ```

2. **Add to `settings.py`:**
   ```python
   INSTALLED_APPS = [
       ...
       'corsheaders',
       ...
   ]

   MIDDLEWARE = [
       'corsheaders.middleware.CorsMiddleware',  # Must be at the top
       'django.middleware.common.CommonMiddleware',
       ...
   ]

   # Allow all origins (for development only)
   CORS_ALLOW_ALL_ORIGINS = True

   # OR specify specific origins (recommended for production)
   CORS_ALLOWED_ORIGINS = [
       "http://localhost:5173",
       "http://localhost:3000",
       "http://127.0.0.1:5173",
       # Add your frontend URL here
   ]

   CORS_ALLOW_CREDENTIALS = True
   CORS_ALLOW_METHODS = [
       'DELETE',
       'GET',
       'OPTIONS',
       'PATCH',
       'POST',
       'PUT',
   ]
   CORS_ALLOW_HEADERS = [
       'accept',
       'accept-encoding',
       'authorization',
       'content-type',
       'dnt',
       'origin',
       'user-agent',
       'x-csrftoken',
       'x-requested-with',
   ]
   ```

### For Flask (Python):

1. **Install flask-cors:**
   ```bash
   pip install flask-cors
   ```

2. **Add to your Flask app:**
   ```python
   from flask_cors import CORS

   app = Flask(__name__)
   CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins

   # OR for specific origins:
   CORS(app, resources={
       r"/accounts/*": {"origins": ["http://localhost:5173"]},
       r"/admin/*": {"origins": ["http://localhost:5173"]}
   })
   ```

### For Express.js (Node.js):

1. **Install cors:**
   ```bash
   npm install cors
   ```

2. **Add to your app:**
   ```javascript
   const cors = require('cors');

   // Allow all origins
   app.use(cors());

   // OR for specific origins:
   app.use(cors({
       origin: ['http://localhost:5173', 'http://localhost:3000'],
       credentials: true,
       methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
       allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
   }));
   ```

### For FastAPI (Python):

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Testing

After implementing CORS:

1. **Check browser console** - The CORS error should be gone
2. **Check Network tab** - Look for OPTIONS request (preflight) that should return 200
3. **Verify headers** - Response should include `Access-Control-Allow-Origin` header

## Quick Test

You can test if CORS is working by running this in browser console on your frontend:

```javascript
fetch('https://employee-management-system-tmrl.onrender.com/accounts/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'Rohit', password: '@Nashik03' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

If CORS is fixed, this should work without errors.

## Important Notes:

- **For Development:** You can allow all origins with `*` or `CORS_ALLOW_ALL_ORIGINS = True`
- **For Production:** Always specify exact origins for security
- **OPTIONS Request:** The browser sends a preflight OPTIONS request first - make sure your backend handles it
- **Credentials:** If using sessions/cookies, set `Access-Control-Allow-Credentials: true`

