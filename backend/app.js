import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const server = createServer(app);
const io = connectToSocket(server);


app.set("port", (process.env.PORT || 8000))
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});


app.use("/api/v1/users", userRoutes);
let mongoUrl = process.env.MONGO_URL;

const start = async () => {
    app.set("mongo_user")
    const connectionDb = await mongoose.connect(mongoUrl);

    console.log("Database Connected")
    server.listen(app.get("port"), () => {
        console.log("LISTENIN ON PORT 8000")
    });
}

start();