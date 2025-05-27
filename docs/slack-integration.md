***REMOVED*** Integration

The Blitzer app includes a Slack slash command integration that allows you to get user reports directly in Slack.

## Setup

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Enter app name: "Blitzer" and select your workspace
4. Click "Create App"

### 2. Configure Slash Commands

1. In your Slack app settings, go to "Slash Commands"
2. Click "Create New Command"
3. Configure the command:
   - **Command**: `/whois`
   - **Request URL**: `https://your-domain.com/api/slack/whois`
   - **Short Description**: "Get Blitzer user stats"
   - **Usage Hint**: `[username or email]`
4. Click "Save"

### 3. Get Your Signing Secret

1. Go to "Basic Information" in your Slack app settings
2. Scroll down to "App Credentials"
3. Copy the "Signing Secret"
4. Add it to your environment variables:
   ```
   ***REMOVED***
   ```

### 4. Install the App

1. Go to "Install App" in the sidebar
2. Click "Install to Workspace"
3. Grant the requested permissions

## Usage

Once configured, you can use the `/whois` command in any Slack channel:

```
/whois alice@dutchblitz.io
/whois username123
```

### Response Format

The command returns a comprehensive user report including:

#### Basic Info
- Email address
- Member since date
- Number of friends
- Last activity date

#### Gaming Stats
- Total games played
- Recent games (last 30 days)
- Total rounds played
- Rounds won
- Batting average (rounds won / total rounds)
- Cumulative score

### Example Response

```
🎯 User Report: alice

Email: alice@dutchblitz.io
Member Since: 1/15/2024
Friends: 5
Last Activity: 3/20/2024

🎮 Gaming Stats
Total Games: 12
Recent Games (30d): 3
Total Rounds: 45
Rounds Won: 18
Batting Average: 0.400
Cumulative Score: 125
```

## Security

The integration includes several security measures:

- **Request Verification**: All requests are verified using Slack's signing secret
- **Timestamp Validation**: Protects against replay attacks
- **Error Handling**: Sensitive errors are not exposed to Slack users

## Troubleshooting

### "Invalid request signature" Error
- Verify your `SLACK_SIGNING_SECRET` environment variable is correct
- Ensure your app's request URL is properly configured

### "User not found" Error
- The user must be registered in Blitzer
- Try both username and email address formats
- Usernames and emails are case-insensitive

### Command Not Responding
- Check your app's request URL is accessible
- Verify the endpoint is deployed and running
- Check server logs for detailed error messages

## Development Testing

To test the integration locally:

1. Use ngrok to expose your local server:
   ```bash
   ngrok http 3000
   ```

2. Update your Slack app's request URL to the ngrok URL:
   ```
   https://abc123.ngrok.io/api/slack/whois
   ```

3. Test the command in your Slack workspace

## Rate Limiting

The integration doesn't implement specific rate limiting, but relies on:
- Slack's built-in rate limiting for slash commands
- Database connection pooling for performance
- Efficient queries to minimize response time