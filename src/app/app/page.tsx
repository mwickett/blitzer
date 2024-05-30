import prisma from "@/db";

export default async function AppHome() {
  return (
    <div>
      <h2>This is the app homepage</h2>
      <p>
        Eventually this will display an overview of your recent games, and some
        summaries of stats. For now, click Games to get started.
      </p>
    </div>
  );
}
