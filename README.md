# Intro Verification Bot

<div class="description">
Welcome to the <strong>Intro Verification Bot</strong>! This Discord bot streamlines user introductions, handles verification, and provides tools for server management and interaction.
</div>

## Features

### Core Functionalities
- **Introduction Handling**: Validates and processes user introductions.
- **Verification System**: Allows admins to verify users and assign roles.
- **Command Management**: Supports commands for enhanced server management.
- **Sticky Messages**: Manages persistent messages in channels.
- **Poll Creation**: Enables creation of polls with multiple options.
- **Business Listings**: Integrates with Notion to manage and display business information.
- **Voice-Text Channel Management**: Automates creation and visibility of text channels linked to voice channels.

## File Structure

### Handlers
- `commandHandler.js`: Registers commands for the bot.
- `eventHandler.js`: Manages event-based functionality.
- `introHandler.js`: Processes and validates user introductions.
- `ticketHandler.js`: Supports ticketing functionalities.

### Commands
- `addBiz.js`: Add businesses to the Notion database.
- `announce.js`: Post announcements in specific channels.
- `channelguide.js`: Create a server-wide channel guide.
- `checkIntro.js`: Monitor the intros channel for required posts.
- `checkUserActivity.js`: Verify user join dates and role statuses.
- `checkVerified.js`: Display members with only the Verified role.
- `checkselfies.js`: Ensure role-holding members posted selfies recently.
- `closeticket.js`: Close tickets and log actions.
- `createpoll.js`: Create polls with user-defined options.
- `kick.js`: Remove members from the server.
- `listBiz.js`: Display business listings from Notion.
- `listverified.js`: Mention members with only the Verified role.
- `memberroles.js`: Show all members with specified roles.
- `nsfwcheck.js`: Verify NSFW channel access eligibility.
- `say.js`: Send custom embedded messages.
- `startverification.js`: Initiate the verification process.
- `sticky.js`: Manage sticky messages for specified channels.
- `verify.js`: Assign Verified roles to users.
- `warn.js`: Issue warnings to server members.

### Events
- `interactionCreate.js`: Handles interactions like commands and button clicks.
- `messageCreate.js`: Monitors messages and processes commands.
- `messageDelete.js`: Logs deleted messages, particularly in the intros channel.
- `voiceStateUpdate.js`: Manages updates to voice channel states.

### Models
- `stickymessage.js`: Mongoose model for sticky messages.
- `ticket.js`: Mongoose model for tickets.
- `warnings.js`: Mongoose model for warnings issued.
- `user.js`: Mongoose model for user data.

### Utilities
- `voiceTextChannelManager.js`: Automates text channel creation and management for voice channels.

### Validators
- `validateIntro.js`: Ensures user introductions meet specified criteria.

### Deployment
- `deploy-command.js`: Deploys commands to Discord servers.

### Main File
- `index.js`: Entry point for the bot, initializing the client and connecting to the database.

## Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/intro-verification-bot.git
cd intro-verification-bot
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file with the following variables:
```plaintext
MY_DISCORD_BOT_TOKEN=your_token_here
MONGODB_URI=your_mongodb_uri_here
NOTION_TOKEN=your_notion_token_here
CLIENT_ID=your_client_id_here
```

### Step 4: Run the Bot
```bash
node index.js
```

## Usage

### Commands
- `/help`: Displays a list of all available commands.
- `/listverified`: Mentions members who only have the Verified role.
- `/checkintros`: Scans the intros channel for pending posts.
