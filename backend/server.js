const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

require("./database");

const workoutRoutes = require("./routes/workouts");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/workouts", workoutRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.get("/", (req, res) => {
    res.json({
        app: "LiftLog API"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});