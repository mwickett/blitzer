# Active Context for Blitzer

## Current Work Focus

The current development focus for Blitzer is on three main areas:

1. **UI Refinement and Responsive Design**

   - Improving the overall visual appeal of the application
   - Ensuring consistent responsive behavior across all device sizes
   - Enhancing the user experience for key workflows, particularly score entry

2. **Architectural Improvements**

   - Transitioning toward a clearer backend/frontend separation
   - Evaluating the use of React Query for improved performance and state management
   - Refactoring to standardize on either Server Actions or API routes

3. **LLM Chat Feature Implementation**
   - Initial implementation of chat UI and API endpoint ✅
   - Created custom SimpleChat component to handle errors ✅
   - Fixed streaming using proper JSON format for useChat ✅
   - Implemented enhanced system prompt with user game statistics ✅
   - Planning future MCP PostgreSQL integration for more complex queries

## Recent Changes

- Implemented friend requests and friend connections
- Added user avatars
- Created rounds model to better track round-by-round gameplay
- Added updated_at field to score model for improved timestamp tracking
- Migrated from homegrown Vercel Edge Config flag system to PostHog feature flags
- Fixed database migration issues related to unique constraints in the Round model
- Added documentation for feature flag usage in `src/FEATURE_FLAGS.md`
- Added basic chat interface in new Insights section ✅
- Created API endpoint for LLM-powered chat ✅
- Implemented proper streaming responses for the chat interface ✅
- Added user statistics in prompt for personalized responses ✅
- Implemented PostHog LLM observability for chat functionality ✅
- Fixed deprecated `isLoading` property in ModernChatUI component ✅
- Created documentation for LLM observability implementation ✅

## Next Steps

### Immediate Tasks

1. **Complete Memory Bank Setup**

   - Finalize all core Memory Bank files
   - Establish workflow for keeping Memory Bank updated

2. **LLM Chat Feature Enhancement**

   - Implement MCP PostgreSQL server for database access
   - Add visualization support for query results
   - Add more advanced user queries based on game data
   - Implement caching for common queries
   - Add user feedback mechanisms for LLM responses
   - Create custom PostHog dashboards for LLM metrics

3. **UI Improvements**

   - Refine responsive design, particularly for mobile views
   - Standardize component styling
   - Improve navigation and user flow

4. **Architecture Refactoring**
   - Decide on consistent pattern for data fetching (React Query)
   - Implement API endpoints for front-end data needs
   - Clean up inconsistent backend code

### Medium-term Tasks

- Implement more advanced statistical visualizations
- Add sharing functionality for exceptional game results
- Build leaderboards for various performance metrics
- Develop deck preference tracking

## Active Decisions and Considerations

### LLM Implementation Strategy

Current implementation:

- Enhanced system prompts with user-specific data ✅
- Streaming approach for responsive chat functionality ✅
- PostHog LLM observability for monitoring and analytics ✅

Currently exploring:

- MCP PostgreSQL for flexible database querying
- Security considerations for data access
- Prompt engineering for better user experience
- Visualization of query results
- PostHog monitoring dashboards for LLM usage patterns
- User feedback collection for LLM responses

### Architecture Pattern Decision

Currently evaluating whether to:

- Standardize on Next.js Server Actions for simplicity
- Switch to a clearer API-based approach with React Query
- Use a hybrid approach with defined boundaries

Key considerations:

- Developer experience (solo development)
- Performance and user experience
- Maintenance complexity
- Future scalability

### UI Library Approach

Continuing with ShadCN UI components while considering:

- Which components need customization for better UX
- How to maintain consistent styling across custom and library components
- Responsive design patterns for all key interfaces

### Data Modeling

Ongoing refinement of data models, particularly:

- How to efficiently store and retrieve round-by-round data
- Friend relationship modeling
- Statistical aggregation methods

### User Experience Priorities

Balancing multiple UX goals:

- Keeping score entry as frictionless as possible
- Making statistical insights easily accessible
- Supporting social features without cluttering the experience
- Creating intuitive navigation between key sections
