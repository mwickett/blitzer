# Blitzer Project Brief

## Project Overview

Blitzer is a companion web application for Dutch Blitz players that tracks game scores and provides statistical insights into player performance over time. The application allows users to record game results, connect with friends, and analyze their playing patterns through various visualizations and statistics.

## Core Purpose

To transform the ephemeral experience of Dutch Blitz gameplay into persistent, analyzable data that reveals patterns, trends, and insights about players' performance and evolution over time.

## Target Users

- Serious Dutch Blitz players who want to track their performance
- Groups of friends who regularly play Dutch Blitz together
- Dutch Blitz enthusiasts interested in analyzing gameplay statistics
- Players looking to improve their skills through data-driven insights

## Key Features

1. **Game Scoring System**

   - Easy, low-friction score entry for each round
   - Support for multiple players per game
   - Error correction and data persistence

2. **User Accounts & Social Features**

   - User registration and authentication via Clerk
   - Friend connections between players
   - Game history tracking

3. **Statistical Analysis & Visualization**

   - Personal performance dashboard
   - Comparative statistics against friends and global players
   - Historical trend analysis
   - Game and round insights

4. **Future Planned Features**
   - LLM-powered chat interface for data queries
   - Sharing exceptional game results
   - Leaderboards for various performance metrics
   - Deck preference tracking and correlation analysis

## Technical Architecture

- **Frontend**: Next.js with ShadCN UI components
- **Backend**: Next.js API routes/Server Actions (currently in transition)
- **Database**: PostgreSQL via Neon
- **Authentication**: Clerk
- **Styling**: Tailwind CSS
- **State Management**: Considering React Query for improved performance

## Current Development Status

The application is functional but undergoing architectural improvements and UI refinements. It's being developed by a solo developer with assistance from LLM tools like Cline.

## Current Challenges

1. UI refinement and responsive design improvements
2. Architectural transition toward a clearer backend/frontend separation
3. Performance optimization
4. Implementation of an LLM-powered chat feature for data analysis

## Development Workflow

- Solo development with LLM assistance
- Feature planning in Cline's Plan mode
- Implementation in Cline's Act mode
- Memory Bank for maintaining project context

## Success Metrics

- User engagement with the scoring system (low friction)
- Depth and usefulness of statistical insights
- User retention and frequency of use
- Growth of user base through word of mouth

## Long-term Vision

To become the essential companion app for Dutch Blitz players worldwide, creating a global community of players who can compare stats, improve their gameplay, and discover patterns in their play style that would otherwise remain hidden.
