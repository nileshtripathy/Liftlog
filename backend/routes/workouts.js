const express = require("express");
const router = express.Router();

const db = require("../database");

router.post("/", (req, res) => {

    const { exercise, weight, reps, date } = req.body;

    if (!exercise || !weight || !reps || !date) {

        return res.status(400).json({

            error: "All fields are required."

        });

    }

    const stmt = db.prepare(`

        INSERT INTO workouts (exercise, weight, reps, date)

        VALUES (?, ?, ?, ?)

    `);

    const result = stmt.run(exercise, weight, reps, date);

    const workout = db.prepare(`

        SELECT * FROM workouts WHERE id = ?

    `).get(result.lastInsertRowid);

    res.status(201).json(workout);

});

router.get("/", (req, res) => {

    const workouts = db

        .prepare(`

            SELECT *

            FROM workouts

            ORDER BY id DESC

        `)

        .all();

    res.json(workouts);

});

router.put("/:id", (req, res) => {

    const { exercise, weight, reps, date } = req.body;

    const id = req.params.id;

    const stmt = db.prepare(`

        UPDATE workouts

        SET exercise=?,

            weight=?,

            reps=?,

            date=?

        WHERE id=?

    `);

    const result = stmt.run(

        exercise,

        weight,

        reps,

        date,

        id

    );

    if (result.changes === 0) {

        return res.status(404).json({

            error: "Workout not found."

        });

    }

    const updated = db.prepare(`

        SELECT *

        FROM workouts

        WHERE id=?

    `).get(id);

    res.json(updated);

});

router.delete("/:id", (req, res) => {

    const stmt = db.prepare(`

        DELETE

        FROM workouts

        WHERE id=?

    `);

    const result = stmt.run(req.params.id);

    if (result.changes === 0) {

        return res.status(404).json({

            error: "Workout not found."

        });

    }

    res.json({

        message: "Workout deleted successfully."

    });

});

module.exports = router;