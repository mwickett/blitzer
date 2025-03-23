# PostHog LLM Observability Implementation

This document explains how PostHog's LLM observability features have been integrated into Blitzer's chat functionality.

## Overview

The integration allows you to track and analyze LLM interactions with users, including:

- Input messages and token usage
- Output messages and token usage
- Latency and response times
- Error rates
- Model parameters
- Cost estimates

## Implementation Details

The implementation is based on PostHog's `@posthog/ai` package which provides a `withTracing` wrapper for the AI models. This wrapper automatically captures relevant metrics for each LLM interaction.

### Key Files

- `src/app/api/chat/route.ts` - Contains the implementation of the LLM tracing
- `src/app/posthog.ts` - PostHog client configuration

### How It Works

1. When a user sends a message to the chat interface, the chat API route is called
2. The API route authenticates the user and checks feature flags
3. A PostHog client is initialized
4. The OpenAI model is wrapped with PostHog's `withTracing` function
5. User context and conversation metadata are added to the trace
6. The LLM response is generated and streamed back to the user
7. PostHog asynchronously captures all relevant metrics about the interaction
8. Error tracking is also implemented to capture any issues that occur

## Tracked Metrics

The following metrics are captured for each LLM interaction:

- **$ai_input** - The input prompt sent to the model
- **$ai_input_tokens** - Number of tokens in the input
- **$ai_latency** - Time taken for the model to respond
- **$ai_model** - Model name (e.g., "gpt-3.5-turbo")
- **$ai_model_parameters** - Any parameters used (temperature, etc.)
- **$ai_output_choices** - The generated responses
- **$ai_output_tokens** - Number of tokens in the output

Additionally, we capture custom properties:

- User ID and username
- Conversation ID
- Message count
- Topic (derived from the first message)

## Error Tracking

If an error occurs during the LLM interaction, we capture:

- Error message
- Error type
- User ID
- Additional context

## Viewing the Data

To view the LLM analytics data:

1. Log in to PostHog at https://us.posthog.com
2. Navigate to the "Product Analytics" section
3. Look for events prefixed with `$ai_` to see LLM-specific metrics
4. You can create custom dashboards or insights to monitor:
   - Token usage trends
   - Average response times
   - Most common user queries
   - Error rates
   - Cost estimates

## Future Improvements

Potential future improvements include:

- Implementing user feedback tracking for LLM responses
- Creating custom dashboards for LLM metrics
- Setting up alerts for unusual token usage or errors
- A/B testing different model parameters
