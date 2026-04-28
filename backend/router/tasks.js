// routes/tasks.js

import express from "express";
import authMiddleware from "../middleware/auth.js";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "../config.js";

const router = express.Router();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// 🔐 GET TASKS
router.get("/", authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error });

  res.json(data);
});

// 🔐 CREATE TASK
router.post("/", authMiddleware, async (req, res) => {
  const { title } = req.body;

  if (!title || title.length > 200) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    user_id: req.user.id
  });

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

// 🔐 DELETE TASK
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

export default router;
