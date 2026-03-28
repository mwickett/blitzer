# Scripts

One-off and operational scripts. These are NOT part of the app build.

## send-circles-announcement.ts

Send the Circles migration announcement email to users.

```bash
# Send a test email to yourself
npx tsx scripts/send-circles-announcement.ts --test mike@wickett.ca

# Send to ALL users in the database
DATABASE_URL="postgresql://..." npx tsx scripts/send-circles-announcement.ts --send
```

**Important:** The `--send` command reads users from whatever `DATABASE_URL` is set. For production sends, pass the production connection string as an env var prefix — do NOT change your `.env` file (to avoid accidentally running migrations against prod).

The script sends emails sequentially with a 600ms delay between each to respect Resend's rate limits (~2/sec).

### Email template

The template is at `src/components/email/circles-announcement-template.tsx`. Send a test email to preview changes before sending to all users.
