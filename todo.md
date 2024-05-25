## Blitz app - TODO

1. [x] Install shadcdn
2. [x] Scaffold in basic nav element
3. [x] Push to GH
4. [x] Deploy to Vercel
5. [x] Add Vercel postgres
6. [x] Decide whether or not to use an ORM?
7. [x] Add Clerk

### Data fetching

I'm kind of at a crossroads around whether I use something like react-query, or just keep direct Prisma access in my server components. [This article](https://frontendmasters.com/blog/combining-react-server-components-with-react-query-for-easy-data-management/) has some interesting tradeoffs.

Querying to fetch data in views seems pretty straightforward, but it's the mutation of data that I'm less sure about. Where are the places I'd need to do that?

1. The scoring screen - entering scores
2. Game creation screen - adding users to a game

Maybe that's it? hmm.
