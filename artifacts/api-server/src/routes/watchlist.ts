import { Router, type IRouter, type Request, type Response } from "express";
import { db, watchlistTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/watchlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const items = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.userId, req.user.id));
  res.json({ items });
});

router.post("/watchlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { symbol, note } = req.body as { symbol?: string; note?: string };
  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "Symbol is required" });
    return;
  }
  const sym = symbol.toUpperCase().trim();

  const existing = await db
    .select()
    .from(watchlistTable)
    .where(and(eq(watchlistTable.userId, req.user.id), eq(watchlistTable.symbol, sym)));

  if (existing.length > 0) {
    res.json(existing[0]);
    return;
  }

  const [item] = await db
    .insert(watchlistTable)
    .values({ userId: req.user.id, symbol: sym, note: note || null })
    .returning();
  res.json(item);
});

router.delete("/watchlist/:symbol", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const sym = req.params.symbol.toUpperCase();
  await db
    .delete(watchlistTable)
    .where(and(eq(watchlistTable.userId, req.user.id), eq(watchlistTable.symbol, sym)));
  res.json({ success: true });
});

export default router;
