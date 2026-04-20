# Large File Upload Production Notes

## Backend Changes Applied ✅
- Multer: 5GB fileSize, 50MB fieldSize.
- bodyParser: 50MB limits.
- Better multer error handling/logging.

## Testing
Run server and test with large file (>500MB):
```
cd /home/zeno/Projects/Bob/BuildOnBudget-Backend
node app.js
```
Use curl or browser form at `/new-project` with auth cookie.

## Production Deployment
1. **Restart server:** `pm2 restart ecosystem.config.js` or `node app.js`.
2. **Nginx/Reverse Proxy** (add to config):
```
client_max_body_size 5G;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```
3. **Frontend:** Consider FormData for >100MB files (base64 inefficient).
4. **Monitoring:** Watch `/tmp` disk space; consider S3 offload for prod.
5. **Security:** Validate file types/malware scan for prod.

Task complete! 🚀
