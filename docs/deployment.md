# Deployment Guide

This app runs as a single Docker container. The frontend is served by the same FastAPI process that handles the API, so there is only one service to manage.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- The project folder on the machine that will run the app

## First-time setup

**1. Create your `.env` file**

Copy the example and fill in your credentials:

```
cp .env.example .env        # Mac / Linux
copy .env.example .env      # Windows Command Prompt
```

Open `.env` and change the password before you do anything else:

```
NEXT_PUBLIC_ADMIN_USERNAME=admin
NEXT_PUBLIC_ADMIN_PASSWORD=your_strong_password_here
```

The credentials are baked into the frontend bundle at build time. If you change `.env` later you must rebuild the container (`docker compose up --build -d`).

**2. Build and start**

```
docker compose up --build -d
```

The first build takes a few minutes (it installs Node and Python dependencies). Subsequent starts without `--build` take a few seconds.

**3. Open the app**

- From the same machine: http://localhost:8000
- From another device on the same network: http://YOUR_MACHINE_IP:8000

To find your machine's local IP:
- Windows: run `ipconfig` in Command Prompt — look for "IPv4 Address" under your active adapter
- Mac: run `ifconfig | grep "inet "` or check System Settings > Network
- Linux: run `ip a` or `hostname -I`

Your phone, tablet, or other laptop on the same Wi-Fi can reach the app at that IP address.

## Day-to-day commands

| Action | Command |
|--------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| View logs | `docker compose logs -f` |
| Restart | `docker compose restart` |

Or use the scripts in `scripts/` — see below.

## Data and backups

The database is stored in `backend/data/driving_school.db` on the host machine (mounted into the container as a volume). The container can be rebuilt or deleted without losing data as long as this folder is intact.

**Manual backup**

Copy the database file somewhere safe while the app is stopped:

```
docker compose down
cp backend/data/driving_school.db backup/driving_school_$(date +%Y%m%d).db   # Mac / Linux
```

On Windows:
```
docker compose down
copy backend\data\driving_school.db backup\driving_school_%date:~10,4%%date:~4,2%%date:~7,2%.db
```

**Restore from backup**

```
docker compose down
cp backup/driving_school_20250101.db backend/data/driving_school.db
docker compose up -d
```

**Scheduled backups (Linux/Mac)**

Add this line to your crontab (`crontab -e`) to back up daily at 2 AM:

```
0 2 * * * cp /path/to/project/backend/data/driving_school.db /path/to/backups/driving_school_$(date +\%Y\%m\%d).db
```

## Upgrading

Pull the latest code, rebuild, and restart:

```
git pull
docker compose up --build -d
```

Database migrations run automatically on startup — you do not need to do anything manually.

## Stopping permanently

```
docker compose down
```

This stops and removes the container. The data in `backend/data/` is not affected.

## Scripts

Simple wrapper scripts are in `scripts/`:

| Script | Purpose |
|--------|---------|
| `scripts/start.bat` / `scripts/start.sh` | Build (if needed) and start |
| `scripts/stop.bat` / `scripts/stop.sh` | Stop the app |

## Security checklist

- [ ] Changed `NEXT_PUBLIC_ADMIN_PASSWORD` from the default in `.env`
- [ ] `.env` is not committed to git (it is in `.gitignore`)
- [ ] The machine running the app is on a private network, not exposed to the internet
- [ ] Port 8000 is not forwarded through your router
- [ ] `backend/data/` is backed up regularly

## Troubleshooting

**Container exits immediately**

```
docker compose logs
```

Check the output for startup errors. The most common cause is a missing or invalid `.env` file.

**"Address already in use" on port 8000**

Something else is using port 8000. Either stop that process or change the port in `docker-compose.yml`:

```yaml
ports:
  - "9000:8000"   # change 9000 to any free port
```

Then access the app on the new port.

**Data appears missing after a restart**

Check that the volume mount is correct in `docker-compose.yml`:

```yaml
volumes:
  - ./backend/data:/app/backend/data
```

And confirm `backend/data/driving_school.db` exists on the host.

**Login not working after changing the password**

The credentials are baked into the frontend at build time. After changing `.env`, you must rebuild:

```
docker compose up --build -d
```
