import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy for NVIDIA to avoid CORS
  app.post("/api/chat", async (req, res) => {
    const { apiKey, messages, model } = req.body;

    // Use provided key or fallback to the hardcoded one from user request
    const finalApiKey = apiKey || process.env.NVIDIA_API_KEY || "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";

    try {
      const openai = new OpenAI({
        apiKey: finalApiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      });

      const response = await openai.chat.completions.create({
        model: model || "z-ai/glm5",
        messages: messages,
        temperature: 1,
        top_p: 1,
        max_tokens: 16384,
        // @ts-ignore
        extra_body: {
          "chat_template_kwargs": { "enable_thinking": true, "clear_thinking": false }
        },
        stream: true,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("NVIDIA API Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
