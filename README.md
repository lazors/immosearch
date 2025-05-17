# ImmoSearch - Automated Property Search

An automated property search tool that monitors ImmoScout24 for new listings and sends notifications via Telegram.

## Features

- 🔍 Automated property search on ImmoScout24
- 📱 Telegram notifications for new listings
- ⏰ Configurable check intervals
- 🤖 Human-like browsing behavior
- 📊 Detailed logging and monitoring
- 🏠 Maintains history of seen listings

## Prerequisites

- Node.js (v14 or higher)
- npm
- Telegram Bot Token
- ImmoScout24 filter URL

## Local Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd immosearch
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with your configuration:

   ```
   TELEGRAM_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_IDS=your_chat_id,another_chat_id
   IMMOSCOUT_FILTER_URL=your_immoscout_filter_url
   ```

4. Run the script:

   ```bash
   # Normal mode (uses .env)
   ts-node check-immo-scout.ts

   # Interactive mode (prompts for values)
   ts-node check-immo-scout.ts --interactive
   ```

## Server Deployment (Oracle Cloud Free Tier)

### 1. Oracle Cloud Setup

1. Create Oracle Cloud Account:

   - Visit https://www.oracle.com/cloud/free/
   - Click "Start for free"
   - Complete registration (no credit card required)

2. Create VM Instance:
   - Log into Oracle Cloud Console
   - Navigate to Compute → Instances
   - Click "Create Instance"
   - Choose "Always Free Eligible" resources
   - Select Ubuntu 20.04 or 22.04
   - Choose VM.Standard.E2.1.Micro (1GB RAM)
   - Generate SSH key pair
   - Click "Create"

### 2. Server Configuration

1. Connect to your VM:

   ```bash
   ssh ubuntu@<your-ip>
   ```

2. Update system:

   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

3. Install required software:
   ```bash
   sudo apt install -y nodejs npm git nginx
   ```

### 3. Application Deployment

1. Clone and setup:

   ```bash
   git clone <repository-url>
   cd immosearch
   npm install
   npm install -g pm2
   ```

2. Configure environment:

   ```bash
   # Create .env file
   nano .env
   # Add your configuration
   ```

3. Start with PM2:
   ```bash
   pm2 start check-immo-scout.ts --interpreter="node" --interpreter-args="--loader ts-node/esm"
   pm2 save
   pm2 startup
   ```

### 4. Monitoring Setup (Prometheus + Grafana)

1. Install Prometheus:

   ```bash
   wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
   tar xvfz prometheus-*.tar.gz
   cd prometheus-*
   ```

2. Configure Prometheus:

   ```bash
   # Create prometheus.yml
   nano prometheus.yml
   ```

3. Install Grafana:

   ```bash
   sudo apt-get install -y software-properties-common
   sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
   sudo apt-get update
   sudo apt-get install grafana
   ```

4. Start services:
   ```bash
   sudo systemctl start prometheus
   sudo systemctl start grafana-server
   sudo systemctl enable prometheus
   sudo systemctl enable grafana-server
   ```

### 5. Access Monitoring

1. Grafana Dashboard:

   - Open http://<your-ip>:3000
   - Default login: admin/admin
   - Add Prometheus as data source
   - Import dashboard for monitoring

2. View Logs:
   - Application logs: `pm2 logs`
   - Debug logs: `tail -f debug.log`

## Maintenance

### Log Files

- `debug.log`: Detailed operation logs
- `seenListings.json`: History of seen listings (last 100)

### Monitoring

- Grafana Dashboard: Real-time monitoring
- Prometheus: Metrics collection
- PM2: Process management

### Backup

- Regular backups of `seenListings.json`
- Grafana dashboard exports
- PM2 process list

## Troubleshooting

1. Check application status:

   ```bash
   pm2 status
   pm2 logs
   ```

2. Check monitoring:

   ```bash
   sudo systemctl status prometheus
   sudo systemctl status grafana-server
   ```

3. View logs:
   ```bash
   tail -f debug.log
   ```

## Security Notes

- Keep your `.env` file secure
- Regularly update system packages
- Monitor server resources
- Use strong passwords for Grafana

## Support

For issues or questions:

1. Check the debug.log file
2. Review PM2 logs
3. Check Grafana metrics
4. Contact support

## License

ISC License
