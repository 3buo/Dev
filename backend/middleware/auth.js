// middleware/auth.js

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "../config.js";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export default async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = data.user;

    next();
  } catch (err) {
    return res.status(500).json({ error: "Auth error" });
  }
}
