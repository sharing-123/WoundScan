# WoundScan on Oracle Cloud Always Free (24 hours a day, no monthly fee)

The app (FastAPI, three ONNX models, the website) runs in Docker on a free ARM server. Caddy in front of it gets a real HTTPS certificate by itself and the address is `https://<server-ip-with-dashes>.sslip.io`, which stays the same as long as the server's public IP does. Cases are stored in your Neon PostgreSQL.

## 1. Account (you, once)
Sign up at cloud.oracle.com/free. A card is only used to verify you; the Always Free resources are not charged. Pick a home region close to you (Singapore, Tokyo or Seoul). The region cannot be changed later.

## 2. Server
Compute, Instances, Create instance:
* Image **Ubuntu 22.04** (or 24.04), shape **VM.Standard.A1.Flex** (Ampere ARM) with **2 OCPU and 12 GB** memory (the free limit is 4 OCPU and 24 GB).
* Create a new SSH key pair and **download the private key**.
* Networking: keep "assign a public IPv4 address".
* After it starts: open its subnet's **Security List** and add two Ingress rules, source `0.0.0.0/0`, protocol TCP, destination ports **80** and **443**.
* Make the public IP permanent: Networking, IP management, **Reserved public IPs**, create one and attach it to the instance, so the address never changes.

"Out of host capacity" for A1 sometimes appears: try again later or another availability domain.

## 3. Install (on the server)
```bash
ssh -i path/to/key ubuntu@SERVER_IP
curl -fsSL https://raw.githubusercontent.com/sharing-123/WoundScan/main/deploy/oracle/setup.sh | bash
```
It installs Docker, opens the firewall, clones the code and tells you which model files are missing.

## 4. Upload the models (from your PC, PowerShell)
The weights are not on GitHub (non-commercial training data), so copy them yourself:
```powershell
cd C:\Users\allam\Downloads\WoundScan
scp -i path\to\key models\wound_seg.onnx models\wound_seg_medetec_adapted_320.onnx models\meta.json models\medetec_cv_metrics.json ubuntu@SERVER_IP:~/WoundScan/models/
scp -i path\to\key models\type\type_cls.onnx models\type\type_cls.json ubuntu@SERVER_IP:~/WoundScan/models/type/
```

## 5. Start (on the server)
```bash
bash ~/WoundScan/deploy/oracle/setup.sh
```
Paste your Neon `DATABASE_URL` when asked (hidden; it is stored only in `deploy/oracle/.env` on the server). The first build takes about 10 minutes. It ends with `READY: https://....sslip.io`.

## Update later
```bash
cd ~/WoundScan && git pull && cd deploy/oracle && docker compose up -d --build
```

## Notes
* Containers restart by themselves after a reboot (`restart: unless-stopped`).
* Oracle may reclaim Always Free instances that sit almost idle for 7 days. A site people use is fine; if it is reclaimed, repeat steps 2 to 5.
* Anyone with the link can use the models, which were trained on non-commercial data. Do not upload identifiable patient photos to a public instance.
