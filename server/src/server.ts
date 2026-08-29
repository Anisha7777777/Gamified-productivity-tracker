import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";
import { validateEnvironment } from "./config/env";

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
