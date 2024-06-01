## Blitz app - TODO

1. [x] Install shadcdn
2. [x] Scaffold in basic nav element
3. [x] Push to GH
4. [x] Deploy to Vercel
5. [x] Add Vercel postgres
6. [x] Decide whether or not to use an ORM?
7. [x] Add Clerk
8. [x] Setup staging (local DB) and prod DB
9. [x] Add PostHog for analytics

### Data fetching

I'm kind of at a crossroads around whether I use something like react-query, or just keep direct Prisma access in my server components. [This article](https://frontendmasters.com/blog/combining-react-server-components-with-react-query-for-easy-data-management/) has some interesting tradeoffs.

Querying to fetch data in views seems pretty straightforward, but it's the mutation of data that I'm less sure about. Where are the places I'd need to do that?

1. The scoring screen - entering scores
2. Game creation screen - adding users to a game

Maybe that's it? hmm.

### Using API routes

~I think a REST API approach here makes more sense. What do we need to do:~

1. Create game 2. Choose players - select players from list of available players 3. Start - mark start time 4. Enter scores each round 5. New score entry for each player, and each score is associated with the gameId 5. Option to pause 6. Complete once someone hits 75 1. Mark game as finished 2. Set winnerID
2. Resume game
