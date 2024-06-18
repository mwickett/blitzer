import type { NextApiRequest, NextApiResponse } from 'next'
import { cloneGame } from "@/server/mutations";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO:  Figure out how to get the ID Here
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ error: "Missing game ID" });
    return;
  }

  try {
    await cloneGame(id as string);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to clone game" });
  }
  res.redirect(`/games/${id}`);
}