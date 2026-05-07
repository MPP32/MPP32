import { Hono } from "hono";

const sampleRouter = new Hono();

sampleRouter.get("/", (c) => {
  return c.json({
    data: {
      message: `${
        ["Hello", "Hola", "Namaste", "Bonjour"][Math.floor(Math.random() * 4)]
      } from the backend!`,
      timestamp: new Date().toLocaleTimeString(),
    },
  });
});

export { sampleRouter };
