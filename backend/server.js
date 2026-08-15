const express = require("express");
const cors = require("cors");

const scanWebsite = require("./src/scanner");

const app = express();

const PORT = 5050;


// -----------------------------
// Middleware
// -----------------------------

app.use(
    cors({
        origin: [
            "http://localhost:8000",
            "http://127.0.0.1:8000"
        ]
    })
);

app.use(express.json());


// -----------------------------
// Health check
// -----------------------------

app.get("/", (req, res) => {

    res.json({
        message: "EcoWeb Guardian API is running"
    });

});


// -----------------------------
// Scan website
// -----------------------------

app.post("/api/scan", async (req, res) => {

    try {

        const { url } = req.body;


        if (!url) {

            return res.status(400).json({
                error: "Website URL is required."
            });

        }


        console.log(
            "Received scan request:",
            url
        );


        const result =
            await scanWebsite(url);


        res.json(result);


    } catch (error) {

        console.error(
            "Scan API error:",
            error.message
        );


        res.status(500).json({
            error: error.message
        });

    }

});


// -----------------------------
// Start server
// -----------------------------

app.listen(
    PORT,
    () => {

        console.log(
            `EcoWeb Guardian backend running at http://localhost:${PORT}`
        );

    }
);