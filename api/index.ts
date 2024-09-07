import express from "express";

const app = express();

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.post("/register", (req, res) => {
    res.send("Hello World!");
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});

module.exports = app;